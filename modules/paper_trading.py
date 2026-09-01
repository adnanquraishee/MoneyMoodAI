"""Paper trading: a simulated ₹1,00,000 portfolio persisted to JSON, in the
same no-database style as the watchlist.

The teaching mechanic is the `reason` on every trade. A learner writes why
they are buying at the moment they buy; the UI later shows that reason next
to what the position actually did. Seeing "cheap P/E" beside a −12% is the
kind of lesson no explanation can deliver.
"""

import json
import logging
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_FILE = _DATA_DIR / "paper_portfolio.json"
_lock = threading.Lock()

STARTING_CASH = 100_000.0


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fresh(nifty_price: float | None) -> dict:
    return {
        "started_at": _now(),
        "starting_cash": STARTING_CASH,
        "cash": STARTING_CASH,
        # Index level when the portfolio began, so "did I beat the market" is
        # measured over exactly the period the learner was investing.
        "nifty_start": nifty_price,
        "holdings": {},   # symbol -> {qty, avg_cost, name}
        "trades": [],     # newest last
    }


def _load(nifty_price: float | None = None) -> dict:
    if _FILE.exists():
        try:
            return json.loads(_FILE.read_text())
        except Exception:
            logger.exception("Corrupt paper portfolio; starting fresh")
    return _fresh(nifty_price)


def _save(data: dict) -> None:
    _DATA_DIR.mkdir(exist_ok=True)
    tmp = _FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2))
    tmp.replace(_FILE)


def get_state(nifty_price: float | None = None) -> dict:
    with _lock:
        data = _load(nifty_price)
        if data.get("nifty_start") is None and nifty_price is not None:
            data["nifty_start"] = nifty_price
            _save(data)
        return data


def reset(nifty_price: float | None) -> dict:
    with _lock:
        data = _fresh(nifty_price)
        _save(data)
        return data


class TradeError(ValueError):
    pass


def trade(symbol: str, side: str, qty: int, price: float, reason: str,
          name: str | None = None, nifty_price: float | None = None) -> dict:
    """Apply a buy or sell at `price`. Raises TradeError on an invalid order."""
    symbol = symbol.strip().upper()
    side = side.lower()
    if side not in ("buy", "sell"):
        raise TradeError("side must be 'buy' or 'sell'")
    if qty <= 0:
        raise TradeError("quantity must be positive")
    if price <= 0:
        raise TradeError("no valid price for this symbol")
    reason = (reason or "").strip()
    if len(reason) < 8:
        raise TradeError("write a reason of at least a few words — it is the point of the exercise")

    with _lock:
        data = _load(nifty_price)
        holdings = data["holdings"]
        cost = qty * price

        if side == "buy":
            if cost > data["cash"] + 1e-6:
                raise TradeError(
                    f"not enough cash: need ₹{cost:,.0f}, have ₹{data['cash']:,.0f}")
            h = holdings.get(symbol)
            if h:
                total_qty = h["qty"] + qty
                h["avg_cost"] = (h["qty"] * h["avg_cost"] + cost) / total_qty
                h["qty"] = total_qty
            else:
                holdings[symbol] = {"qty": qty, "avg_cost": price, "name": name or symbol}
            data["cash"] -= cost
        else:
            h = holdings.get(symbol)
            if not h or h["qty"] < qty:
                held = h["qty"] if h else 0
                raise TradeError(f"cannot sell {qty}: only {held} held")
            h["qty"] -= qty
            data["cash"] += cost
            if h["qty"] == 0:
                del holdings[symbol]

        data["trades"].append({
            "id": uuid.uuid4().hex[:10],
            "ts": _now(),
            "symbol": symbol,
            "name": name or symbol,
            "side": side,
            "qty": qty,
            "price": price,
            "reason": reason,
        })
        _save(data)
        return data
