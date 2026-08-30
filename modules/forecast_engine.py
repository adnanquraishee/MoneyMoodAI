"""
Layer-2 forecast engine: Prophet trend + fitted GARCH(1,1) volatility +
vectorized Student-t Monte Carlo, tilted by the Layer-1 conviction score.

Model
-----
r_t                = ln(P_t / P_{t-1})
sigma^2_t          = omega + alpha eps^2_{t-1} + beta sigma^2_{t-1}   (MLE fit, arch pkg)
mu_t               = log-increment of Prophet trend
mu~_t              = mu_t + lambda ((C - 50) / 50) sigma_t           (conviction tilt)
eps_t              = T_nu * sqrt((nu - 2) / nu)                      (standardized t)
P_{t+1}            = P_t exp(mu~_t - sigma^2_t / 2 + sigma_t eps_t)

Serving pattern: results are computed in a background thread and cached
6h; the HTTP endpoint returns instantly with either the cached result or
a "computing" status the frontend polls.
"""

import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pandas as pd
from cachetools import TTLCache

logger = logging.getLogger(__name__)

HORIZON_DEFAULT = 90
N_SIMULATIONS = 1000
TILT_LAMBDA = 0.05          # max ±0.05 sigma/day of conviction tilt
DRIFT_SHRINKAGE = 0.6       # shrink Prophet trend toward zero (anti-extrapolation)
DRIFT_CAP_ANNUAL = 0.25     # |annualized drift| <= min(annual vol, this)
CACHE_TTL_SEC = 6 * 3600
ERROR_RETRY_SEC = 120       # allow a retry two minutes after a failure

_cache: TTLCache = TTLCache(maxsize=64, ttl=CACHE_TTL_SEC)
_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="forecast")
# Sector news sentiment is shared by every stock in the sector — cache 30 min
_sector_sent_cache: TTLCache = TTLCache(maxsize=32, ttl=1800)

SENTIMENT_WEIGHTS = {"company": 0.55, "sector": 0.25, "peers": 0.20}


def _sector_sentiment(sector: str | None) -> float | None:
    """News sentiment for the whole sector (VADER over sector headlines)."""
    if not sector:
        return None
    if sector in _sector_sent_cache:
        return _sector_sent_cache[sector]
    try:
        from modules import data_fetch, sentiment as sentiment_mod
        headlines = data_fetch.get_headlines(f"Indian {sector} sector stocks") or []
        if not headlines:
            return None
        scores = [sentiment_mod._sia.polarity_scores(h["title"])["compound"]
                  for h in headlines[:12]]
        val = float(np.mean(scores)) if scores else None
        if val is not None:
            _sector_sent_cache[sector] = val
        return val
    except Exception:
        logger.exception("Sector sentiment failed for %s", sector)
        return None


def _peer_signal(symbol: str, sector: str | None) -> tuple[float | None, list[str]]:
    """Rival/peer signal: 5-day average return of the sector's largest peers,
    squashed to [-1, 1]. Captures industry-wide moves the company's own news
    may not mention (e.g., a rival's blowout results lifting the sector)."""
    if not sector:
        return None, []
    try:
        from modules import market_cache
        rows = market_cache.get_screener()["rows"]
        peers = [r for r in rows
                 if r.get("sector") == sector and r["symbol"] != symbol
                 and r.get("market_cap")]
        peers.sort(key=lambda r: -(r["market_cap"] or 0))
        peers = peers[:5]
        if not peers:
            return None, []
        with market_cache.store.lock:
            closes = market_cache.store.closes
        if closes is None:
            return None, []
        rets = []
        names = []
        for p in peers:
            s = closes.get(p["symbol"])
            if s is None:
                continue
            s = s.dropna()
            if len(s) >= 6:
                rets.append(float(s.iloc[-1] / s.iloc[-6] - 1))
                names.append(p["symbol"].replace(".NS", ""))
        if not rets:
            return None, []
        # tanh squash: ±3% weekly peer move ≈ ±0.76 signal
        return float(np.tanh(np.mean(rets) / 0.03)), names
    except Exception:
        logger.exception("Peer signal failed for %s", symbol)
        return None, []


def _blend_layers(company: float | None, sector: float | None,
                  peers: float | None) -> float | None:
    """Weighted blend of sentiment layers; weights renormalize over the
    layers that are actually available."""
    parts = {"company": company, "sector": sector, "peers": peers}
    avail = {k: v for k, v in parts.items() if v is not None}
    if not avail:
        return None
    wsum = sum(SENTIMENT_WEIGHTS[k] for k in avail)
    return sum(SENTIMENT_WEIGHTS[k] * v for k, v in avail.items()) / wsum


# ---------------------------------------------------------------------------
# Model pieces
# ---------------------------------------------------------------------------

def _fit_garch(log_returns: pd.Series, horizon: int) -> tuple[np.ndarray, float, dict]:
    """MLE-fitted GARCH(1,1) with Student-t errors.

    Returns (daily vol forecasts, tail dof nu, fitted params). Falls back to
    EWMA volatility if the fit fails or is non-stationary (alpha+beta >= 1).
    """
    r = log_returns.dropna() * 100  # percent scale for numerical stability
    try:
        from arch import arch_model
        am = arch_model(r, vol="GARCH", p=1, q=1, dist="t", mean="Zero")
        res = am.fit(disp="off", show_warning=False)
        omega = float(res.params["omega"])
        alpha = float(res.params["alpha[1]"])
        beta = float(res.params["beta[1]"])
        nu = float(res.params.get("nu", 6.0))
        if alpha + beta < 1.0 and omega > 0:
            fc = res.forecast(horizon=horizon, reindex=False)
            var_path = fc.variance.values[0] / 10000.0  # back to return scale
            vols = np.sqrt(np.maximum(var_path, 1e-10))
            params = {"omega": omega / 10000.0, "alpha": alpha, "beta": beta,
                      "nu": nu, "persistence": alpha + beta, "method": "garch_mle"}
            return vols, float(np.clip(nu, 4.0, 30.0)), params
        logger.warning("GARCH fit non-stationary (a+b=%.3f); using EWMA", alpha + beta)
    except Exception:
        logger.exception("GARCH fit failed; using EWMA fallback")
    ewma_vol = float(log_returns.dropna().ewm(span=60).std().iloc[-1])
    return np.full(horizon, ewma_vol), 6.0, {"method": "ewma_fallback", "vol": ewma_vol}


def _temper_drift(drift: np.ndarray, vols: np.ndarray) -> np.ndarray:
    """Shrink and cap the trend drift so the model can't extrapolate a recent
    run (up or down) into an implausible sustained move.

    A trend forecast implying sustained |Sharpe| > 1 is not credible, so the
    annualized drift magnitude is capped at min(annualized vol, 35%)."""
    drift = drift * DRIFT_SHRINKAGE
    ann_drift = float(np.mean(drift)) * 252
    ann_vol = float(np.mean(vols)) * np.sqrt(252)
    limit = min(max(ann_vol, 0.05), DRIFT_CAP_ANNUAL)
    if abs(ann_drift) > limit and abs(ann_drift) > 1e-9:
        drift = drift * (limit / abs(ann_drift))
    return drift


def _prophet_drift(prices: pd.Series, horizon: int) -> np.ndarray:
    """Daily log-drift from the Prophet trend over the forecast horizon."""
    try:
        from prophet import Prophet
        df = prices.dropna().tail(3 * 252).reset_index()
        df.columns = ["ds", "y"]
        df["ds"] = pd.to_datetime(df["ds"]).dt.tz_localize(None)
        model = Prophet(daily_seasonality=False, weekly_seasonality=False,
                        yearly_seasonality=True, changepoint_prior_scale=0.05)
        model.fit(df)
        future = model.make_future_dataframe(periods=horizon)
        yhat = model.predict(future)["yhat"].to_numpy()
        fut = yhat[-horizon:]
        prev = np.concatenate(([yhat[-horizon - 1]], fut[:-1]))
        pct = np.clip(fut / prev - 1, -0.2, 0.2)
        return np.log1p(pct)
    except Exception:
        logger.exception("Prophet drift failed; falling back to historical drift")
        r = np.log(prices / prices.shift(1)).dropna()
        return np.full(horizon, float(np.clip(r.tail(252).mean(), -0.005, 0.005)))


def _simulate(last_price: float, drift: np.ndarray, vols: np.ndarray,
              nu: float, conviction: float | None,
              n_sims: int = N_SIMULATIONS) -> np.ndarray:
    """Vectorized Monte Carlo: (horizon, n_sims) price paths."""
    horizon = len(drift)
    tilt = 0.0
    if conviction is not None and np.isfinite(conviction):
        tilt = TILT_LAMBDA * (conviction - 50.0) / 50.0
    mu = drift + tilt * vols                       # conviction-tilted drift
    rng = np.random.default_rng()
    shocks = rng.standard_t(nu, size=(horizon, n_sims)) * np.sqrt((nu - 2) / nu)
    log_inc = (mu - 0.5 * vols ** 2)[:, None] + vols[:, None] * shocks
    return last_price * np.exp(np.cumsum(log_inc, axis=0))


# ---------------------------------------------------------------------------
# Full computation (runs in background thread)
# ---------------------------------------------------------------------------

def compute_forecast(symbol: str, horizon: int = HORIZON_DEFAULT) -> dict:
    from modules import factors as factors_mod
    from modules import market_cache

    prices = market_cache.get_history(symbol, min_rows=120)
    if prices is None or len(prices) < 120:
        raise ValueError(
            f"{symbol} has under 6 months of trading history — too little to model")
    prices = prices.dropna()
    last_price = float(prices.iloc[-1])
    log_returns = np.log(prices / prices.shift(1))

    # --- Layer 1: conviction score (universe row, else computed on the fly)
    row = market_cache.get_screener_row(symbol)
    factor_detail: dict
    if row is not None:
        base_score = row.get("score")
        factor_detail = row
    else:
        idx = market_cache.get_index_history()
        raw = factors_mod.compute_stock_factors(prices, idx, market_cache.RISK_FREE_RATE) \
            if idx is not None else {}
        base_score = None
        factor_detail = {k: (round(v, 4) if isinstance(v, float) and np.isfinite(v) else
                             (None if isinstance(v, float) else v))
                         for k, v in raw.items()}
        factor_detail["symbol"] = symbol

    # --- Layered sentiment: company news + sector news + peer momentum ---
    company_sent = None
    try:
        from modules import sentiment as sentiment_mod
        _, _, s = sentiment_mod.analyze_sentiment(symbol.replace(".NS", ""))
        company_sent = float(s)
    except Exception:
        logger.warning("Company sentiment unavailable for %s", symbol)

    fund_sector = (market_cache.get_fundamental(symbol) or {}).get("sector")
    row_sector = row.get("sector") if row else None
    sector = fund_sector or row_sector
    sector_sent = _sector_sentiment(sector)
    peer_sig, peer_names = _peer_signal(symbol, sector)

    sentiment_score = _blend_layers(company_sent, sector_sent, peer_sig)
    conviction = factors_mod.blend_sentiment(base_score, sentiment_score)

    # --- Layer 2: GARCH vol + Prophet drift + Monte Carlo
    if len(prices) >= 260:
        vols, nu, garch_params = _fit_garch(log_returns, horizon)
    else:  # young listing: not enough data for a stable GARCH fit
        ewma_vol = float(log_returns.dropna().ewm(span=60).std().iloc[-1])
        vols, nu = np.full(horizon, ewma_vol), 6.0
        garch_params = {"method": "ewma_short_history", "vol": ewma_vol}
    # Ensemble drift: Prophet trend blended with recent realized drift —
    # two imperfect estimators disagree less badly than either alone.
    prophet_drift = _prophet_drift(prices, horizon)
    recent = log_returns.dropna().tail(126)
    hist_drift = float(np.clip(recent.ewm(span=60).mean().iloc[-1], -0.004, 0.004)) \
        if len(recent) > 20 else 0.0
    drift = _temper_drift(0.65 * prophet_drift + 0.35 * hist_drift, vols)
    paths = _simulate(last_price, drift, vols, nu, conviction)

    pcts = np.percentile(paths, [5, 25, 50, 75, 95], axis=1)
    future_dates = pd.bdate_range(prices.index[-1] + pd.Timedelta(days=1),
                                  periods=horizon)
    hist_tail = prices.tail(180)

    ending = paths[-1]

    # ---- Verdict: direction, magnitude, and the drivers behind it ----
    prob_up = float(np.mean(ending > last_price))
    med_move = float(np.median(ending) / last_price - 1) * 100
    p25_move = float(np.percentile(ending, 25) / last_price - 1) * 100
    p75_move = float(np.percentile(ending, 75) / last_price - 1) * 100
    if prob_up >= 0.55 and med_move > 1:
        direction = "growth"
    elif prob_up <= 0.45 and med_move < -1:
        direction = "fall"
    else:
        direction = "sideways"
    edge = abs(prob_up - 0.5)
    confidence = "high" if edge >= 0.20 else "moderate" if edge >= 0.10 else "low"

    drivers: list[dict] = []

    def _driver(name, impact, detail):
        drivers.append({"name": name, "impact": impact, "detail": detail})

    ann_drift = float(np.mean(drift)) * 252 * 100
    _driver("Price trend (Prophet)",
            "positive" if ann_drift > 2 else "negative" if ann_drift < -2 else "neutral",
            f"Underlying trend contributes ~{ann_drift:+.0f}%/yr after dampening")
    if company_sent is not None:
        _driver("Company news (FinBERT)",
                "positive" if company_sent > 0.1 else "negative" if company_sent < -0.1 else "neutral",
                f"This company's headlines score {company_sent:+.2f} on a −1…+1 scale")
    if sector_sent is not None:
        _driver(f"{sector or 'Sector'} news",
                "positive" if sector_sent > 0.08 else "negative" if sector_sent < -0.08 else "neutral",
                f"Sector-wide headlines score {sector_sent:+.2f} — industry mood spills over")
    if peer_sig is not None:
        _driver("Rival / peer momentum",
                "positive" if peer_sig > 0.15 else "negative" if peer_sig < -0.15 else "neutral",
                f"Top peers ({', '.join(peer_names[:3])}) moved "
                f"{'up' if peer_sig >= 0 else 'down'} this week (signal {peer_sig:+.2f})")
    ra, rm_ = factor_detail.get("rank_alpha"), factor_detail.get("rank_momentum")
    if ra is not None:
        _driver("CAPM alpha vs peers",
                "positive" if ra >= 60 else "negative" if ra <= 40 else "neutral",
                f"Risk-adjusted outperformance in the {ra:.0f}th percentile of NIFTY-100")
    if rm_ is not None:
        _driver("12-1 momentum",
                "positive" if rm_ >= 60 else "negative" if rm_ <= 40 else "neutral",
                f"Momentum in the {rm_:.0f}th percentile — winners tend to persist")
    rsi_val = factor_detail.get("rsi")
    if rsi_val is not None:
        _driver("RSI regime",
                "negative" if rsi_val > 70 else "positive" if rsi_val < 30 else "neutral",
                f"RSI {rsi_val:.0f}: " + ("overbought — pullback risk" if rsi_val > 70
                                          else "oversold — bounce potential" if rsi_val < 30
                                          else "no momentum extreme"))
    ann_vol_now = float(np.mean(vols)) * np.sqrt(252) * 100
    _driver("Volatility regime (GARCH)",
            "negative" if ann_vol_now > 40 else "neutral",
            f"Forecast volatility ≈ {ann_vol_now:.0f}%/yr sets the cone width"
            + (" — elevated, expect wide swings" if ann_vol_now > 40 else ""))
    d52 = factor_detail.get("pct_from_52w_high")
    if d52 is not None and d52 < -25:
        _driver("Deep drawdown", "negative",
                f"{d52:.0f}% below its 52-week high — trend damage needs repair")

    verdict = {
        "direction": direction,
        "confidence": confidence,
        "prob_up": round(prob_up, 3),
        "expected_move_pct": round(med_move, 1),
        "likely_range_pct": {"low": round(p25_move, 1), "high": round(p75_move, 1)},
        "horizon_days": horizon,
        "drivers": drivers,
    }

    result = {
        "verdict": verdict,
        "symbol": symbol,
        "horizon_days": horizon,
        "n_simulations": paths.shape[1],
        "last_price": round(last_price, 2),
        "as_of": prices.index[-1].strftime("%Y-%m-%d"),
        "history": {
            "dates": [d.strftime("%Y-%m-%d") for d in hist_tail.index],
            "prices": [round(float(v), 2) for v in hist_tail.values],
        },
        "forecast": {
            "dates": [d.strftime("%Y-%m-%d") for d in future_dates],
            "p5":  [round(float(v), 2) for v in pcts[0]],
            "p25": [round(float(v), 2) for v in pcts[1]],
            "p50": [round(float(v), 2) for v in pcts[2]],
            "p75": [round(float(v), 2) for v in pcts[3]],
            "p95": [round(float(v), 2) for v in pcts[4]],
        },
        "probabilities": {
            "up": round(float(np.mean(ending > last_price)), 3),
            "up_5pct": round(float(np.mean(ending > last_price * 1.05)), 3),
            "down_5pct": round(float(np.mean(ending < last_price * 0.95)), 3),
            "expected_return_pct": round(float(np.median(ending) / last_price - 1) * 100, 2),
        },
        "model": {
            "garch": garch_params,
            "tail_dof": nu,
            "tilt_lambda": TILT_LAMBDA,
            "conviction_score": conviction,
            "base_score": base_score,
            "sentiment_score": round(sentiment_score, 3) if sentiment_score is not None else None,
            "sentiment_layers": {
                "company": round(company_sent, 3) if company_sent is not None else None,
                "sector": round(sector_sent, 3) if sector_sent is not None else None,
                "peers": round(peer_sig, 3) if peer_sig is not None else None,
                "sector_name": sector,
                "peer_names": peer_names[:5],
                "weights": SENTIMENT_WEIGHTS,
            },
        },
        "factors": factor_detail,
        "computed_at": time.time(),
    }
    return result


# ---------------------------------------------------------------------------
# Job orchestration (what the API calls — returns instantly)
# ---------------------------------------------------------------------------

def _run_job(key: str, symbol: str, horizon: int) -> None:
    try:
        result = compute_forecast(symbol, horizon)
        _cache[key] = result
        with _jobs_lock:
            _jobs[key] = {"status": "ready"}
    except Exception as exc:
        logger.exception("Forecast job failed for %s", symbol)
        with _jobs_lock:
            _jobs[key] = {"status": "error", "error": str(exc), "ts": time.time()}


def get_or_start(symbol: str, horizon: int = HORIZON_DEFAULT) -> dict:
    """Idempotent: returns cached result, or starts/reports a background job."""
    key = f"{symbol.upper()}:{horizon}"
    if key in _cache:
        return {"status": "ready", "result": _cache[key]}
    with _jobs_lock:
        job = _jobs.get(key)
        if job:
            if job["status"] == "computing":
                return {"status": "computing"}
            if job["status"] == "error":
                if time.time() - job.get("ts", 0) < ERROR_RETRY_SEC:
                    return {"status": "error", "error": job.get("error", "unknown")}
                # stale error -> retry below
        _jobs[key] = {"status": "computing"}
    _executor.submit(_run_job, key, symbol.upper(), horizon)
    return {"status": "computing"}


def precompute_watchlist() -> None:
    """Warm forecasts for watchlist symbols so their pages open instantly."""
    from modules import watchlist_store
    for sym in watchlist_store.get_symbols():
        get_or_start(sym)
