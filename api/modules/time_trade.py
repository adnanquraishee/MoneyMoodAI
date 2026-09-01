"""Try Trade in Time: blind historical decisions with real outcomes.

The learner sees a company's situation on a past date — its financials as
reported around then, and what the news was saying — without its name. They
decide whether to invest and how much. We then replay real prices to today
and reveal the company, the price now, and the profit or loss.

Two kinds of data, kept deliberately separate:
  * The dossier (financials, news) is CURATED. There is no free source of a
    company's P/E or headlines on an arbitrary past date, so each case is
    written by hand from reported financials and contemporary coverage,
    with figures rounded and labelled approximate.
  * The outcome is COMPUTED from real price history on demand, never typed
    in. Whatever the market did is what the learner sees.
"""

import logging
import threading
from datetime import date, datetime

import pandas as pd

logger = logging.getLogger(__name__)

NIFTY = "^NSEI"

# ---------------------------------------------------------------------------
# Case library. `symbol` and `name` never leave the server until /decide.
# `facts` is an ordered list so bank-specific lines (NPA, loan growth) sit
# beside universal ones; `term` links a line to its metric lesson in the UI.
# ---------------------------------------------------------------------------
CASES: list[dict] = [
    {
        "id": "case-01",
        "symbol": "YESBANK.NS",
        "name": "Yes Bank",
        "date": "2018-08-20",
        "sector": "Private sector bank",
        "size": "Large-cap",
        "teaser": "The fastest-growing bank in the country, trading cheaper than its peers.",
        "context": "NIFTY is near an all-time high. Private banks are the market's favourite sector; this one has grown its loan book faster than any of them.",
        "facts": [
            {"label": "P/E (trailing)", "term": "pe", "value": "≈ 19×", "note": "below the ~25× of larger private-bank peers"},
            {"label": "Price / Book", "term": "pb", "value": "≈ 3.4×"},
            {"label": "Return on Equity", "term": "roe", "value": "≈ 17%"},
            {"label": "Loan growth (YoY)", "value": "≈ 50%", "note": "roughly double the industry"},
            {"label": "Gross bad loans", "value": "≈ 1.3%", "note": "reported; among the lowest in the sector"},
            {"label": "Dividend yield", "term": "dividend_yield", "value": "≈ 0.7%"},
            {"label": "Latest quarterly profit", "term": "earnings_growth", "value": "+31% YoY"},
        ],
        "news": [
            "Quarterly profit up about 31%, beating estimates; loan book up roughly 50% in a year.",
            "Widely described as the fastest-growing private bank; several brokerages have it as a top pick.",
            "The regulator had earlier found the bank under-reported bad loans for two consecutive years; management says the gap has been closed.",
            "The chief executive's reappointment is awaiting the regulator's approval — seen by most as a formality.",
            "Shares are trading close to their all-time high.",
        ],
        "what_happened": "Within three weeks the regulator refused to extend the CEO's term. Over the following year the true scale of bad loans emerged; the bank was placed under a moratorium in March 2020 and rescued by a consortium led by SBI, with existing shareholders heavily diluted.",
        "lesson": "Cheap-for-its-growth was the wrong frame. The question was why a regulator had twice found the bad-loan numbers understated — and the market's discount was the answer, not a mistake.",
    },
    {
        "id": "case-02",
        "symbol": "TITAN.NS",
        "name": "Titan Company",
        "date": "2015-09-01",
        "sector": "Jewellery & watches retailer",
        "size": "Large-cap",
        "teaser": "A well-run retailer at nearly forty times earnings, with flat profits.",
        "context": "Gold demand is weak. Government rules on gold purchases and imports are tightening, and the market is asking whether a jeweller deserves a premium valuation.",
        "facts": [
            {"label": "P/E (trailing)", "term": "pe", "value": "≈ 38×", "note": "roughly double the market"},
            {"label": "Return on Equity", "term": "roe", "value": "≈ 24%"},
            {"label": "Revenue growth", "term": "revenue_growth", "value": "≈ 3%", "note": "flat, held back by gold regulation"},
            {"label": "Earnings growth", "term": "earnings_growth", "value": "≈ 0%"},
            {"label": "Debt / Equity", "term": "debt_to_equity", "value": "≈ 0.1×"},
            {"label": "Dividend yield", "term": "dividend_yield", "value": "≈ 0.7%"},
        ],
        "news": [
            "Jewellery demand has been soft for several quarters; gold import curbs and new identity rules on purchases are weighing on sales.",
            "Management is launching a gold-exchange scheme and expanding stores, betting that organised retail will keep taking share from local jewellers.",
            "Several analysts call the valuation stretched for a company with flat earnings.",
            "The watches business is steady; the jewellery business, the larger part, is the one under pressure.",
        ],
        "what_happened": "Growth resumed as regulation settled and organised jewellery kept taking share. Earnings compounded for a decade and the share price rose many times over. The P/E stayed high the whole way.",
        "lesson": "A high P/E on temporarily flat earnings is different from a high P/E on permanently flat earnings. The question was whether the growth engine was broken or merely paused — and 'expensive' answered neither.",
    },
    {
        "id": "case-03",
        "symbol": "ITC.NS",
        "name": "ITC",
        "date": "2017-07-10",
        "sector": "Tobacco & consumer goods conglomerate",
        "size": "Large-cap",
        "teaser": "A debt-free cash machine at an all-time high, days after a major tax reform.",
        "context": "GST has just been introduced nationwide. The stock rallied into it on the view that the new regime is neutral-to-positive for its main product.",
        "facts": [
            {"label": "P/E (trailing)", "term": "pe", "value": "≈ 33×"},
            {"label": "Return on Equity", "term": "roe", "value": "≈ 23%"},
            {"label": "Net profit margin", "term": "profit_margin", "value": "≈ 25%"},
            {"label": "Earnings growth", "term": "earnings_growth", "value": "≈ 10%"},
            {"label": "Debt / Equity", "term": "debt_to_equity", "value": "≈ 0"},
            {"label": "Dividend yield", "term": "dividend_yield", "value": "≈ 1.7%"},
            {"label": "Share of profit from one product", "value": "≈ 85%", "note": "cigarettes"},
        ],
        "news": [
            "Shares touched a record high this month as investors concluded the new indirect-tax regime would not hurt cigarette pricing.",
            "The company is pushing hard into packaged foods, hotels and paper to reduce dependence on tobacco.",
            "Some fund managers avoid the stock on environmental and social grounds regardless of the numbers.",
            "Tax rates on tobacco have historically been revised upward at short notice.",
        ],
        "what_happened": "A week later the GST Council raised the additional cess on cigarettes. The stock fell about 12% in a single day. It then traded sideways to down for roughly five years while the market rose, before re-rating sharply from 2022.",
        "lesson": "When most of the profit comes from one product whose price is set by tax policy, the P/E is not the risk — the next council meeting is. Concentration risk does not show up in any ratio.",
    },
    {
        "id": "case-04",
        "symbol": "EICHERMOT.NS",
        "name": "Eicher Motors (Royal Enfield)",
        "date": "2017-10-02",
        "sector": "Premium motorcycles",
        "size": "Large-cap",
        "teaser": "Waiting lists measured in months, returns on equity above thirty percent, forty-five times earnings.",
        "context": "One of the decade's great growth stories. Customers wait months for delivery; the company cannot build bikes fast enough.",
        "facts": [
            {"label": "P/E (trailing)", "term": "pe", "value": "≈ 45×"},
            {"label": "Return on Equity", "term": "roe", "value": "≈ 35%"},
            {"label": "Volume growth (YoY)", "term": "revenue_growth", "value": "≈ 20%+"},
            {"label": "Operating margin", "term": "operating_margin", "value": "≈ 30%", "note": "exceptional for a manufacturer"},
            {"label": "Debt / Equity", "term": "debt_to_equity", "value": "≈ 0"},
            {"label": "Dividend yield", "term": "dividend_yield", "value": "≈ 0.3%"},
        ],
        "news": [
            "New larger-engine models unveiled to strong reviews; export ambitions growing.",
            "A new plant is being commissioned to clear the order backlog.",
            "Brokerages describe it as the best-quality business in Indian autos; a few flag that the valuation assumes growth continues for years.",
            "Rivals have announced competing premium models for the coming year.",
        ],
        "what_happened": "Growth stalled within a year as the backlog cleared, competition arrived and the two-wheeler market slowed. The stock roughly halved over the next two years, then recovered strongly after 2020 as demand returned.",
        "lesson": "Exceptional margins and a waiting list are exactly what attracts competition and capacity. The number that mattered was not the ROE but the question of what happens to a 45× P/E when growth pauses.",
    },
    {
        "id": "case-05",
        "symbol": "ETERNAL.NS",
        "name": "Zomato (now Eternal)",
        "date": "2022-07-26",
        "sector": "Food delivery platform",
        "size": "Mid-cap (recently large-cap)",
        "teaser": "Losing money, down about half since listing, and its early investors are free to sell today.",
        "context": "Loss-making technology companies are being sold worldwide as interest rates rise. This one's one-year IPO lock-in for pre-listing investors has just expired.",
        "facts": [
            {"label": "P/E", "term": "pe", "value": "n/a", "note": "loss-making"},
            {"label": "Price / Sales", "term": "ps", "value": "≈ 5×"},
            {"label": "Revenue growth", "term": "revenue_growth", "value": "≈ 60%+"},
            {"label": "Net result", "term": "profit_margin", "value": "loss", "note": "narrowing quarter on quarter"},
            {"label": "Cash on hand", "value": "≈ ₹12,000 cr", "note": "no debt"},
            {"label": "Fall from listing-day high", "term": "pct_52w_high", "value": "≈ −75%"},
        ],
        "news": [
            "Pre-IPO investors can sell from this week; the stock has fallen sharply in anticipation.",
            "The recent acquisition of a quick-commerce business was criticised as an expensive distraction from reaching profitability.",
            "Management says the core food business will be profitable within a few quarters; many analysts are sceptical.",
            "Global peers have fallen 60–80% from their highs over the past year.",
        ],
        "what_happened": "The core business turned profitable the following year, the quick-commerce acquisition became the growth engine, and the stock rose several-fold from this level.",
        "lesson": "With no earnings, every valuation ratio goes silent and sentiment sets the price — in both directions. The decision could only rest on cash runway and whether the losses were shrinking; the P/E had nothing to say.",
    },
    {
        "id": "case-06",
        "symbol": "HDFCBANK.NS",
        "name": "HDFC Bank",
        "date": "2020-03-23",
        "sector": "Private sector bank",
        "size": "Large-cap",
        "teaser": "The country's most consistently profitable bank, at its cheapest valuation in a decade — on the worst day of a crash.",
        "context": "The index has fallen about 38% in five weeks. A nationwide lockdown is expected to be announced within days. Nobody knows how many borrowers will be able to repay.",
        "facts": [
            {"label": "P/E (trailing)", "term": "pe", "value": "≈ 15×", "note": "versus ≈ 25× a year earlier"},
            {"label": "Price / Book", "term": "pb", "value": "≈ 2.5×"},
            {"label": "Return on Equity", "term": "roe", "value": "≈ 16%"},
            {"label": "Gross bad loans", "value": "≈ 1.4%"},
            {"label": "Deposit growth (YoY)", "value": "≈ 24%"},
            {"label": "Earnings growth", "term": "earnings_growth", "value": "≈ 20%", "note": "over the previous decade, almost without interruption"},
        ],
        "news": [
            "Markets have suffered their worst month on record; circuit breakers were triggered twice this month.",
            "A moratorium on loan repayments is being discussed; banks may have to absorb months of missed payments.",
            "Foreign investors are withdrawing at a record pace.",
            "A few veteran investors are publicly calling this a generational buying opportunity; most commentary is about how much worse it could get.",
        ],
        "what_happened": "The lockdown was announced the next day and the market bottomed that week. The bank's bad loans rose only modestly. The stock recovered its losses within a year and went on to new highs.",
        "lesson": "Nothing about the company had changed — only the price, and the mood. The ratios were the clearest signal available precisely because everyone was too frightened to read them.",
    },
    {
        "id": "case-07",
        "symbol": "VAKRANGEE.NS",
        "name": "Vakrangee",
        "date": "2018-01-15",
        "sector": "Technology-enabled retail kiosks",
        "size": "Large-cap",
        "teaser": "Tens of thousands of outlets, thirty percent growth, and a share price up ten-fold in three years.",
        "context": "A small-town retail network that has become one of the market's most celebrated growth stories. Big-name partnerships are announced almost monthly.",
        "facts": [
            {"label": "P/E (trailing)", "term": "pe", "value": "≈ 45×"},
            {"label": "Return on Equity", "term": "roe", "value": "≈ 28%", "note": "as reported"},
            {"label": "Earnings growth", "term": "earnings_growth", "value": "≈ 30%+"},
            {"label": "Debt / Equity", "term": "debt_to_equity", "value": "≈ 0"},
            {"label": "Outlets claimed", "value": "≈ 45,000", "note": "target 75,000"},
            {"label": "3-year share price gain", "term": "momentum", "value": "≈ 10×"},
        ],
        "news": [
            "Partnership announced with a large global e-commerce company to use its outlets as pickup points.",
            "Several brokerages have initiated coverage with buy ratings and ambitious targets.",
            "A minority of analysts question whether the outlet count and cash balances can be verified independently.",
            "The company has announced a large buyback and a special dividend.",
        ],
        "what_happened": "Within weeks, questions about the accounts intensified and the shares began falling daily. In April the auditor resigned, citing concerns about the reliability of the company's records. The stock fell roughly 90% from this level.",
        "lesson": "Every ratio here was excellent — and every one of them was built from numbers that turned out not to be reliable. When returns look too good for the business model, the first question is whether the accounts are real.",
    },
    {
        "id": "case-08",
        "symbol": "IRCTC.NS",
        "name": "IRCTC",
        "date": "2021-10-18",
        "sector": "Rail ticketing & catering (state-owned monopoly)",
        "size": "Large-cap",
        "teaser": "A monopoly on online train tickets, and a share price up about ten times in eighteen months.",
        "context": "Travel is recovering after the pandemic. Retail investors have piled into this stock; it is among the most-discussed names in the market.",
        "facts": [
            {"label": "P/E (trailing)", "term": "pe", "value": "≈ 150×+", "note": "trailing earnings still depressed by the pandemic"},
            {"label": "Return on Equity", "term": "roe", "value": "≈ 15%", "note": "pandemic-hit; was ≈ 30% before"},
            {"label": "Debt / Equity", "term": "debt_to_equity", "value": "≈ 0"},
            {"label": "Market share, online rail tickets", "value": "100%"},
            {"label": "Government ownership", "value": "≈ 67%"},
            {"label": "18-month share price gain", "term": "momentum", "value": "≈ 10×"},
        ],
        "news": [
            "A share split has been announced, widely expected to draw in more small investors.",
            "Passenger volumes are approaching pre-pandemic levels; catering and tourism are restarting.",
            "The stock has become a retail favourite; brokers report it among the most-bought names.",
            "A few analysts note that the convenience fee on tickets — a large part of profit — is set at the government's discretion.",
        ],
        "what_happened": "Eleven days later the government ordered the company to hand over half of its convenience-fee revenue. The stock fell about 25% within a day. The order was withdrawn the next morning, but the shares never regained their peak.",
        "lesson": "A monopoly granted by the state can be re-priced by the state. At 150× earnings, the price assumed the arrangement was permanent; the owner had never promised that.",
    },
]

_CASE_BY_ID = {c["id"]: c for c in CASES}

# Random draws (time_trade_random.py) register here so /case and /decide can
# serve them exactly like curated ones. Bounded so a long-running process
# does not accumulate every draw ever made.
_GENERATED: dict[str, dict] = {}
_GENERATED_MAX = 500


def register_generated(case: dict) -> None:
    if len(_GENERATED) >= _GENERATED_MAX:
        for k in list(_GENERATED)[: _GENERATED_MAX // 5]:
            _GENERATED.pop(k, None)
    _GENERATED[case["id"]] = case


def _lookup(case_id: str) -> dict | None:
    return _CASE_BY_ID.get(case_id) or _GENERATED.get(case_id)

# ---------------------------------------------------------------------------
# Price history: one full-length download per symbol, cached for the process.
# ---------------------------------------------------------------------------
_hist_lock = threading.Lock()
_hist_cache: dict[str, pd.Series] = {}


def _history(symbol: str) -> pd.Series | None:
    with _hist_lock:
        if symbol in _hist_cache:
            return _hist_cache[symbol]
    try:
        import yfinance as yf
        h = yf.Ticker(symbol).history(period="max", auto_adjust=True)
    except Exception:
        logger.exception("history download failed for %s", symbol)
        return None
    if h is None or h.empty or "Close" not in h:
        return None
    s = h["Close"].dropna()
    s.index = pd.to_datetime(s.index).tz_localize(None)
    with _hist_lock:
        _hist_cache[symbol] = s
    return s


def _at(s: pd.Series, d: str) -> tuple[pd.Timestamp, float] | None:
    """First trading day on or after `d`."""
    after = s[s.index >= pd.Timestamp(d)]
    if after.empty:
        return None
    return after.index[0], float(after.iloc[0])


def _pct(a: float | None, b: float | None) -> float | None:
    if not a or not b:
        return None
    return round((b / a - 1) * 100, 2)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def list_cases() -> list[dict]:
    """Sealed previews — nothing that identifies the company."""
    return [{
        "id": c["id"],
        "sector": c["sector"],
        "size": c["size"],
        "date": c["date"],
        "period_label": datetime.strptime(c["date"], "%Y-%m-%d").strftime("%B %Y"),
        "teaser": c["teaser"],
    } for c in CASES]


def _price_facts(s: pd.Series, when: pd.Timestamp) -> dict:
    """What the chart alone would have told you on that day."""
    upto = s[s.index <= when]
    price = float(upto.iloc[-1])
    y1 = upto[upto.index >= when - pd.Timedelta(days=365)]
    m3 = upto[upto.index >= when - pd.Timedelta(days=91)]
    hi52 = float(y1.max()) if not y1.empty else None
    lo52 = float(y1.min()) if not y1.empty else None
    vol = None
    if len(y1) > 30:
        r = y1.pct_change().dropna()
        vol = round(float(r.std() * (252 ** 0.5)), 4)
    return {
        "ret_1y": _pct(float(y1.iloc[0]), price) if len(y1) > 1 else None,
        "ret_3m": _pct(float(m3.iloc[0]), price) if len(m3) > 1 else None,
        "pct_from_52w_high": round((price / hi52 - 1) * 100, 2) if hi52 else None,
        "pct_above_52w_low": round((price / lo52 - 1) * 100, 2) if lo52 else None,
        "volatility_1y": vol,
    }


def get_case(case_id: str) -> dict | None:
    """The anonymised dossier: curated financials and news, plus price facts
    computed from real history. No symbol, no name."""
    c = _lookup(case_id)
    if not c:
        return None
    s = _history(c["symbol"])
    idx = _history(NIFTY)
    then = _at(s, c["date"]) if s is not None else None
    nifty_then = _at(idx, c["date"]) if idx is not None else None

    price_facts = _price_facts(s, then[0]) if then else {}
    nifty_facts = _price_facts(idx, nifty_then[0]) if nifty_then else {}

    return {
        "id": c["id"],
        "kind": c.get("kind", "classic"),
        "date": c["date"],
        "period_label": datetime.strptime(c["date"], "%Y-%m-%d").strftime("%d %B %Y"),
        "sector": c["sector"],
        "size": c["size"],
        "context": c["context"],
        "facts": c["facts"],
        "news": c["news"],
        "news_kind": c.get("news_kind", "headlines"),
        "fiscal_note": c.get("fiscal_note"),
        "risk_facts": c.get("risk_facts"),
        # Split-adjusted, which is also what keeps the level from giving the name away.
        "price_then": round(then[1], 2) if then else None,
        "price_facts": price_facts,
        "nifty_ret_1y": nifty_facts.get("ret_1y"),
        "years_ago": round((date.today() - datetime.strptime(c["date"], "%Y-%m-%d").date()).days / 365.25, 1),
    }


def decide(case_id: str, amount: float) -> dict | None:
    """Replay real prices from the decision date to today and reveal."""
    c = _lookup(case_id)
    if not c:
        return None
    s = _history(c["symbol"])
    idx = _history(NIFTY)
    if s is None or idx is None:
        return {"error": "price history unavailable right now"}
    then = _at(s, c["date"])
    nifty_then = _at(idx, c["date"])
    if not then or not nifty_then:
        return {"error": "no price on the decision date"}

    t0, p0 = then
    p1 = float(s.iloc[-1])
    as_of = s.index[-1]
    n0 = nifty_then[1]
    n1 = float(idx.iloc[-1])

    after = s[s.index >= t0]
    running_max = after.cummax()
    dd = (after / running_max - 1) * 100
    worst_i = after.idxmin()
    best_i = after.idxmax()
    years = max((as_of - t0).days / 365.25, 1 / 365.25)

    # A skip still needs a yardstick: what the money would have done in the
    # index over the same years. Use a standard reference sum for that.
    reference = amount if amount > 0 else 25_000.0
    qty = int(amount // p0) if amount > 0 else 0
    invested = qty * p0
    value_now = qty * p1
    cagr = ((p1 / p0) ** (1 / years) - 1) * 100 if years > 0 else None

    # Monthly-sampled path for the chart; the full daily series is too heavy
    # to send and the story reads the same at month resolution.
    monthly = after.resample("ME").last().dropna()
    path = [{"d": d.strftime("%Y-%m-%d"), "p": round(float(v), 2)} for d, v in monthly.items()]
    if not path or path[0]["d"] != t0.strftime("%Y-%m-%d"):
        path.insert(0, {"d": t0.strftime("%Y-%m-%d"), "p": round(p0, 2)})
    if path[-1]["d"] != as_of.strftime("%Y-%m-%d"):
        path.append({"d": as_of.strftime("%Y-%m-%d"), "p": round(p1, 2)})

    return {
        "id": c["id"],
        "symbol": c["symbol"],
        "name": c["name"],
        "sector": c["sector"],
        "date": t0.strftime("%Y-%m-%d"),
        "as_of": as_of.strftime("%Y-%m-%d"),
        "years": round(years, 1),
        "price_then": round(p0, 2),
        "price_now": round(p1, 2),
        "stock_pct": _pct(p0, p1),
        "cagr": round(cagr, 2) if cagr is not None else None,
        "nifty_pct": _pct(n0, n1),
        "amount": amount,
        "reference_amount": reference,
        "qty": qty,
        "invested": round(invested, 2),
        "value_now": round(value_now, 2),
        "pnl": round(value_now - invested, 2),
        "nifty_value": round((invested if invested else reference) * (n1 / n0), 2),
        "max_drawdown_pct": round(float(dd.min()), 2),
        "worst": {"date": worst_i.strftime("%Y-%m-%d"), "pct": _pct(p0, float(after[worst_i]))},
        "best": {"date": best_i.strftime("%Y-%m-%d"), "pct": _pct(p0, float(after[best_i]))},
        "path": path,
        "what_happened": c["what_happened"] or _narrative(c, _pct(p0, p1), _pct(n0, n1), float(dd.min()), years),
        "lesson": c["lesson"] or _lesson(c, _pct(p0, p1), _pct(n0, n1)),
    }


# ---------------------------------------------------------------------------
# Data-driven narrative for random cases, where nobody wrote the story.
# ---------------------------------------------------------------------------
def _narrative(c: dict, stock_pct: float | None, nifty_pct: float | None, max_dd: float, years: float) -> str:
    if stock_pct is None or nifty_pct is None:
        return "Price history was incomplete for this stretch."
    gap = stock_pct - nifty_pct
    parts = []
    if stock_pct >= 100:
        parts.append(f"The stock more than doubled over the next {years:.1f} years ({stock_pct:+.0f}%).")
    elif stock_pct >= 25:
        parts.append(f"The stock rose {stock_pct:+.0f}% over the next {years:.1f} years.")
    elif stock_pct >= 0:
        parts.append(f"The stock drifted {stock_pct:+.0f}% over the next {years:.1f} years — roughly flat.")
    elif stock_pct >= -25:
        parts.append(f"The stock lost {abs(stock_pct):.0f}% over the next {years:.1f} years.")
    else:
        parts.append(f"The stock fell {abs(stock_pct):.0f}% over the next {years:.1f} years.")
    if gap >= 15:
        parts.append(f"That beat the index by {gap:.0f} points.")
    elif gap <= -15:
        parts.append(f"The index did {abs(gap):.0f} points better; an index fund would have been the stronger choice.")
    else:
        parts.append("It ended up close to what the index delivered.")
    if max_dd <= -30:
        parts.append(f"Along the way it fell {abs(max_dd):.0f}% from a peak — a holder had to sit through that to reach the end result.")
    return " ".join(parts)


def _lesson(c: dict, stock_pct: float | None, nifty_pct: float | None) -> str:
    f = c.get("_fund") or {}
    pe, eg, roe, de = f.get("pe"), f.get("earnings_growth"), f.get("roe"), f.get("debt_to_equity")
    won = stock_pct is not None and nifty_pct is not None and stock_pct >= nifty_pct
    if pe and pe < 15:
        return ("It looked cheap on P/E — and cheap was rewarded this time. Check whether the growth and returns on capital backed it up; that is what separates a bargain from a trap."
                if won else
                "It looked cheap on P/E, and stayed cheap or got cheaper. A low multiple is a question the market is asking, not an answer it has got wrong.")
    if pe and pe > 45:
        return ("The multiple looked demanding, but the growth kept paying the bill. Expensive is not the same as overvalued when earnings compound."
                if won else
                "The multiple assumed years of strong growth. When that growth slowed or merely met expectations, the price had nowhere to go but down.")
    if eg is not None and eg >= 0.3:
        return ("Fast profit growth carried the price. Notice how much of that was already visible in the statements before this date."
                if won else
                "Profit had just grown fast — and that is usually when the price already reflects it. One strong year is the easiest thing to over-extrapolate.")
    if roe is not None and roe >= 0.2 and (de is None or de < 1):
        return ("High returns on capital with little debt: the profile of a compounder, and this stretch rewarded it."
                if won else
                "Good business, wrong price or wrong moment. Quality lowers the odds of disaster; it does not guarantee the next three years.")
    return ("Nothing in the numbers screamed either way, and the outcome was decided by things the statements could not show. That is most of investing."
            if won else
            "An ordinary-looking company that lagged the index. Most stocks do — which is the strongest argument for knowing exactly why you would own this one rather than the index.")
