"""
Layer-1 factor engine: CAPM / Jensen's alpha / Treynor / momentum composite.

All math operates on a Close-price matrix already held in memory
(see market_cache) — this module performs zero network I/O.

Equations
---------
beta_i    = Cov(r_i, r_m) / Var(r_m)            (2y weekly returns)
E[R_i]    = Rf + beta_i (Rm - Rf)               (CAPM)
alpha_i   = R_i,1y - E[R_i]                     (Jensen's alpha)
Treynor_i = (R_i,1y - Rf) / beta_i
M_i       = P(t-21) / P(t-252) - 1              (12-1 momentum)
z_k(i)    = percentile rank of stock i on factor k, 0..100
C_i       = 0.30 z_alpha + 0.25 z_treynor + 0.30 z_mom + 0.15 z_lowvol
"""

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

TRADING_DAYS = 252
MOMENTUM_SKIP = 21          # skip last month (short-term reversal effect)
MIN_ABS_BETA = 0.15         # below this, Treynor is meaningless -> NaN

WEIGHTS = {"alpha": 0.30, "treynor": 0.25, "momentum": 0.30, "low_vol": 0.15}
SENTIMENT_BLEND = 0.15      # weight of sentiment when blended per-stock


def _weekly_returns(prices: pd.DataFrame | pd.Series) -> pd.DataFrame | pd.Series:
    return prices.resample("W-FRI").last().pct_change().dropna(how="all")


def _trailing_return(s: pd.Series, days: int = TRADING_DAYS) -> float:
    s = s.dropna()
    if len(s) <= days:
        return np.nan
    return float(s.iloc[-1] / s.iloc[-1 - days] - 1)


def _rsi(s: pd.Series, window: int = 14) -> float:
    s = s.dropna()
    if len(s) < window + 1:
        return np.nan
    delta = s.diff()
    gain = delta.clip(lower=0).rolling(window).mean()
    loss = (-delta.clip(upper=0)).rolling(window).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - 100 / (1 + rs)
    return float(rsi.iloc[-1])


def compute_stock_factors(prices: pd.Series, index_prices: pd.Series,
                          rf: float) -> dict:
    """Raw (un-ranked) factor values for one stock."""
    prices = prices.dropna()
    joined = pd.concat([prices, index_prices], axis=1, keys=["s", "m"]).dropna()
    wk = _weekly_returns(joined)

    beta = np.nan
    if len(wk) >= 40:
        cov = wk["s"].cov(wk["m"])
        var_m = wk["m"].var()
        if var_m and var_m > 0:
            beta = float(cov / var_m)

    r_1y = _trailing_return(prices)
    rm_1y = _trailing_return(index_prices)

    capm_expected = np.nan
    alpha = np.nan
    if np.isfinite(beta) and np.isfinite(rm_1y):
        capm_expected = rf + beta * (rm_1y - rf)
        if np.isfinite(r_1y):
            alpha = r_1y - capm_expected

    treynor = np.nan
    if np.isfinite(beta) and abs(beta) >= MIN_ABS_BETA and np.isfinite(r_1y):
        treynor = (r_1y - rf) / beta

    momentum = np.nan
    if len(prices) > TRADING_DAYS:
        momentum = float(prices.iloc[-1 - MOMENTUM_SKIP] / prices.iloc[-1 - TRADING_DAYS] - 1)

    daily = prices.pct_change().dropna()
    vol_annual = float(daily.tail(TRADING_DAYS).std() * np.sqrt(TRADING_DAYS)) if len(daily) > 60 else np.nan
    sharpe = (r_1y - rf) / vol_annual \
        if np.isfinite(r_1y) and np.isfinite(vol_annual) and vol_annual > 0 else np.nan

    last = float(prices.iloc[-1])
    prev = float(prices.iloc[-2]) if len(prices) >= 2 else np.nan
    high_52w = float(prices.tail(TRADING_DAYS).max())

    return {
        "price": last,
        "change_pct": (last / prev - 1) * 100 if np.isfinite(prev) else np.nan,
        "beta": beta,
        "return_1y": r_1y,
        "market_return_1y": rm_1y,
        "capm_expected": capm_expected,
        "alpha": alpha,
        "treynor": treynor,
        "sharpe": sharpe,
        "momentum": momentum,
        "volatility": vol_annual,
        "rsi": _rsi(prices),
        "pct_from_52w_high": (last / high_52w - 1) * 100 if high_52w > 0 else np.nan,
    }


def compute_universe_factors(prices: pd.DataFrame, index_prices: pd.Series,
                             rf: float, fundamentals: dict[str, dict] | None = None,
                             names: dict[str, str] | None = None,
                             ) -> list[dict]:
    """Factor table + composite conviction score for the whole universe.

    Vectorized where it matters (beta via one covariance pass on weekly
    returns) so a 100-stock refresh costs ~100 ms of math.
    """
    fundamentals = fundamentals or {}
    names = names or {}
    joined = pd.concat([prices, index_prices.rename("__mkt__")], axis=1)
    wk = _weekly_returns(joined)
    var_m = wk["__mkt__"].var()
    betas = wk.drop(columns="__mkt__").apply(lambda c: c.cov(wk["__mkt__"])) / var_m \
        if var_m and var_m > 0 else pd.Series(np.nan, index=prices.columns)

    rm_1y = _trailing_return(index_prices)
    records: dict[str, dict] = {}
    for sym in prices.columns:
        s = prices[sym].dropna()
        if s.empty:
            continue
        beta = float(betas.get(sym, np.nan))
        r_1y = _trailing_return(s)
        capm = rf + beta * (rm_1y - rf) if np.isfinite(beta) and np.isfinite(rm_1y) else np.nan
        alpha = r_1y - capm if np.isfinite(r_1y) and np.isfinite(capm) else np.nan
        treynor = (r_1y - rf) / beta \
            if np.isfinite(beta) and abs(beta) >= MIN_ABS_BETA and np.isfinite(r_1y) else np.nan
        momentum = float(s.iloc[-1 - MOMENTUM_SKIP] / s.iloc[-1 - TRADING_DAYS] - 1) \
            if len(s) > TRADING_DAYS else np.nan
        daily = s.pct_change().dropna()
        vol = float(daily.tail(TRADING_DAYS).std() * np.sqrt(TRADING_DAYS)) if len(daily) > 60 else np.nan
        sharpe = (r_1y - rf) / vol if np.isfinite(r_1y) and np.isfinite(vol) and vol > 0 else np.nan
        last = float(s.iloc[-1])
        prev = float(s.iloc[-2]) if len(s) >= 2 else np.nan
        high_52w = float(s.tail(TRADING_DAYS).max())
        records[sym] = {
            "symbol": sym,
            "price": round(last, 2),
            "change_pct": round((last / prev - 1) * 100, 2) if np.isfinite(prev) else None,
            "beta": beta,
            "return_1y": r_1y,
            "capm_expected": capm,
            "alpha": alpha,
            "treynor": treynor,
            "sharpe": sharpe,
            "momentum": momentum,
            "volatility": vol,
            "rsi": _rsi(s),
            "pct_from_52w_high": round((last / high_52w - 1) * 100, 2) if high_52w > 0 else None,
        }

    if not records:
        return []

    df = pd.DataFrame.from_dict(records, orient="index")

    # Percentile ranks 0..100 (NaNs stay NaN and are neutralized below)
    ranks = pd.DataFrame(index=df.index)
    ranks["alpha"] = df["alpha"].rank(pct=True) * 100
    ranks["treynor"] = df["treynor"].rank(pct=True) * 100
    ranks["momentum"] = df["momentum"].rank(pct=True) * 100
    ranks["low_vol"] = (-df["volatility"]).rank(pct=True) * 100  # lower vol = better

    # Composite: re-normalize weights over available factors per stock so a
    # missing factor doesn't silently drag the score toward zero.
    w = pd.Series(WEIGHTS)
    avail = ranks.notna().astype(float)
    weight_sum = avail.mul(w, axis=1).sum(axis=1)
    score = ranks.fillna(0).mul(w, axis=1).sum(axis=1) / weight_sum.replace(0, np.nan)
    df["score"] = score

    rows: list[dict] = []
    for sym, rec in df.iterrows():
        fund = fundamentals.get(sym, {})
        clean = {}
        for k, v in rec.items():
            if isinstance(v, float):
                clean[k] = round(v, 4) if np.isfinite(v) else None
            else:
                clean[k] = v
        clean["symbol"] = sym
        clean["score"] = round(float(rec["score"]), 1) if np.isfinite(rec["score"]) else None
        clean["rank_alpha"] = round(float(ranks.loc[sym, "alpha"]), 1) if np.isfinite(ranks.loc[sym, "alpha"]) else None
        clean["rank_treynor"] = round(float(ranks.loc[sym, "treynor"]), 1) if np.isfinite(ranks.loc[sym, "treynor"]) else None
        clean["rank_momentum"] = round(float(ranks.loc[sym, "momentum"]), 1) if np.isfinite(ranks.loc[sym, "momentum"]) else None
        clean["rank_low_vol"] = round(float(ranks.loc[sym, "low_vol"]), 1) if np.isfinite(ranks.loc[sym, "low_vol"]) else None
        clean["name"] = fund.get("name") or names.get(sym) or sym.replace(".NS", "")
        clean["sector"] = fund.get("sector")
        clean["market_cap"] = fund.get("market_cap")
        # Rich ratio set (None until nightly fundamentals land)
        for key in ("pe", "forward_pe", "peg", "pb", "roe", "profit_margin",
                    "revenue_growth", "earnings_growth", "debt_to_equity",
                    "dividend_yield", "eps"):
            clean[key] = fund.get(key)
        # Yahoo rarely provides PEG for Indian stocks — compute it ourselves
        # from trailing P/E and earnings growth when missing.
        peg, growth = fund.get("peg"), fund.get("earnings_growth")
        pe = fund.get("pe")
        if peg is None and pe is not None and growth is not None and float(growth) > 0.03:
            peg = round(float(pe) / (float(growth) * 100.0), 2)
            clean["peg"] = peg
        # GARP: growth at a reasonable price — decent growth, sane PEG
        clean["garp"] = bool(
            peg is not None and 0 < float(peg) <= 1.5
            and growth is not None and float(growth) >= 0.10
        )
        rows.append(clean)

    rows.sort(key=lambda r: (r["score"] is None, -(r["score"] or 0)))
    return rows


def blend_sentiment(score: float | None, sentiment: float | None) -> float | None:
    """Blend the universe composite with a per-stock sentiment score.

    C' = (1 - w_s) * C + w_s * 100 * (S + 1) / 2 ,  S in [-1, 1]
    """
    if sentiment is None:
        return score
    sent_rank = 100.0 * (max(-1.0, min(1.0, sentiment)) + 1.0) / 2.0
    if score is None:
        return round(sent_rank, 1)
    return round((1 - SENTIMENT_BLEND) * score + SENTIMENT_BLEND * sent_rank, 1)
