"""Pre-build the Try Trade in Time case pool.

Random draws need a company's full price history plus its income statement and
balance sheet as they stood on a past date. None of that is in the runtime
snapshot, so it can only come from Yahoo — and Yahoo routinely blocks
datacenter IPs, which is why draws work locally and fail once deployed.

So we do that work here, offline, and ship the result. At request time the app
just picks a case out of a file: instant, no network, no cold-start cost, and
it cannot break because a third party throttled the server.

Run from the repo root:

    .venv/bin/python scripts/build_timetrade_pool.py --count 150

Re-run occasionally to refresh "today's" prices; the app shows the build date.
"""

import argparse
import gzip
import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "api"))

logging.basicConfig(level=logging.WARNING)
logging.getLogger("yfinance").setLevel(logging.CRITICAL)

from modules import market_cache, time_trade as tt, time_trade_random as ttr  # noqa: E402

OUT = ROOT / "api" / "data" / "timetrade_pool.json.gz"


def _retry(fn, tries: int = 4, base: float = 20.0):
    """Yahoo rate-limits hard. Back off rather than dropping the case."""
    for i in range(tries):
        try:
            return fn()
        except Exception as exc:
            if "RateLimit" in type(exc).__name__ or "Too Many Requests" in str(exc):
                wait = base * (2 ** i)
                print(f"    rate limited; waiting {wait:.0f}s…", flush=True)
                time.sleep(wait)
                continue
            raise
    return None


def bake(case_id: str) -> dict | None:
    """Dossier plus the outcome, with everything the UI needs baked in."""
    dossier = _retry(lambda: tt.get_case(case_id))
    if not dossier:
        return None
    # A nominal amount: the money fields are recomputed per request from
    # price_then/price_now, so only the price-derived parts matter here.
    reveal = _retry(lambda: tt.decide(case_id, 100000.0))
    if not reveal or "error" in reveal:
        return None
    for k in ("amount", "reference_amount", "qty", "invested", "value_now", "pnl", "nifty_value"):
        reveal.pop(k, None)
    dossier["_reveal"] = reveal
    return dossier


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=150, help="random cases to generate")
    args = ap.parse_args()

    print("Loading market snapshots…")
    market_cache._load_snapshots()
    pool_size = len(ttr._candidates())
    print(f"  fundamentals={len(market_cache.store.fundamentals)}  candidates={pool_size}")
    if pool_size < 20:
        print("ERROR: candidate pool too small — refresh the fundamentals snapshot first.")
        return 1

    cases: list[dict] = []

    print(f"\nBaking {len(tt.CASES)} classic cases…")
    for c in tt.CASES:
        baked = bake(c["id"])
        if baked:
            cases.append(baked)
            print(f"  ok  {c['id']}  {c['name']}")
        else:
            print(f"  SKIP {c['id']}  (no price history)")

    print(f"\nDrawing {args.count} random cases…")
    seen: set[str] = set()
    attempts = 0
    while sum(1 for c in cases if c.get("kind") == "random") < args.count and attempts < args.count * 4:
        attempts += 1
        drawn = _retry(lambda: ttr.draw(seen, use_pool=False))
        if not drawn:
            continue
        stored = tt._GENERATED.get(drawn["id"]) or {}
        sym = stored.get("symbol")
        if not sym or sym in seen:
            continue
        baked = bake(drawn["id"])
        if not baked:
            continue
        seen.add(sym)
        # A stable id so a rebuild does not invalidate anything the UI holds.
        baked["id"] = f"pool-{sym.split('.')[0].lower()}-{baked['date']}"
        baked["_reveal"]["id"] = baked["id"]
        cases.append(baked)
        n = len(seen)
        if n % 10 == 0 or n <= 3:
            print(f"  {n}/{args.count}  {baked['_reveal']['name'][:34]:34s} {baked['date']}")
        time.sleep(1.5)   # be polite to Yahoo

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "cases": cases,
    }
    n_rand_new = sum(1 for c in cases if c.get("kind") == "random")
    if not cases or (args.count > 0 and n_rand_new == 0):
        print("\nERROR: no random cases built (Yahoo rate limit?). Existing pool left untouched.")
        return 1
    if OUT.exists():
        try:
            prev = json.loads(gzip.decompress(OUT.read_bytes()).decode("utf-8"))
            n_prev = sum(1 for c in prev.get("cases", []) if c.get("kind") == "random")
            if n_rand_new < n_prev * 0.5:
                print(f"\nERROR: would shrink the pool from {n_prev} to {n_rand_new} random "
                      f"cases. Existing pool left untouched.")
                return 1
        except Exception:
            pass
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(gzip.compress(json.dumps(payload).encode("utf-8")))

    n_rand = sum(1 for c in cases if c.get("kind") == "random")
    print(f"\nWrote {OUT.relative_to(ROOT)}")
    print(f"  {len(cases)} cases ({len(cases) - n_rand} classic, {n_rand} random)"
          f"  ·  {OUT.stat().st_size / 1024:.0f} KB gzipped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
