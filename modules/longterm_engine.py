"""
Long-term (1-5y) investor engine — Grinold-Kroner return decomposition.

Different physics from the short-term GARCH engine: over multi-year horizons
returns are driven by fundamentals, not momentum/sentiment:

    E[annual return] ≈ dividend yield
                     + earnings growth (faded toward nominal GDP)
                     + valuation re-rating (partial P/E reversion to fair)

Uncertainty is quality-gated: high-ROE / low-debt compounders get tighter
bands than leveraged cyclicals, because they deliver their arithmetic more
reliably. Monte Carlo runs in ANNUAL steps with Student-t shocks and
per-path growth uncertainty.
"""

import logging
import time

import numpy as np
from cachetools import TTLCache

logger = logging.getLogger(__name__)

CACHE_TTL_SEC = 6 * 3600
N_SIMS = 2000
MAX_YEARS = 5

GDP_NOMINAL = 0.105          # long-run Indian nominal GDP growth — growth fades here
GROWTH_FADE = 0.70           # g(y) = GDP + (g0 - GDP) * FADE^y
REVERSION_SHARE = 0.5        # fraction of the P/E gap that closes over the horizon
RERATE_CAP = 0.08            # |annual re-rating| cap
NIFTY_RETURN = 0.12          # index assumption for P(beat NIFTY)
NIFTY_VOL = 0.17
TAIL_DOF = 5.0

CYCLICAL_SECTORS = {"Basic Materials", "Energy", "Industrials", "Real Estate"}

_cache: TTLCache = TTLCache(maxsize=128, ttl=CACHE_TTL_SEC)


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def compute_longterm(symbol: str) -> dict:
    from modules import market_cache

    sym = symbol.upper()
    prices = market_cache.get_history(sym, min_rows=130)
    if prices is None or len(prices) < 130:
        raise ValueError(f"{sym} has too little history for a long-term view")
    prices = prices.dropna()
    last_price = float(prices.iloc[-1])

    fund = market_cache.get_fundamental(sym) or {}
    row = market_cache.get_screener_row(sym) or {}

    # ---------- 1. Dividend yield ----------
    dy = _clamp(float(fund.get("dividend_yield") or 0.0), 0.0, 0.08)

    # ---------- 2. Earnings growth (blend, then fade to GDP) ----------
    g_parts, g_basis = [], []
    rev_g = fund.get("revenue_growth")
    eps_g = fund.get("earnings_growth")
    if rev_g is not None or eps_g is not None:
        vals = [v for v in (rev_g, eps_g) if v is not None]
        g_hist = _clamp(float(np.mean(vals)), -0.10, 0.30)
        g_parts.append(g_hist)
        g_basis.append(f"trailing growth {g_hist:+.0%}")
    roe, pe = fund.get("roe"), fund.get("pe") or row.get("pe")
    if roe is not None and roe > 0:
        payout = _clamp((dy * pe) if pe else 0.25, 0.0, 0.9)
        g_sust = _clamp(float(roe) * (1 - payout), 0.0, 0.28)
        g_parts.append(g_sust)
        g_basis.append(f"sustainable ROE×retention {g_sust:+.0%}")
    g0 = _clamp(float(np.mean(g_parts)), -0.05, 0.25) if g_parts else GDP_NOMINAL
    if not g_parts:
        g_basis.append("no fundamentals yet — assuming GDP-level growth")

    yearly_growth = [GDP_NOMINAL + (g0 - GDP_NOMINAL) * (GROWTH_FADE ** y)
                     for y in range(1, MAX_YEARS + 1)]

    # ---------- 3. Valuation re-rating ----------
    sector = fund.get("sector") or row.get("sector")
    sector_pes = [r["pe"] for r in market_cache.get_screener()["rows"]
                  if r.get("sector") == sector and r.get("pe") and 3 < r["pe"] < 120]
    sector_med_pe = float(np.median(sector_pes)) if len(sector_pes) >= 5 else None
    rerate_annual, fair_pe = 0.0, None
    if pe and pe > 0 and sector_med_pe:
        fair_pe = _clamp(sector_med_pe, 8.0, 45.0)
        total_factor = (fair_pe / float(pe)) ** REVERSION_SHARE
        rerate_annual = _clamp(total_factor ** (1 / MAX_YEARS) - 1, -RERATE_CAP, RERATE_CAP)

    # ---------- 4. Quality gate → uncertainty width ----------
    daily = prices.pct_change().dropna()
    base_vol = _clamp(float(daily.tail(504).std() * np.sqrt(252)), 0.18, 0.60)
    q_checks = {
        "high_roe": bool(roe is not None and roe >= 0.15),
        "low_debt": bool((fund.get("debt_to_equity") or 99) < 1.0),
        "healthy_margin": bool((fund.get("profit_margin") or -1) >= 0.08),
        "positive_growth": bool(g0 > 0.06),
        "reasonable_valuation": bool(pe is not None and 0 < pe < (sector_med_pe or 40) * 1.6),
    }
    quality = sum(q_checks.values()) / len(q_checks)
    sigma = base_vol * (1.30 - 0.45 * quality)     # quality tightens the band
    cyclical = sector in CYCLICAL_SECTORS

    # ---------- 5. Monte Carlo (annual steps) ----------
    rng = np.random.default_rng(42)
    g_path_noise = rng.normal(0.0, 0.035, N_SIMS)          # per-path growth luck
    shocks = rng.standard_t(TAIL_DOF, size=(MAX_YEARS, N_SIMS)) \
        * np.sqrt((TAIL_DOF - 2) / TAIL_DOF)
    wealth = np.ones((MAX_YEARS + 1, N_SIMS))
    for y in range(1, MAX_YEARS + 1):
        mu = dy + yearly_growth[y - 1] + g_path_noise + rerate_annual
        log_r = np.log1p(np.clip(mu, -0.60, 0.80)) - 0.5 * sigma ** 2 + sigma * shocks[y - 1]
        wealth[y] = wealth[y - 1] * np.exp(log_r)

    # Index paths for P(beat NIFTY)
    idx_shocks = rng.standard_t(TAIL_DOF, size=(MAX_YEARS, N_SIMS)) \
        * np.sqrt((TAIL_DOF - 2) / TAIL_DOF)
    idx_wealth = np.exp(np.cumsum(
        np.log1p(NIFTY_RETURN) - 0.5 * NIFTY_VOL ** 2 + NIFTY_VOL * idx_shocks, axis=0))

    def _horizon_stats(y: int) -> dict:
        w = wealth[y]
        cagr = w ** (1 / y) - 1
        return {
            "years": y,
            "cagr": {p: round(float(np.percentile(cagr, q)) * 100, 1)
                     for p, q in (("p10", 10), ("p25", 25), ("p50", 50),
                                  ("p75", 75), ("p90", 90))},
            "wealth_1l": {p: round(float(np.percentile(w, q)) * 100000)
                          for p, q in (("p10", 10), ("p50", 50), ("p90", 90))},
            "p_beat_nifty": round(float(np.mean(w > idx_wealth[y - 1])), 3),
            "p_positive": round(float(np.mean(w > 1.0)), 3),
            "p_double": round(float(np.mean(w >= 2.0)), 3),
        }

    horizons = {str(y): _horizon_stats(y) for y in (1, 3, 5)}

    # Yearly cone for the chart
    cone = {
        "years": list(range(MAX_YEARS + 1)),
        "p10": [round(float(np.percentile(wealth[y], 10)) * 100000) for y in range(MAX_YEARS + 1)],
        "p50": [round(float(np.percentile(wealth[y], 50)) * 100000) for y in range(MAX_YEARS + 1)],
        "p90": [round(float(np.percentile(wealth[y], 90)) * 100000) for y in range(MAX_YEARS + 1)],
    }

    # ---------- 6. Scenarios ----------
    avg_growth = float(np.mean(yearly_growth))

    def _scenario_cagr(g, rr):
        return round((dy + g + rr) * 100, 1)

    scenarios = [
        {
            "name": "Bear", "tone": "down",
            "cagr": _scenario_cagr(max(0.04, g0 * 0.4), -RERATE_CAP * 0.8),
            "assumptions": f"Growth stalls to ~{max(0.04, g0 * 0.4):.0%}/yr and the market "
                           f"de-rates the stock (P/E compresses)",
        },
        {
            "name": "Base", "tone": "neutral",
            "cagr": _scenario_cagr(avg_growth, rerate_annual),
            "assumptions": f"Growth fades from {g0:.0%} toward {GDP_NOMINAL:.0%} (GDP); "
                           f"P/E drifts {'toward' if rerate_annual != 0 else 'near'} the sector norm",
        },
        {
            "name": "Bull", "tone": "up",
            "cagr": _scenario_cagr(min(0.25, g0 * 1.15 + 0.02), RERATE_CAP * 0.6),
            "assumptions": f"Growth sustains near {min(0.25, g0 * 1.15 + 0.02):.0%}/yr and "
                           f"the market pays up for quality (P/E expands)",
        },
    ]

    return {
        "symbol": sym,
        "last_price": round(last_price, 2),
        "waterfall": {
            "dividend_yield": round(dy * 100, 1),
            "growth": round(avg_growth * 100, 1),
            "rerating": round(rerate_annual * 100, 1),
            "expected_cagr": round((dy + avg_growth + rerate_annual) * 100, 1),
            "growth_basis": g_basis,
            "current_pe": round(float(pe), 1) if pe else None,
            "fair_pe": round(fair_pe, 1) if fair_pe else None,
            "sector": sector,
        },
        "quality": {
            "score": round(quality * 100),
            "checks": q_checks,
            "sigma_annual": round(sigma * 100, 1),
            "cyclical_warning": cyclical,
        },
        "horizons": horizons,
        "cone": cone,
        "scenarios": scenarios,
        "n_simulations": N_SIMS,
        "computed_at": time.time(),
    }


def get_longterm(symbol: str) -> dict:
    key = symbol.upper()
    if key in _cache:
        return _cache[key]
    result = compute_longterm(key)
    _cache[key] = result
    return result
