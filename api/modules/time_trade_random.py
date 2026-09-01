"""Random Try-Trade-in-Time cases, computed rather than curated.

A random mid- or large-cap is drawn from the universe, a decision date is
drawn from the window where Yahoo's annual statements exist, and the whole
dossier is rebuilt from data as it stood on that date:

  * valuation and profitability from the latest fiscal year reported before
    the date (P/E, PEG, P/B, ROE, margins, growth, debt, dividend yield);
  * risk and performance from the price series up to that date (Sharpe,
    beta, alpha, momentum, RSI, volatility, drawdown);
  * a "market backdrop" written from index and price data, because there is
    no dated-headline source — and the UI says so.

Nothing here is typed in by hand, which is the point: every draw is a real
company on a real day, with numbers that were genuinely knowable then.
"""

import logging
import random
import threading
import uuid
from datetime import date, datetime, timedelta

import numpy as np
import pandas as pd

from modules import market_cache
from modules import time_trade as tt

logger = logging.getLogger(__name__)

RISK_FREE = 0.065
MIN_MCAP_CR = 10_000           # mid-cap and up: statements are reliable there
MIN_MONTHS_AGO = 14            # outcome long enough to mean something
MAX_MONTHS_AGO = 42
REPORTING_LAG_DAYS = 60        # an FY ending 31 Mar is public by ~end May
MAX_ATTEMPTS = 8

_lock = threading.Lock()
_stmt_cache: dict[str, dict] = {}
_raw_close_cache: dict[str, pd.Series] = {}
_div_cache: dict[str, pd.Series] = {}


# ---------------------------------------------------------------- fetching
def _statements(symbol: str) -> dict | None:
    with _lock:
        if symbol in _stmt_cache:
            return _stmt_cache[symbol]
    try:
        import yfinance as yf
        t = yf.Ticker(symbol)
        inc, bs = t.income_stmt, t.balance_sheet
        div = t.dividends
        raw = t.history(period="max", auto_adjust=False)
    except Exception:
        logger.exception("statements failed for %s", symbol)
        return None
    if inc is None or inc.empty or bs is None or bs.empty:
        return None
    out = {"inc": inc, "bs": bs}
    with _lock:
        _stmt_cache[symbol] = out
        if div is not None and len(div):
            d = div.copy()
            d.index = pd.to_datetime(d.index).tz_localize(None)
            _div_cache[symbol] = d
        if raw is not None and not raw.empty and "Close" in raw:
            s = raw["Close"].dropna()
            s.index = pd.to_datetime(s.index).tz_localize(None)
            _raw_close_cache[symbol] = s
    return out


def _row(df: pd.DataFrame, names: list[str], col) -> float | None:
    for n in names:
        if n in df.index:
            v = df.loc[n, col]
            if v is not None and not (isinstance(v, float) and np.isnan(v)):
                return float(v)
    return None


# --------------------------------------------------------------- candidates
def _candidates() -> list[str]:
    with market_cache.store.lock:
        funds = dict(market_cache.store.fundamentals)
    out = []
    for sym, f in funds.items():
        mc = f.get("market_cap")
        if isinstance(mc, (int, float)) and mc >= MIN_MCAP_CR * 1e7 and f.get("sector"):
            out.append(sym)
    return out


def _size_bucket(mcap_cr: float | None) -> str:
    if mcap_cr is None:
        return "Unknown size"
    if mcap_cr >= 50_000:
        return "Large-cap"
    if mcap_cr >= 15_000:
        return "Mid-cap"
    return "Small-cap"


# --------------------------------------------------------- fundamentals @ date
def _fundamentals_at(symbol: str, when: pd.Timestamp, raw_close: float) -> dict | None:
    st = _statements(symbol)
    if not st:
        return None
    inc, bs = st["inc"], st["bs"]
    cutoff = when - pd.Timedelta(days=REPORTING_LAG_DAYS)
    periods = sorted([c for c in inc.columns if pd.Timestamp(c) <= cutoff], reverse=True)
    if len(periods) < 2:
        return None
    fy, prev = periods[0], periods[1]
    if fy not in bs.columns:
        return None

    ni = _row(inc, ["Net Income Common Stockholders", "Net Income"], fy)
    ni_prev = _row(inc, ["Net Income Common Stockholders", "Net Income"], prev)
    rev = _row(inc, ["Total Revenue", "Operating Revenue"], fy)
    rev_prev = _row(inc, ["Total Revenue", "Operating Revenue"], prev)
    op = _row(inc, ["Operating Income", "EBIT"], fy)
    eps = _row(inc, ["Diluted EPS", "Basic EPS"], fy)
    equity = _row(bs, ["Stockholders Equity", "Common Stock Equity", "Total Equity Gross Minority Interest"], fy)
    debt = _row(bs, ["Total Debt"], fy)
    shares = _row(bs, ["Ordinary Shares Number", "Share Issued"], fy)
    if ni is None or equity is None or shares is None or shares <= 0:
        return None

    mcap = raw_close * shares
    pe = (raw_close / eps) if eps and eps > 0 else (mcap / ni if ni > 0 else None)
    eg = (ni / ni_prev - 1) if ni_prev and ni_prev > 0 and ni > 0 else None
    rg = (rev / rev_prev - 1) if rev and rev_prev and rev_prev > 0 else None
    peg = (pe / (eg * 100)) if pe and eg and eg > 0.02 else None

    div_ttm = 0.0
    d = _div_cache.get(symbol)
    if d is not None:
        div_ttm = float(d[(d.index > when - pd.Timedelta(days=365)) & (d.index <= when)].sum())
    dy = div_ttm / raw_close if raw_close > 0 else None

    return {
        "fy_end": pd.Timestamp(fy).strftime("%d %b %Y"),
        "mcap_cr": mcap / 1e7,
        "pe": pe, "peg": peg,
        "pb": (mcap / equity) if equity > 0 else None,
        "roe": ni / equity if equity > 0 else None,
        "profit_margin": ni / rev if rev else None,
        "operating_margin": op / rev if (op is not None and rev) else None,
        "revenue_growth": rg, "earnings_growth": eg,
        "debt_to_equity": (debt / equity) if (debt is not None and equity > 0) else None,
        "dividend_yield": dy,
    }


# ------------------------------------------------------------ risk @ date
def _risk_at(adj: pd.Series, idx: pd.Series, when: pd.Timestamp) -> dict:
    s = adj[(adj.index <= when) & (adj.index > when - pd.Timedelta(days=365))]
    m = idx[(idx.index <= when) & (idx.index > when - pd.Timedelta(days=365))]
    out: dict = {}
    if len(s) < 120:
        return out
    r = s.pct_change().dropna()
    ann_ret = float(s.iloc[-1] / s.iloc[0] - 1)
    vol = float(r.std() * np.sqrt(252))
    out["volatility"] = vol
    out["sharpe"] = (ann_ret - RISK_FREE) / vol if vol > 0 else None
    joined = pd.concat([r, m.pct_change().dropna()], axis=1, join="inner").dropna()
    if len(joined) > 60:
        cov = np.cov(joined.iloc[:, 0], joined.iloc[:, 1])
        beta = float(cov[0, 1] / cov[1, 1]) if cov[1, 1] > 0 else None
        out["beta"] = beta
        mkt_ret = float(m.iloc[-1] / m.iloc[0] - 1) if len(m) > 1 else None
        if beta is not None and mkt_ret is not None:
            out["alpha"] = ann_ret - (RISK_FREE + beta * (mkt_ret - RISK_FREE))
    # 12-1 momentum: skip the most recent month
    upto_1m = adj[adj.index <= when - pd.Timedelta(days=30)]
    from_12m = adj[adj.index <= when - pd.Timedelta(days=365)]
    if len(upto_1m) and len(from_12m):
        out["momentum"] = float(upto_1m.iloc[-1] / from_12m.iloc[-1] - 1)
    # RSI 14
    tail = adj[adj.index <= when].tail(60)
    delta = tail.diff().dropna()
    up, dn = delta.clip(lower=0), -delta.clip(upper=0)
    au, ad = up.ewm(alpha=1 / 14, adjust=False).mean().iloc[-1], dn.ewm(alpha=1 / 14, adjust=False).mean().iloc[-1]
    out["rsi"] = float(100 - 100 / (1 + au / ad)) if ad > 0 else 100.0
    dd = (s / s.cummax() - 1).min()
    out["max_drawdown_1y"] = float(dd)
    return out


# ------------------------------------------------------------ backdrop text
def _backdrop(idx: pd.Series, when: pd.Timestamp, pf: dict, risk: dict, fund: dict, sector: str) -> tuple[str, list[str]]:
    m = idx[(idx.index <= when) & (idx.index > when - pd.Timedelta(days=365))]
    lines: list[str] = []
    mkt_1y = float(m.iloc[-1] / m.iloc[0] - 1) * 100 if len(m) > 1 else None
    mkt_dd = float(m.iloc[-1] / m.max() - 1) * 100 if len(m) else None

    if mkt_1y is not None:
        if mkt_dd is not None and mkt_dd <= -12:
            ctx = f"The index is {abs(mkt_dd):.0f}% below its high of the past year — a correction is under way and sentiment is poor."
        elif mkt_1y >= 20:
            ctx = f"The market has had a strong year, up about {mkt_1y:.0f}%; optimism is broad and valuations are elevated."
        elif mkt_1y <= 0:
            ctx = f"A flat-to-down year for the index ({mkt_1y:+.0f}%); investors are cautious."
        else:
            ctx = f"An unremarkable year for the index, up about {mkt_1y:.0f}%."
    else:
        ctx = "Index context unavailable for this date."

    r1 = pf.get("ret_1y")
    if r1 is not None:
        if r1 >= 60:
            lines.append(f"The stock has roughly {1 + r1 / 100:.1f}× in a year — it is one of the market's talked-about winners.")
        elif r1 >= 20:
            lines.append(f"Up about {r1:.0f}% over the past year, comfortably ahead of the index.")
        elif r1 <= -30:
            lines.append(f"Down about {abs(r1):.0f}% over the past year; the stock is out of favour.")
        elif r1 < 0:
            lines.append(f"A weak year for the shares ({r1:+.0f}%).")
        else:
            lines.append(f"A modest year for the shares ({r1:+.0f}%).")
    hi = pf.get("pct_from_52w_high")
    if hi is not None:
        if hi >= -3:
            lines.append("Shares are at or within a whisker of their 52-week high.")
        elif hi <= -30:
            lines.append(f"Shares sit {abs(hi):.0f}% below their 52-week high.")
    beta = risk.get("beta")
    if beta is not None:
        if beta >= 1.4:
            lines.append(f"It moves far more than the market (beta ≈ {beta:.1f}); rallies and sell-offs are amplified here.")
        elif beta <= 0.7:
            lines.append(f"It has been a defensive name (beta ≈ {beta:.1f}), moving less than the market.")
    eg = fund.get("earnings_growth")
    if eg is not None:
        if eg >= 0.30:
            lines.append(f"Last fiscal year's profit grew about {eg * 100:.0f}% — the growth is what the market is paying for.")
        elif eg < 0:
            lines.append(f"Last fiscal year's profit fell about {abs(eg) * 100:.0f}%; the debate is whether that is cyclical or structural.")
    if fund.get("dividend_yield") and fund["dividend_yield"] >= 0.03:
        lines.append(f"It pays a meaningful dividend — about {fund['dividend_yield'] * 100:.1f}% at this price.")
    lines.append(f"Sector: {sector}. No dated headlines are available for this day; everything above is read from the data as it stood.")
    return ctx, lines


# ------------------------------------------------------------- the draw
def _fmt_x(v): return None if v is None else f"{v:.1f}×"
def _fmt_pct(v): return None if v is None else f"{v * 100:.1f}%"


def _facts(fund: dict, is_lender: bool) -> list[dict]:
    rows = [
        ("P/E (trailing FY)", "pe", _fmt_x(fund.get("pe")), None),
        ("PEG", "peg", _fmt_x(fund.get("peg")) if fund.get("peg") else ("n/a" if fund.get("pe") else None), "P/E ÷ profit growth" if fund.get("peg") else "no positive growth to divide by"),
        ("Price / Book", "pb", _fmt_x(fund.get("pb")), None),
        ("Return on Equity", "roe", _fmt_pct(fund.get("roe")), None),
        ("Net profit margin", "profit_margin", _fmt_pct(fund.get("profit_margin")), None),
        ("Operating margin", "operating_margin", _fmt_pct(fund.get("operating_margin")), None),
        ("Revenue growth (YoY)", "revenue_growth", _fmt_pct(fund.get("revenue_growth")), None),
        ("Profit growth (YoY)", "earnings_growth", _fmt_pct(fund.get("earnings_growth")), None),
        ("Debt / Equity", "debt_to_equity", "n/a (lender)" if is_lender else _fmt_x(fund.get("debt_to_equity")), "borrowing is a lender's raw material" if is_lender else None),
        ("Dividend yield", "dividend_yield", _fmt_pct(fund.get("dividend_yield")), "trailing 12 months"),
    ]
    out = []
    for label, term, value, note in rows:
        if value is None:
            continue
        d = {"label": label, "term": term, "value": value}
        if note:
            d["note"] = note
        out.append(d)
    return out


def draw(exclude: set[str] | None = None, use_pool: bool = True) -> dict | None:
    """One random case: from the pre-built pool when it exists, otherwise
    generated live.

    `use_pool=False` forces live generation — the offline pool builder needs
    that, since reading the pool it is trying to write would just recycle
    whatever is already there."""
    from modules import time_trade as _tt
    p = _tt.pool() if use_pool else {"random": []}
    if p["random"]:
        ex = exclude or set()
        # `exclude` holds symbols already revealed this session.
        choices = [cid for cid in p["random"]
                   if (p["by_id"][cid].get("_reveal") or {}).get("symbol") not in ex]
        if not choices:
            choices = p["random"]          # seen them all — start over
        pick = p["by_id"][random.Random().choice(choices)]
        return {k: v for k, v in pick.items() if k != "_reveal"}

    pool = _candidates()
    if not pool:
        return None
    exclude = exclude or set()
    idx = tt._history(tt.NIFTY, "2015-01-01")
    if idx is None:
        return None
    rng = random.Random()
    tried = 0
    while tried < MAX_ATTEMPTS:
        tried += 1
        sym = rng.choice(pool)
        if sym in exclude:
            continue
        adj = tt._history(sym, "2019-01-01")
        if adj is None or len(adj) < 600:
            continue
        st = _statements(sym)
        if not st:
            continue
        raw = _raw_close_cache.get(sym)
        if raw is None:
            continue
        periods = sorted(pd.Timestamp(c) for c in st["inc"].columns)
        if len(periods) < 2:
            continue
        # Window: second-oldest FY must be reportable, and the outcome must have room to play out.
        earliest = max(periods[1] + pd.Timedelta(days=REPORTING_LAG_DAYS),
                       pd.Timestamp(date.today() - timedelta(days=30 * MAX_MONTHS_AGO)))
        latest = pd.Timestamp(date.today() - timedelta(days=30 * MIN_MONTHS_AGO))
        if earliest >= latest:
            continue
        span = (latest - earliest).days
        when = earliest + pd.Timedelta(days=rng.randint(0, span))
        at = tt._at(adj, when.strftime("%Y-%m-%d"))
        raw_at = tt._at(raw, when.strftime("%Y-%m-%d"))
        if not at or not raw_at:
            continue
        when = at[0]
        fund = _fundamentals_at(sym, when, raw_at[1])
        if not fund or fund.get("pe") is None:
            continue
        pf = tt._price_facts(adj, when)
        risk = _risk_at(adj, idx, when)
        with market_cache.store.lock:
            meta = dict(market_cache.store.fundamentals.get(sym, {}))
        sector = meta.get("sector") or "Unknown sector"
        industry = meta.get("industry") or ""
        is_lender = sector == "Financial Services" and any(k in industry.lower() for k in ("bank", "credit", "lending", "finance", "mortgage"))
        ctx, backdrop = _backdrop(idx, when, pf, risk, fund, sector)
        nifty_then = tt._at(idx, when.strftime("%Y-%m-%d"))
        nifty_facts = tt._price_facts(idx, nifty_then[0]) if nifty_then else {}

        case_id = f"rnd-{uuid.uuid4().hex[:10]}"
        label = industry or sector
        case = {
            "id": case_id,
            "kind": "random",
            "symbol": sym,
            "name": meta.get("name") or sym.replace(".NS", ""),
            "date": when.strftime("%Y-%m-%d"),
            "sector": label,
            "size": _size_bucket(fund.get("mcap_cr")),
            "teaser": "",
            "context": ctx,
            "facts": _facts(fund, is_lender),
            "news": backdrop,
            "news_kind": "data",
            "fiscal_note": f"Financials from the fiscal year ended {fund['fy_end']} — the latest reported before this date. Computed from statements, not typed in.",
            "risk_facts": {k: (round(v, 4) if isinstance(v, float) else v) for k, v in risk.items()},
            "what_happened": "",
            "lesson": "",
            "_fund": fund,
        }
        tt.register_generated(case)
        return {
            "id": case_id,
            "kind": "random",
            "date": case["date"],
            "period_label": when.strftime("%d %B %Y"),
            "sector": label,
            "size": case["size"],
            "context": ctx,
            "facts": case["facts"],
            "news": backdrop,
            "news_kind": "data",
            "fiscal_note": case["fiscal_note"],
            "risk_facts": case["risk_facts"],
            "price_then": round(at[1], 2),
            "price_facts": pf,
            "nifty_ret_1y": nifty_facts.get("ret_1y"),
            "years_ago": round((date.today() - when.date()).days / 365.25, 1),
        }
    logger.warning("random case: no valid draw after %d attempts", tried)
    return None
