"""Watchlist persistence: a thread-safe JSON file. No database needed."""

import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_FILE = _DATA_DIR / "watchlist.json"
_lock = threading.Lock()

DEFAULT_SYMBOLS = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS"]


def _load() -> dict:
    if _FILE.exists():
        try:
            return json.loads(_FILE.read_text())
        except Exception:
            logger.exception("Corrupt watchlist file; starting fresh")
    return {"items": [{"symbol": s, "added_at": None, "note": ""} for s in DEFAULT_SYMBOLS]}


def _save(data: dict) -> None:
    _DATA_DIR.mkdir(exist_ok=True)
    tmp = _FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2))
    tmp.replace(_FILE)


def get_items() -> list[dict]:
    with _lock:
        return list(_load()["items"])


def get_symbols() -> list[str]:
    return [item["symbol"] for item in get_items()]


def add(symbol: str, note: str = "") -> list[dict]:
    symbol = symbol.strip().upper()
    with _lock:
        data = _load()
        if not any(i["symbol"] == symbol for i in data["items"]):
            data["items"].append({
                "symbol": symbol,
                "added_at": datetime.now(timezone.utc).isoformat(),
                "note": note,
            })
            _save(data)
        return list(data["items"])


def remove(symbol: str) -> list[dict]:
    symbol = symbol.strip().upper()
    with _lock:
        data = _load()
        data["items"] = [i for i in data["items"] if i["symbol"] != symbol]
        _save(data)
        return list(data["items"])
