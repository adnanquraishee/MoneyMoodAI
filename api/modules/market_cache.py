"""
Market data layer: stale-while-revalidate in-memory store.

Design rule: user-facing requests ONLY read from memory (sub-millisecond).
All Yahoo Finance I/O happens in background jobs (APScheduler) or the
one-time warm-up thread. If data is stale we still serve it instantly and
let the scheduler refresh it — the user never waits on the network.
"""

import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import yfinance as yf
try:
    from apscheduler.schedulers.background import BackgroundScheduler
except ImportError:
    BackgroundScheduler = None
from cachetools import TTLCache

from modules import factors as factors_mod
from modules import watchlist_store

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
INDEX_SYMBOL = "^NSEI"          # NIFTY 50 — market proxy for CAPM
RISK_FREE_RATE = 0.07           # ~10Y Indian G-sec yield (annual)
UNIVERSE_REFRESH_MIN = 60       # full-NSE refresh cadence (be polite to Yahoo)
FUNDAMENTALS_REFRESH_HRS = 24   # P/E, market cap, sector
FAST_LANE_REFRESH_SEC = 60      # watchlist quotes
DOWNLOAD_CHUNK = 60             # symbols per yfinance batch call
CHUNK_PAUSE_SEC = 3.0           # pause between chunks to avoid rate limiting
RATE_LIMIT_BACKOFF_SEC = 25     # extra pause after an empty (throttled) chunk
MIN_HISTORY_ROWS = 130          # ~6 months of trading to be scoreable

NSE_LIST_URL = "https://archives.nseindia.com/content/equities/EQUITY_L.csv"
_NSE_LIST_FILE = None  # resolved lazily under data/

# Fallback universe (NIFTY 100) if the NSE list can't be fetched.
FALLBACK_UNIVERSE = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "ICICIBANK.NS", "INFY.NS",
    "HINDUNILVR.NS", "ITC.NS", "SBIN.NS", "BHARTIARTL.NS", "KOTAKBANK.NS",
    "LT.NS", "AXISBANK.NS", "ASIANPAINT.NS", "MARUTI.NS", "SUNPHARMA.NS",
    "TITAN.NS", "ULTRACEMCO.NS", "BAJFINANCE.NS", "NESTLEIND.NS", "WIPRO.NS",
    "M&M.NS", "NTPC.NS", "HCLTECH.NS", "POWERGRID.NS", "JIOFIN.NS",
    "TATASTEEL.NS", "ADANIENT.NS", "ADANIPORTS.NS", "COALINDIA.NS", "BAJAJFINSV.NS",
    "ONGC.NS", "TECHM.NS", "GRASIM.NS", "HINDALCO.NS", "JSWSTEEL.NS",
    "DRREDDY.NS", "CIPLA.NS", "EICHERMOT.NS", "BRITANNIA.NS", "APOLLOHOSP.NS",
    "DIVISLAB.NS", "HEROMOTOCO.NS", "BAJAJ-AUTO.NS", "INDUSINDBK.NS", "TATACONSUM.NS",
    "SBILIFE.NS", "HDFCLIFE.NS", "BPCL.NS", "SHRIRAMFIN.NS", "PERSISTENT.NS",
    "PIDILITIND.NS", "SIEMENS.NS", "ABB.NS", "DLF.NS", "AMBUJACEM.NS",
    "GODREJCP.NS", "DABUR.NS", "HAVELLS.NS", "VEDL.NS", "BANKBARODA.NS",
    "PNB.NS", "CANBK.NS", "IOC.NS", "GAIL.NS", "MARICO.NS",
    "COLPAL.NS", "BERGEPAINT.NS", "MOTHERSON.NS", "BOSCHLTD.NS", "TVSMOTOR.NS",
    "INDIGO.NS", "NAUKRI.NS", "ETERNAL.NS", "DMART.NS", "ICICIPRULI.NS",
    "ICICIGI.NS", "SBICARD.NS", "CHOLAFIN.NS", "MUTHOOTFIN.NS", "BAJAJHLDNG.NS",
    "TORNTPHARM.NS", "LUPIN.NS", "ALKEM.NS", "AUROPHARMA.NS", "ZYDUSLIFE.NS",
    "TRENT.NS", "PAGEIND.NS", "IRCTC.NS", "HAL.NS", "BEL.NS",
    "ADANIPOWER.NS", "ADANIGREEN.NS", "TATAPOWER.NS", "JINDALSTEL.NS", "SAIL.NS",
    "SRF.NS", "UPL.NS", "PIIND.NS", "ASHOKLEY.NS", "IDFCFIRSTB.NS",
]


def load_nse_universe() -> tuple[list[str], dict[str, str]]:
    """Full NSE equity list (~2,300 symbols) from the official free CSV.
    Cached on disk for 7 days; falls back to the embedded NIFTY-100 list."""
    import requests
    from pathlib import Path
    import time as _time

    data_dir = Path(__file__).resolve().parent.parent / "data"
    data_dir.mkdir(exist_ok=True)
    cache_file = data_dir / "nse_equity_list.csv"

    text = None
    if cache_file.exists() and _time.time() - cache_file.stat().st_mtime < 7 * 86400:
        text = cache_file.read_text()
    else:
        try:
            resp = requests.get(NSE_LIST_URL, timeout=20, headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"})
            if resp.ok and "SYMBOL" in resp.text[:100]:
                text = resp.text
                cache_file.write_text(text)
        except Exception:
            logger.exception("NSE equity list fetch failed")
        if text is None and cache_file.exists():
            text = cache_file.read_text()  # stale cache beats nothing

    if text is None:
        logger.warning("Using fallback NIFTY-100 universe")
        return list(FALLBACK_UNIVERSE), {}

    symbols, names = [], {}
    import csv as _csv
    import io as _io
    for row in _csv.DictReader(_io.StringIO(text)):
        row = {k.strip(): (v or "").strip() for k, v in row.items()}
        if row.get("SERIES") != "EQ":
            continue
        sym = row.get("SYMBOL", "")
        if not sym or not sym.replace("&", "").replace("-", "").isalnum():
            continue
        full = f"{sym}.NS"
        symbols.append(full)
        names[full] = row.get("NAME OF COMPANY", sym)
    logger.info("Loaded %d NSE equities", len(symbols))
    return symbols, names


UNIVERSE: list[str] = []            # populated by start()
UNIVERSE_NAMES: dict[str, str] = {}

INDICES = {
    "^NSEI": "NIFTY 50", "^BSESN": "SENSEX", "^INDIAVIX": "India VIX",
    "^GSPC": "S&P 500", "^IXIC": "NASDAQ", "GC=F": "Gold", "CL=F": "Crude Oil",
    "BTC-USD": "Bitcoin", "INR=X": "USD/INR", "EURUSD=X": "EUR/USD",
}


class MarketStore:
    """Thread-safe in-memory snapshot of everything the UI reads."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.status: str = "cold"          # cold -> warming -> ready
        self.progress: float = 0.0         # 0..1 during warm-up
        self.as_of: str | None = None
        self.closes: pd.DataFrame | None = None      # daily closes, cols = symbols (incl. index)
        self.screener_rows: list[dict] = []
        self.fundamentals: dict[str, dict] = {}
        self.fundamentals_as_of: str | None = None
        # fast lane: quotes for watchlist / currently-viewed symbols
        self.quote_cache: TTLCache = TTLCache(maxsize=512, ttl=FAST_LANE_REFRESH_SEC * 3)
        # per-ticker history for non-universe symbols (charts, factors, forecast)
        self.history_cache: TTLCache = TTLCache(maxsize=256, ttl=600)
        # per-ticker OHLCV frames for candlestick charts, keyed (symbol, period, interval)
        self.ohlc_cache: TTLCache = TTLCache(maxsize=128, ttl=300)
        # on-demand fundamentals for non-universe symbols
        self.fund_cache: TTLCache = TTLCache(maxsize=128, ttl=6 * 3600)
        # dashboard: index cards with sparklines
        self.indices_snapshot: list[dict] = []
        self.indices_as_of: str | None = None


store = MarketStore()
_scheduler: Any = None


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Disk snapshots: one good crawl is reusable forever (stale-while-revalidate
# across restarts — the screener is full within seconds of boot).
# ---------------------------------------------------------------------------
from pathlib import Path as _Path
import json as _json

_DATA_DIR = _Path(__file__).resolve().parent.parent / "data"
_CLOSES_PKL = _DATA_DIR / "closes_snapshot.pkl.gz"
_FUND_JSON = _DATA_DIR / "fundamentals_snapshot.json.gz"


def _save_closes_snapshot() -> None:
    try:
        _DATA_DIR.mkdir(exist_ok=True)
        with store.lock:
            closes = store.closes
        if closes is not None and len(closes.columns) > 50:
            closes.to_pickle(_CLOSES_PKL, compression="gzip")
    except Exception:
        logger.exception("Closes snapshot save failed")


def _save_fundamentals_snapshot() -> None:
    try:
        import gzip
        _DATA_DIR.mkdir(exist_ok=True)
        with store.lock:
            fund = dict(store.fundamentals)
        if fund:
            _FUND_JSON.write_bytes(gzip.compress(_json.dumps(fund).encode('utf-8')))
    except Exception:
        logger.exception("Fundamentals snapshot save failed")


def _load_snapshots() -> bool:
    """Restore last known-good state; returns True if the screener is usable."""
    import gzip
    loaded = False
    try:
        if _FUND_JSON.exists():
            with store.lock:
                store.fundamentals.update(_json.loads(gzip.decompress(_FUND_JSON.read_bytes()).decode('utf-8')))
            logger.info("Loaded %d fundamentals from disk", len(store.fundamentals))
    except Exception:
        logger.exception("Fundamentals snapshot load failed")
    try:
        if _CLOSES_PKL.exists():
            closes = pd.read_pickle(_CLOSES_PKL, compression="gzip")
            if INDEX_SYMBOL in closes.columns and len(closes.columns) > 50:
                valid = [c for c in closes.columns
                         if c != INDEX_SYMBOL and closes[c].dropna().shape[0] >= MIN_HISTORY_ROWS]
                rows = factors_mod.compute_universe_factors(
                    closes[valid], closes[INDEX_SYMBOL],
                    rf=RISK_FREE_RATE, fundamentals=store.fundamentals,
                    names=UNIVERSE_NAMES)
                snap_age = datetime.fromtimestamp(
                    _CLOSES_PKL.stat().st_mtime, tz=timezone.utc).isoformat()
                with store.lock:
                    store.closes = closes
                    store.screener_rows = rows
                    store.as_of = snap_age
                    store.status = "ready"
                    store.progress = 1.0
                logger.info("Screener restored from disk: %d symbols", len(rows))
                loaded = True
    except Exception:
        logger.exception("Closes snapshot load failed")
    return loaded


# ---------------------------------------------------------------------------
# Fetchers (background only — never called from a request handler)
# ---------------------------------------------------------------------------

def _download_closes(symbols: list[str], period: str = "2y") -> pd.DataFrame:
    """One batched download for many symbols; returns a Close-price frame.
    Thread count is capped so Yahoo doesn't rate-limit the full-NSE crawl."""
    raw = yf.download(
        symbols, period=period, interval="1d",
        group_by="column", auto_adjust=True, progress=False,
        threads=min(4, max(1, len(symbols))),
    )
    if raw is None or raw.empty:
        return pd.DataFrame()
    if isinstance(raw.columns, pd.MultiIndex):
        closes = raw["Close"]
    else:  # single symbol
        closes = raw[["Close"]]
        closes.columns = symbols[:1]
    closes = closes.dropna(how="all")
    closes.index = pd.to_datetime(closes.index).tz_localize(None)
    return closes


def refresh_universe() -> None:
    """Refresh the full-NSE price matrix (chunked batches) and re-score.

    With ~2,300 symbols this takes a few minutes cold; the screener serves
    partial results as each chunk lands, so the UI fills progressively."""
    try:
        symbols = list(UNIVERSE)
        chunks = [symbols[i:i + DOWNLOAD_CHUNK] for i in range(0, len(symbols), DOWNLOAD_CHUNK)]
        frames: list[pd.DataFrame] = []
        idx_frame = _download_closes([INDEX_SYMBOL], period="2y")
        if idx_frame.empty:
            logger.warning("Index download failed; keeping last snapshot")
            return
        frames.append(idx_frame)

        import time as _time
        for n, chunk in enumerate(chunks, 1):
            if n > 1:
                _time.sleep(CHUNK_PAUSE_SEC)
            part = _download_closes(chunk, period="2y")
            if not part.empty:
                frames.append(part)
            closes = pd.concat(frames, axis=1)
            closes = closes.loc[:, ~closes.columns.duplicated()]
            valid = [c for c in closes.columns
                     if c != INDEX_SYMBOL and closes[c].dropna().shape[0] >= MIN_HISTORY_ROWS]
            rows = factors_mod.compute_universe_factors(
                closes[valid], closes[INDEX_SYMBOL],
                rf=RISK_FREE_RATE, fundamentals=store.fundamentals,
                names=UNIVERSE_NAMES,
            )
            with store.lock:
                store.closes = closes
                store.screener_rows = rows
                store.as_of = _utcnow()
                if store.status != "ready":
                    store.status = "ready" if n == len(chunks) else "warming"
                store.progress = round(n / max(1, len(chunks)), 2)
            logger.info("Universe chunk %d/%d: %d symbols scored", n, len(chunks), len(rows))
            if part.empty:
                logger.warning("Chunk %d empty — likely throttled; backing off", n)
                _time.sleep(RATE_LIMIT_BACKOFF_SEC)
            elif n % 5 == 0:
                _save_closes_snapshot()   # partial progress survives restarts
        with store.lock:
            store.status = "ready"
            store.progress = 1.0
        _save_closes_snapshot()
    except Exception:
        logger.exception("Universe refresh failed; last snapshot still served")


def _norm_fraction(v, threshold: float = 1.5):
    """Yahoo mixes fractions and percents across fields; normalize to fraction."""
    if v is None:
        return None
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    return v / 100.0 if abs(v) > threshold else v


def _fetch_one_fundamental(symbol: str) -> tuple[str, dict]:
    try:
        info = yf.Ticker(symbol).info or {}
        d2e = info.get("debtToEquity")
        return symbol, {
            "name": info.get("longName") or info.get("shortName") or symbol,
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "summary": (info.get("longBusinessSummary") or "")[:600] or None,
            "market_cap": info.get("marketCap"),
            "pe": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "peg": info.get("trailingPegRatio") or info.get("pegRatio"),
            "pb": info.get("priceToBook"),
            "ps": info.get("priceToSalesTrailing12Months"),
            "eps": info.get("trailingEps"),
            "book_value": info.get("bookValue"),
            "roe": _norm_fraction(info.get("returnOnEquity")),
            "roa": _norm_fraction(info.get("returnOnAssets")),
            "profit_margin": _norm_fraction(info.get("profitMargins")),
            "operating_margin": _norm_fraction(info.get("operatingMargins")),
            "revenue_growth": _norm_fraction(info.get("revenueGrowth")),
            "earnings_growth": _norm_fraction(info.get("earningsGrowth")),
            "debt_to_equity": (float(d2e) / 100.0 if d2e and float(d2e) > 5 else d2e),
            "current_ratio": info.get("currentRatio"),
            "dividend_yield": _norm_fraction(info.get("dividendYield"), threshold=0.30),
            "high_52w": info.get("fiftyTwoWeekHigh"),
            "low_52w": info.get("fiftyTwoWeekLow"),
        }
    except Exception:
        return symbol, {}


def refresh_fundamentals() -> None:
    """Slow-moving data: name/sector/mcap/P-E. Nightly cadence, 6 workers."""
    results: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(_fetch_one_fundamental, s): s for s in UNIVERSE}
        done = 0
        for fut in as_completed(futures):
            sym, data = fut.result()
            if data:
                results[sym] = data
            done += 1
            if store.status == "warming":
                with store.lock:
                    store.progress = 0.5 + 0.5 * (done / len(UNIVERSE))
    if not results:
        logger.warning("Fundamentals refresh returned nothing")
        return
    with store.lock:
        store.fundamentals.update(results)
        store.fundamentals_as_of = _utcnow()
    _save_fundamentals_snapshot()
    # Re-merge fundamentals into screener rows (cheap: math on cached prices)
    if store.closes is not None:
        try:
            valid = [c for c in store.closes.columns if c != INDEX_SYMBOL]
            valid2 = [c for c in valid
                      if store.closes[c].dropna().shape[0] >= MIN_HISTORY_ROWS]
            rows = factors_mod.compute_universe_factors(
                store.closes[valid2], store.closes[INDEX_SYMBOL],
                rf=RISK_FREE_RATE, fundamentals=store.fundamentals,
                names=UNIVERSE_NAMES,
            )
            with store.lock:
                store.screener_rows = rows
        except Exception:
            logger.exception("Screener re-score after fundamentals failed")
    logger.info("Fundamentals refreshed for %d symbols", len(results))



def refresh_indices() -> None:
    """Dashboard hero data: index/commodity/crypto cards with sparklines."""
    try:
        closes = _download_closes(list(INDICES.keys()), period="1mo")
        with store.lock:
            previous = {i["symbol"]: i for i in store.indices_snapshot}
        snapshot = []
        for sym, name in INDICES.items():
            if sym not in closes.columns or closes[sym].dropna().empty:
                # keep the last good quote rather than flashing N/A
                snapshot.append(previous.get(sym) or {
                    "symbol": sym, "name": name, "price": None,
                    "change": None, "spark": []})
                continue
            s = closes[sym].dropna()
            price = float(s.iloc[-1]) if len(s) else None
            change = float((s.iloc[-1] / s.iloc[-2] - 1) * 100) if len(s) >= 2 else None
            snapshot.append({
                "symbol": sym, "name": name,
                "price": round(price, 2) if price is not None else None,
                "change": round(change, 2) if change is not None else None,
                "spark": [round(float(v), 2) for v in s.tail(22).tolist()],
            })
        with store.lock:
            store.indices_snapshot = snapshot
            store.indices_as_of = _utcnow()
        logger.info("Indices snapshot refreshed")
    except Exception:
        logger.exception("Indices refresh failed")


def get_pulse() -> dict:
    """One-call dashboard payload: index cards, market mood, movers, ticker."""
    with store.lock:
        indices = list(store.indices_snapshot)
        rows = list(store.screener_rows)
        as_of = store.indices_as_of
        status = store.status
        progress = store.progress
    changed = [r for r in rows if r.get("change_pct") is not None]
    advancers = sum(1 for r in changed if r["change_pct"] > 0)
    decliners = sum(1 for r in changed if r["change_pct"] < 0)
    if changed:
        total = len(changed)
        breadth = advancers / total
        avg_chg = sum(r["change_pct"] for r in changed) / total
        score = int(round(max(0, min(100, 50 + (breadth - 0.5) * 90 + avg_chg * 6))))
    else:  # nothing scored yet (cold start) -> neutral, not "bearish"
        avg_chg = 0.0
        score = 50
    label = "bullish" if score >= 60 else "bearish" if score <= 40 else "neutral"
    by_chg = sorted(changed, key=lambda r: r["change_pct"], reverse=True)

    def slim(r):
        return {"symbol": r["symbol"], "name": r["name"], "price": r["price"],
                "change_pct": r["change_pct"], "score": r.get("score")}

    by_mcap = sorted((r for r in changed if r.get("market_cap")),
                     key=lambda r: r["market_cap"], reverse=True)
    vix = next((i for i in indices if i.get("symbol") == "^INDIAVIX"), None)
    return {
        "status": status, "progress": progress, "as_of": as_of,
        "indices": indices,
        "mood": {"score": score, "label": label, "advancers": advancers,
                 "decliners": decliners, "universe": len(rows),
                 "avg_change_pct": round(avg_chg, 2),
                 "vix": (vix or {}).get("price"),
                 "vix_change": (vix or {}).get("change")},
        "gainers": [slim(r) for r in by_chg[:5]],
        "losers": [slim(r) for r in by_chg[-5:][::-1]],
        "ticker": [slim(r) for r in (by_mcap[:30] or changed[:30])],
    }


def refresh_fast_lane() -> None:
    """60s quotes for watchlist symbols only — keeps the watchlist 'live'."""
    symbols = watchlist_store.get_symbols()
    if not symbols:
        return
    try:
        closes = _download_closes(symbols, period="10d")
        for sym in symbols:
            if sym not in closes.columns:
                continue
            s = closes[sym].dropna()
            if len(s) >= 2:
                store.quote_cache[sym] = {
                    "symbol": sym,
                    "price": float(s.iloc[-1]),
                    "change_pct": float((s.iloc[-1] / s.iloc[-2] - 1) * 100),
                    "as_of": _utcnow(),
                }
    except Exception:
        logger.exception("Fast-lane refresh failed")


# ---------------------------------------------------------------------------
# Read API (what request handlers call — memory only, plus one safe fallback)
# ---------------------------------------------------------------------------

def get_screener() -> dict:
    with store.lock:
        return {
            "status": store.status,
            "progress": round(store.progress, 2),
            "as_of": store.as_of,
            "count": len(store.screener_rows),
            "rows": store.screener_rows,
        }


# ---------------------------------------------------------------------------
# Metric distributions — powers the "learn this metric" UI. For every ratio we
# teach, we show the learner where THIS stock sits against the real NSE
# universe rather than a textbook rule of thumb, so the context is honest and
# stays current as the market re-rates. Pure memory read; cached 10 min.
# ---------------------------------------------------------------------------
# Reported ratios come from the fundamentals cache, which covers the whole
# fetched universe. Factor and price statistics only exist on scored rows, so
# they come from the screener. Taking each from its richer source is the
# difference between a percentile drawn from ~2,000 companies and one drawn
# from the few dozen scored so far.
FUNDAMENTAL_METRICS = (
    "pe", "forward_pe", "peg", "pb", "ps", "roe", "roa", "profit_margin",
    "operating_margin", "revenue_growth", "earnings_growth", "debt_to_equity",
    "current_ratio", "dividend_yield",
)
FACTOR_METRICS = (
    "beta", "volatility", "rsi", "sharpe", "alpha", "momentum", "score",
    "return_1y",
)
DISTRIBUTION_METRICS = FUNDAMENTAL_METRICS + FACTOR_METRICS

# Values beyond these bounds are data errors or degenerate cases (a P/E of
# 4000 from a near-zero denominator), not signal. Excluding them keeps the
# percentiles describing the market instead of the outliers.
_DIST_BOUNDS = {
    "pe": (0.0, 300.0),
    "forward_pe": (0.0, 300.0),
    "peg": (-10.0, 20.0),
    "pb": (0.0, 60.0),
    "roe": (-2.0, 2.0),
    "profit_margin": (-2.0, 2.0),
    "revenue_growth": (-1.0, 5.0),
    "earnings_growth": (-1.0, 5.0),
    "debt_to_equity": (0.0, 20.0),
    "dividend_yield": (0.0, 0.25),
    "beta": (-2.0, 5.0),
    "volatility": (0.0, 3.0),
    "sharpe": (-5.0, 5.0),
    "alpha": (-2.0, 2.0),
    "momentum": (-1.0, 5.0),
    "ps": (0.0, 60.0),
    "roa": (-1.0, 1.0),
    "operating_margin": (-2.0, 2.0),
    "current_ratio": (0.0, 30.0),
    "return_1y": (-1.0, 10.0),
}

_MIN_SECTOR_SAMPLES = 8
_distributions_cache: dict = {"at": 0.0, "data": None}
_DISTRIBUTIONS_TTL = 600


def _percentiles(values: list[float]) -> dict:
    """p10/p25/p50/p75/p90 from a pre-sorted list."""
    n = len(values)

    def at(q: float) -> float:
        return float(values[min(n - 1, max(0, int(q * n)))])

    return {
        "count": n,
        "p10": round(at(0.10), 4),
        "p25": round(at(0.25), 4),
        "p50": round(at(0.50), 4),
        "p75": round(at(0.75), 4),
        "p90": round(at(0.90), 4),
    }


def get_metric_distributions() -> dict:
    """Percentile bands per metric across the scored universe, plus per-sector
    medians. The UI uses these to answer "is 25 a high P/E?" with this
    market's actual numbers."""
    import time as _time
    now = _time.time()
    if _distributions_cache["data"] is not None and \
            now - _distributions_cache["at"] < _DISTRIBUTIONS_TTL:
        return _distributions_cache["data"]

    with store.lock:
        rows = list(store.screener_rows)
        funds = list(store.fundamentals.values())
        as_of = store.as_of

    out: dict = {
        "as_of": as_of,
        "universe_size": max(len(rows), len(funds)),
        "metrics": {},
    }
    for key in DISTRIBUTION_METRICS:
        source = funds if key in FUNDAMENTAL_METRICS else rows
        lo, hi = _DIST_BOUNDS.get(key, (float("-inf"), float("inf")))
        vals: list[float] = []
        by_sector: dict[str, list[float]] = {}
        for r in source:
            v = r.get(key)
            if not isinstance(v, (int, float)) or isinstance(v, bool):
                continue
            v = float(v)
            if v != v or v in (float("inf"), float("-inf")) or not (lo <= v <= hi):
                continue
            vals.append(v)
            sec = r.get("sector")
            if sec:
                by_sector.setdefault(sec, []).append(v)
        if len(vals) < 20:
            continue
        vals.sort()
        entry = _percentiles(vals)
        sectors = {}
        for sec, sv in by_sector.items():
            if len(sv) >= _MIN_SECTOR_SAMPLES:
                sv.sort()
                sectors[sec] = {"count": len(sv), "p50": round(_percentiles(sv)["p50"], 4)}
        entry["sectors"] = sectors
        out["metrics"][key] = entry

    _distributions_cache["at"] = now
    _distributions_cache["data"] = out
    return out


# ---------------------------------------------------------------------------
# Sector rotation (RRG-style): per-sector relative strength vs NIFTY and its
# momentum, sampled weekly so the UI can draw motion trails. Pure memory read
# over the closes matrix; cached 10 min because it scans ~2k columns.
# ---------------------------------------------------------------------------
_sector_rotation_cache: dict = {"at": 0.0, "data": None}
_SECTOR_ROTATION_TTL = 600


def get_sector_rotation(trail_points: int = 8, step_days: int = 5) -> dict:
    import time as _time
    now = _time.time()
    if _sector_rotation_cache["data"] is not None and \
            now - _sector_rotation_cache["at"] < _SECTOR_ROTATION_TTL:
        return _sector_rotation_cache["data"]

    with store.lock:
        closes = store.closes
        rows = list(store.screener_rows)
        as_of = store.as_of
    empty = {"as_of": as_of, "sectors": []}
    if closes is None or INDEX_SYMBOL not in closes.columns or not rows:
        return empty

    window = 220  # ~10 months of trading days
    df = closes.tail(window)
    bench = df[INDEX_SYMBOL].dropna()
    if len(bench) < 90:
        return empty

    by_sector: dict[str, list[dict]] = {}
    for r in rows:
        sec = r.get("sector")
        if sec and r["symbol"] in df.columns:
            by_sector.setdefault(sec, []).append(r)

    sectors = []
    for sec, members in by_sector.items():
        if len(members) < 3:
            continue
        cols = [m["symbol"] for m in members]
        sub = df[cols].dropna(axis=1, thresh=90)
        if sub.shape[1] < 3:
            continue
        # equal-weight sector index: mean of each member rebased to 1.0
        rebased = sub / sub.apply(lambda s: s.dropna().iloc[0])
        sec_idx = rebased.mean(axis=1)
        rs = (sec_idx / bench.reindex(sec_idx.index)).dropna()
        if len(rs) < 90:
            continue
        rs_ratio = (100 * rs / rs.rolling(63).mean()).dropna()
        rs_mom = (100 * rs_ratio / rs_ratio.shift(10)).dropna()
        joined = pd.concat({"ratio": rs_ratio, "mom": rs_mom}, axis=1).dropna()
        if len(joined) < trail_points * step_days:
            continue
        samples = joined.iloc[::-1].iloc[::step_days].iloc[:trail_points].iloc[::-1]
        trail = [{"x": round(float(p.ratio), 3), "y": round(float(p.mom), 3),
                  "date": str(idx.date())}
                 for idx, p in samples.iterrows()]
        x, y = trail[-1]["x"], trail[-1]["y"]
        quadrant = ("leading" if x >= 100 and y >= 100 else
                    "weakening" if x >= 100 else
                    "improving" if y >= 100 else "lagging")
        changed = [m["change_pct"] for m in members if m.get("change_pct") is not None]
        scores = [m["score"] for m in members if m.get("score") is not None]
        sectors.append({
            "sector": sec,
            "members": len(members),
            "market_cap": sum(m.get("market_cap") or 0 for m in members),
            "avg_change_pct": round(sum(changed) / len(changed), 2) if changed else None,
            "avg_score": round(sum(scores) / len(scores), 1) if scores else None,
            "rs_ratio": x, "rs_momentum": y,
            "quadrant": quadrant,
            "trail": trail,
        })

    sectors.sort(key=lambda s: s["market_cap"], reverse=True)
    data = {"as_of": as_of, "sectors": sectors}
    _sector_rotation_cache.update(at=now, data=data)
    return data


def get_history(symbol: str, min_rows: int = 200) -> pd.Series | None:
    """Daily close series for a symbol. Universe symbols come from the store
    snapshot (no I/O). Unknown symbols fall back to a cached single fetch —
    the only path that may touch the network, used by background jobs and
    the on-demand factor/forecast computations."""
    with store.lock:
        closes = store.closes
    if closes is not None and symbol in closes.columns:
        s = closes[symbol].dropna()
        if len(s) >= min_rows:
            return s
    if symbol in store.history_cache:
        return store.history_cache[symbol]
    frame = _download_closes([symbol], period="2y")
    if frame.empty or symbol not in frame.columns:
        return None
    s = frame[symbol].dropna()
    store.history_cache[symbol] = s
    return s


def get_index_history() -> pd.Series | None:
    return get_history(INDEX_SYMBOL, min_rows=100)


def get_quote(symbol: str) -> dict | None:
    """Instant quote: fast-lane cache first, then universe snapshot."""
    if symbol in store.quote_cache:
        return store.quote_cache[symbol]
    with store.lock:
        closes = store.closes
        as_of = store.as_of
    if closes is not None and symbol in closes.columns:
        s = closes[symbol].dropna()
        if len(s) >= 2:
            return {
                "symbol": symbol,
                "price": float(s.iloc[-1]),
                "change_pct": float((s.iloc[-1] / s.iloc[-2] - 1) * 100),
                "as_of": as_of,
            }
    return None


def get_sparkline(symbol: str, points: int = 30) -> list[float]:
    with store.lock:
        closes = store.closes
    src = None
    if closes is not None and symbol in closes.columns:
        src = closes[symbol].dropna()
    elif symbol in store.history_cache:
        src = store.history_cache[symbol]
    if src is None or src.empty:
        return []
    tail = src.tail(points)
    return [round(float(v), 2) for v in tail.tolist()]


def get_ohlc(symbol: str, period: str = "1y", interval: str = "1d") -> dict | None:
    """OHLCV arrays for candlestick charts. Cached 5 min; the fetch itself
    must run off the event loop (call via run_in_executor)."""
    key = (symbol, period, interval)
    if key in store.ohlc_cache:
        return store.ohlc_cache[key]
    try:
        df = yf.Ticker(symbol).history(period=period, interval=interval, auto_adjust=True)
    except Exception:
        logger.exception("OHLC fetch failed for %s", symbol)
        return None
    if df is None or df.empty:
        return None
    df = df.dropna(subset=["Open", "High", "Low", "Close"])
    idx = pd.to_datetime(df.index)
    intraday = interval.endswith(("m", "h"))
    times = [int(ts.timestamp()) for ts in idx] if intraday \
        else [ts.strftime("%Y-%m-%d") for ts in idx]
    close = df["Close"]
    result = {
        "symbol": symbol, "period": period, "interval": interval,
        "time": times,
        "open": [round(float(v), 2) for v in df["Open"]],
        "high": [round(float(v), 2) for v in df["High"]],
        "low": [round(float(v), 2) for v in df["Low"]],
        "close": [round(float(v), 2) for v in close],
        "volume": [int(v) if np.isfinite(v) else 0 for v in df.get("Volume", pd.Series(0, index=df.index))],
        "ma20": [round(float(v), 2) if np.isfinite(v) else None for v in close.rolling(20).mean()],
        "ma50": [round(float(v), 2) if np.isfinite(v) else None for v in close.rolling(50).mean()],
        "ma200": [round(float(v), 2) if np.isfinite(v) else None for v in close.rolling(200).mean()],
    }
    store.ohlc_cache[key] = result
    return result


def get_fundamental(symbol: str) -> dict:
    """Fundamentals dict for any symbol: universe store first, then a cached
    on-demand fetch (network — call via run_in_executor for cold symbols)."""
    with store.lock:
        if symbol in store.fundamentals:
            return store.fundamentals[symbol]
    if symbol in store.fund_cache:
        return store.fund_cache[symbol]
    _, data = _fetch_one_fundamental(symbol)
    if data:
        store.fund_cache[symbol] = data
    return data


def get_screener_row(symbol: str) -> dict | None:
    with store.lock:
        for row in store.screener_rows:
            if row["symbol"] == symbol:
                return row
    return None


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

def get_universe_names() -> dict[str, str]:
    return UNIVERSE_NAMES


def _warmup() -> None:
    refresh_indices()           # dashboard hero cards first (seconds, not minutes)
    refresh_universe()          # chunked; screener fills progressively
    refresh_fast_lane()
    # Pre-compute forecasts for watchlist symbols so their pages open instantly
    try:
        from modules import forecast_engine
        forecast_engine.precompute_watchlist()
    except Exception:
        logger.exception("Watchlist forecast precompute failed")
    refresh_fundamentals()      # slow for full NSE; ratios upgrade in place
    logger.info("Warm-up complete")


def start() -> None:
    """Kick off warm-up thread + recurring jobs. Called from FastAPI lifespan."""
    global _scheduler
    if _scheduler is not None:
        return
    import os
    syms, names = load_nse_universe()
    prio = [x for x in FALLBACK_UNIVERSE if x in set(syms)] or []
    rest = [x for x in syms if x not in set(prio)]
    syms = prio + rest       # famous names score within the first chunk
    UNIVERSE.clear(); UNIVERSE.extend(syms)
    UNIVERSE_NAMES.clear(); UNIVERSE_NAMES.update(names)

    # Load snapshots synchronously so Vercel doesn't freeze the thread
    with store.lock:
        store.status = "warming"
        store.progress = 0.02
    _load_snapshots()

    # Vercel freezes background threads, so don't spawn them on Vercel
    if os.environ.get("VERCEL"):
        logger.info("Running on Vercel: background threads disabled.")
        return

    threading.Thread(target=_warmup, name="market-warmup", daemon=True).start()
    if BackgroundScheduler is not None:
        _scheduler = BackgroundScheduler(daemon=True)
        _scheduler.add_job(refresh_universe, "interval", minutes=UNIVERSE_REFRESH_MIN,
                           id="universe", max_instances=1, coalesce=True)
        _scheduler.add_job(refresh_fundamentals, "interval", hours=FUNDAMENTALS_REFRESH_HRS,
                           id="fundamentals", max_instances=1, coalesce=True)
        _scheduler.add_job(refresh_fast_lane, "interval", seconds=FAST_LANE_REFRESH_SEC,
                           id="fastlane", max_instances=1, coalesce=True)
        _scheduler.add_job(refresh_indices, "interval", minutes=5,
                           id="indices", max_instances=1, coalesce=True)
        _scheduler.start()
        logger.info("Market scheduler started")


def stop() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
