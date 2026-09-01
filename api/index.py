import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import traceback
import logging

# Import existing modules.
# The legacy Streamlit-era modules (forecast, fundamentals, insights, compare,
# recommendation, accuracy, sentiment) pulled in matplotlib, plotly, streamlit,
# torch and transformers — together far over a serverless bundle limit — and
# their endpoints were already unreachable from the UI. They stay in the repo
# but are no longer imported by the API.

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Track import errors for debugging Vercel 500s
import_error_details = None

try:
    from modules import (
        data_fetch,
        ticker_resolver,
        technicals,
    )
    from modules import market_cache, forecast_engine, watchlist_store, paper_trading, time_trade, time_trade_random, news_sentiment, factors as factors_mod
    from modules import salahkaar
except Exception as e:
    import_error_details = traceback.format_exc()
    logger.error(f"Failed to import modules: {import_error_details}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    pass

app = FastAPI(title="FinQorp API", version="2.0.0", lifespan=lifespan)

@app.get("/api/debug")
def debug_info():
    return {"status": "error", "traceback": import_error_details}



@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm the in-memory market store and start background refresh jobs.
    # Request handlers only ever read that snapshot — they never wait on Yahoo.
    market_cache.start()
    yield
    market_cache.stop()


app = FastAPI(title="FinQorp API", version="2.0.0", lifespan=lifespan)

# CORS configuration for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:6100",  # Vite dev server (default)
        "http://127.0.0.1:6100",
        "http://localhost:5000",  # Vite dev server (alt)
        "http://127.0.0.1:5000",
        "http://localhost:5001",  # Vite dev server (alt)
        "http://127.0.0.1:5001",
        "http://localhost:5173",  # Vite dev server (legacy default)
        "http://localhost:5100",  # Vite dev server (alt port)
        "http://localhost:3000",  # Alternative React dev server
        "https://*.vercel.app",   # Vercel deployments
        "https://*.netlify.app"   # Netlify deployments
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Request/Response Models ====================

class TickerOption(BaseModel):
    ticker: str
    name: str
    exchange: str

class CompareRequest(BaseModel):
    symbols: List[str]

# ==================== API Endpoints ====================

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "message": "FinQorp API is running",
        "version": "1.0.0"
    }

@app.get("/api/search")
async def search_stocks(query: str = Query(..., min_length=1)):
    """
    Search for stocks by company name or ticker symbol
    Returns list of matching ticker options
    """
    try:
        import asyncio
        q = query.strip().lower()

        # 1) Local full-NSE list first: instant, ~2,300 companies
        #    (Yahoo's search often buries the NSE listing under foreign ADRs)
        local = []
        for full, name in market_cache.get_universe_names().items():
            base = full.replace(".NS", "").lower()
            if q in name.lower() or q in base:
                local.append({"ticker": full, "name": name, "exchange": "NSE"})
        # exact-prefix matches first, then shortest name
        local.sort(key=lambda o: (not o["name"].lower().startswith(q), len(o["name"])))

        # 2) Remote Yahoo search for everything beyond the universe
        loop = asyncio.get_event_loop()
        options = await loop.run_in_executor(
            None, ticker_resolver.find_ticker_options, query)

        def _in_india(opt):
            t = (opt.get("ticker") or "")
            return t.endswith(".NS") or t.endswith(".BO")

        indian = [o for o in (options or []) if _in_india(o)]
        indian.sort(key=lambda o: (not o["ticker"].endswith(".NS"), len(o["ticker"])))

        # Merge (local first) and de-duplicate by company
        seen_tickers, seen_names, deduped = set(), set(), []
        for o in local + indian:
            base_ticker = o["ticker"].split(".")[0]
            base_name = (o.get("name") or o["ticker"]).lower()
            if base_ticker in seen_tickers or base_name in seen_names:
                continue
            seen_tickers.add(base_ticker)
            seen_names.add(base_name)
            deduped.append(o)

        if not deduped:
            return {"results": []}

        return {
            "results": [
                {
                    "ticker": opt["ticker"],
                    "name": opt["name"],
                    "exchange": opt["exchange"]
                }
                for opt in deduped[:8]
            ]
        }
    except Exception as e:
        logger.error(f"Search error for '{query}': {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stock/{symbol}/chart")
async def get_stock_chart(
    symbol: str, 
    period: str = Query("2y", regex="^(1d|5d|1mo|3mo|6mo|1y|2y|5y|10y|ytd|max)$"),
    interval: str = Query("1d", regex="^(1m|2m|5m|15m|30m|60m|90m|1h|1d|5d|1wk|1mo|3mo)$")
):
    """
    Get historical price data for charting
    """
    try:
        df = data_fetch.get_stock_data(symbol, period=period, interval=interval)
        
        if df.empty:
            raise HTTPException(status_code=404, detail=f"No chart data found for {symbol}")
        
        # Calculate moving averages
        df['MA50'] = df['Close'].rolling(50).mean()
        df['MA200'] = df['Close'].rolling(200).mean()
        
        # Convert to dict for JSON response
        data = df.reset_index().to_dict('records')
        
        # Convert Timestamp to string and NaN to None for JSON compatibility
        import math
        for record in data:
            if 'Date' in record:
                date_val = record['Date']
                if hasattr(date_val, 'isoformat'):
                    record['Date'] = date_val.isoformat()
                elif not isinstance(date_val, str):
                    record['Date'] = str(date_val)
            
            # Replace NaN with None for JSON serialization
            for key, value in list(record.items()):
                if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
                    record[key] = None
        
        return {
            "symbol": symbol,
            "period": period,
            "interval": interval,
            "data": data
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chart data error for '{symbol}': {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stock/{symbol}/technicals")
async def get_technicals(symbol: str):
    """
    Get technical indicators (RSI, MACD, Bollinger Bands)
    """
    try:
        df = data_fetch.get_stock_data(symbol, period="1y", interval="1d")
        
        if df.empty or 'Close' not in df.columns:
            raise HTTPException(status_code=404, detail=f"No data for technical analysis: {symbol}")
        
        # Calculate indicators
        technicals.calculate_bbands(df)
        technicals.calculate_rsi(df)
        technicals.calculate_macd(df)
        df = df.dropna()
        
        # Convert to dict
        data = df.reset_index().to_dict('records')
        
        # Convert Timestamp to string and NaN to None for JSON compatibility
        import math
        for record in data:
            if 'Date' in record:
                date_val = record['Date']
                if hasattr(date_val, 'isoformat'):
                    record['Date'] = date_val.isoformat()
                elif not isinstance(date_val, str):
                    record['Date'] = str(date_val)
            
            # Replace NaN with None for JSON serialization
            for key, value in list(record.items()):
                if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
                    record[key] = None
        
        return {
            "symbol": symbol,
            "data": data
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Technical analysis error for '{symbol}': {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/compare")
async def compare_stocks(request: CompareRequest):
    """Side-by-side comparison, rebuilt as a pure memory read.

    The previous version rendered a matplotlib PNG server-side; the table and
    the written summary were always the substance, and dropping the image
    removes a 29 MB dependency. `chart` stays in the response as an empty
    string so the existing client keeps working."""
    if len(request.symbols) < 2:
        raise HTTPException(status_code=400, detail="At least 2 symbols required for comparison")
    if len(request.symbols) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 symbols allowed")

    def pct(v):
        return round(v * 100, 2) if isinstance(v, (int, float)) else None

    rows, notes = [], []
    for raw in request.symbols:
        sym = raw.strip().upper()
        f = market_cache.get_fundamental(sym) or {}
        r = market_cache.get_screener_row(sym) or {}
        q = market_cache.get_quote(sym) or {}
        if not f and not r:
            continue
        rows.append({
            "Symbol": sym.replace(".NS", ""),
            "Company": f.get("name") or r.get("name") or sym,
            "Price": round(q["price"], 2) if q.get("price") else None,
            "P/E": round(f["pe"], 1) if isinstance(f.get("pe"), (int, float)) else None,
            "P/B": round(f["pb"], 1) if isinstance(f.get("pb"), (int, float)) else None,
            "ROE %": pct(f.get("roe")),
            "Net Margin %": pct(f.get("profit_margin")),
            "Rev Growth %": pct(f.get("revenue_growth")),
            "D/E": round(f["debt_to_equity"], 2) if isinstance(f.get("debt_to_equity"), (int, float)) else None,
            "Div Yield %": pct(f.get("dividend_yield")),
            "1Y Return %": pct(r.get("return_1y")),
            "Beta": round(r["beta"], 2) if isinstance(r.get("beta"), (int, float)) else None,
            "Conviction": round(r["score"]) if isinstance(r.get("score"), (int, float)) else None,
        })
    if len(rows) < 2:
        raise HTTPException(status_code=404, detail="Not enough data to compare these symbols")

    def best(field, biggest=True):
        vals = [(r["Symbol"], r[field]) for r in rows if r.get(field) is not None]
        if not vals:
            return None
        return (max if biggest else min)(vals, key=lambda x: x[1])

    for field, biggest, phrase in [
        ("ROE %", True, "earns the most on shareholder capital"),
        ("Net Margin %", True, "keeps the most of each rupee of sales"),
        ("Rev Growth %", True, "is growing sales fastest"),
        ("P/E", False, "is the cheapest on trailing earnings"),
        ("D/E", False, "carries the least debt"),
        ("Div Yield %", True, "pays the most income"),
    ]:
        b = best(field, biggest)
        if b:
            notes.append(f"- **{b[0]}** {phrase} ({field.replace(' %','')}: {b[1]}).")

    summary = ("### Comparison\n\n" + "\n".join(notes) +
               "\n\nThese are descriptive facts about the numbers, not a recommendation. "
               "A company leading on one measure can lag badly on another — read the columns "
               "together, and tap any metric in the Stock Desk to learn what it does and does "
               "not tell you.")
    return {"symbols": request.symbols, "summary": summary, "data": rows, "chart": ""}


@app.get("/api/market/indices")
async def get_market_indices():
    """
    Get market overview with major indices
    """
    try:
        indices = ['^NSEI', '^BSESN', '^GSPC', '^IXIC', 'GC=F', 'CL=F', 'INR=X', 'EURUSD=X']
        index_data = data_fetch.get_market_data(indices)
        
        index_names = {
            '^NSEI': 'NIFTY 50',
            '^BSESN': 'SENSEX',
            '^GSPC': 'S&P 500',
            '^IXIC': 'NASDAQ',
            'GC=F': 'Gold',
            'CL=F': 'Crude Oil',
            'INR=X': 'USD/INR',
            'EURUSD=X': 'EUR/USD'
        }
        
        result = []
        for ticker, name in index_names.items():
            data = index_data.get(ticker)
            if data:
                result.append({
                    "symbol": ticker,
                    "name": name,
                    "price": data['price'],
                    "change": data['change']
                })
            else:
                result.append({
                    "symbol": ticker,
                    "name": name,
                    "price": None,
                    "change": None
                })
        
        return {"indices": result}
    except Exception as e:
        logger.error(f"Market indices error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== v2: Screener / Watchlist / Forecast ====================

class WatchlistAddRequest(BaseModel):
    symbol: str
    note: str = ""


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    symbol: Optional[str] = None


@app.post("/api/chat")
async def salahkaar_chat(request: ChatRequest):
    """SALAHKAAR — SEBI-compliant finance education chatbot.
    System-prompt lock + temperature 0.0 + output guard; grounded in live
    platform data for the stock currently on screen."""
    import asyncio
    loop = asyncio.get_event_loop()
    msgs = [m.dict() for m in request.messages]
    result = await loop.run_in_executor(
        None, salahkaar.chat, msgs, request.symbol)
    return result


@app.get("/api/market/pulse")
async def get_market_pulse():
    """Dashboard hero payload: index cards with sparklines, market mood,
    top movers, and the ticker strip. Pure memory read."""
    return market_cache.get_pulse()


# ---------------------------------------------------------------------------
# Paper trading (Learn tab). Simulated cash only — nothing here touches a
# broker. Prices are memory reads from the market cache.
# ---------------------------------------------------------------------------
class PaperTradeRequest(BaseModel):
    symbol: str
    side: str
    qty: int
    reason: str = ""


def _nifty_price() -> float | None:
    q = market_cache.get_quote(market_cache.INDEX_SYMBOL)
    return float(q["price"]) if q and q.get("price") else None


def _enrich_paper(state: dict) -> dict:
    """Mark holdings to market and judge each past trade against today."""
    nifty_now = _nifty_price()
    holdings = []
    holdings_value = 0.0
    last_buy: dict[str, dict] = {}
    for t in state["trades"]:
        if t["side"] == "buy":
            last_buy[t["symbol"]] = t
    for sym, h in state["holdings"].items():
        q = market_cache.get_quote(sym) or {}
        price = q.get("price")
        value = price * h["qty"] if price else None
        pnl = (price - h["avg_cost"]) * h["qty"] if price else None
        if value:
            holdings_value += value
        lb = last_buy.get(sym)
        holdings.append({
            "symbol": sym, "name": h.get("name") or sym, "qty": h["qty"],
            "avg_cost": h["avg_cost"], "price": price, "value": value, "pnl": pnl,
            "pnl_pct": (price / h["avg_cost"] - 1) * 100 if price else None,
            "reason": lb["reason"] if lb else None,
            "bought_at": lb["ts"] if lb else None,
        })
    holdings.sort(key=lambda x: -(x["value"] or 0))

    trades = []
    for t in reversed(state["trades"]):
        q = market_cache.get_quote(t["symbol"]) or {}
        now = q.get("price")
        trades.append({
            **t, "price_now": now,
            "move_pct": (now / t["price"] - 1) * 100 if now else None,
        })

    total = state["cash"] + holdings_value
    start = state["starting_cash"]
    ns = state.get("nifty_start")
    return {
        "started_at": state["started_at"],
        "starting_cash": start,
        "cash": state["cash"],
        "holdings": holdings,
        "holdings_value": holdings_value,
        "total_value": total,
        "pnl": total - start,
        "return_pct": (total / start - 1) * 100,
        "nifty_return_pct": (nifty_now / ns - 1) * 100 if (nifty_now and ns) else None,
        "trades": trades,
    }


@app.get("/api/paper")
async def get_paper_portfolio():
    return _enrich_paper(paper_trading.get_state(_nifty_price()))


@app.post("/api/paper/trade")
async def paper_trade(req: PaperTradeRequest):
    sym = req.symbol.strip().upper()
    q = market_cache.get_quote(sym)
    if not q or not q.get("price"):
        # Unknown symbol: one cached fetch in a worker so the loop stays free.
        import asyncio
        loop = asyncio.get_event_loop()
        hist = await loop.run_in_executor(None, market_cache.get_history, sym, 2)
        if hist is None or hist.empty:
            raise HTTPException(status_code=404, detail=f"No price available for {sym}")
        q = {"price": float(hist.iloc[-1])}
    row = market_cache.get_screener_row(sym) or {}
    fund = market_cache.get_fundamental(sym) or {}
    name = row.get("name") or fund.get("name") or sym.replace(".NS", "")
    try:
        state = paper_trading.trade(
            sym, req.side, req.qty, float(q["price"]), req.reason,
            name=name, nifty_price=_nifty_price(),
        )
    except paper_trading.TradeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return _enrich_paper(state)


@app.post("/api/paper/reset")
async def paper_reset():
    return _enrich_paper(paper_trading.reset(_nifty_price()))


# ---------------------------------------------------------------------------
# Try Trade in Time — blind historical decisions, real outcomes.
# ---------------------------------------------------------------------------
class TimeTradeDecision(BaseModel):
    id: str
    amount: float = 0.0


@app.get("/api/timetrade/cases")
async def timetrade_cases():
    return {"cases": time_trade.list_cases()}


@app.get("/api/timetrade/case/{case_id}")
async def timetrade_case(case_id: str):
    import asyncio
    loop = asyncio.get_event_loop()
    # First call per symbol downloads full history; keep it off the loop.
    data = await loop.run_in_executor(None, time_trade.get_case, case_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Unknown case")
    return data


class TimeTradeRandomRequest(BaseModel):
    exclude: list[str] = []


@app.post("/api/timetrade/random")
async def timetrade_random(req: TimeTradeRandomRequest):
    """Draw a fresh random case: a different company and date every time,
    with the dossier computed from statements and prices as of that date."""
    import asyncio
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, time_trade_random.draw, set(req.exclude))
    if data is None:
        raise HTTPException(status_code=503, detail="Could not build a case right now — try again.")
    return data


@app.post("/api/timetrade/decide")
async def timetrade_decide(req: TimeTradeDecision):
    import asyncio
    if req.amount < 0 or req.amount > 10_000_000:
        raise HTTPException(status_code=422, detail="amount must be between 0 and ₹1 crore")
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, time_trade.decide, req.id, req.amount)
    if data is None:
        raise HTTPException(status_code=404, detail="Unknown case")
    if "error" in data:
        raise HTTPException(status_code=503, detail=data["error"])
    return data


@app.get("/api/metrics/distributions")
async def get_metric_distributions():
    """Percentile bands per metric across the live universe, plus per-sector
    medians. Powers the metric-education UI, which shows a learner where a
    stock sits against the real market instead of a textbook range."""
    return market_cache.get_metric_distributions()


@app.get("/api/market/sectors")
async def get_sector_rotation():
    """RRG-style sector rotation: relative strength vs NIFTY + momentum with
    weekly trails. Memory read over the cached closes matrix (10-min cache)."""
    return market_cache.get_sector_rotation()


@app.get("/api/screener")
async def get_screener():
    """Full factor-scored universe. Pure memory read (~ms); filtering and
    sorting happen client-side on this snapshot."""
    return market_cache.get_screener()


@app.get("/api/watchlist")
async def get_watchlist():
    """Watchlist items with live quotes and sparklines — memory reads only."""
    items = watchlist_store.get_items()
    enriched = []
    for item in items:
        sym = item["symbol"]
        quote = market_cache.get_quote(sym) or {}
        row = market_cache.get_screener_row(sym) or {}
        enriched.append({
            **item,
            "price": quote.get("price"),
            "change_pct": quote.get("change_pct"),
            "score": row.get("score"),
            "rsi": row.get("rsi"),
            "name": row.get("name") or sym.replace(".NS", ""),
            "sparkline": market_cache.get_sparkline(sym),
        })
    return {"items": enriched}


@app.post("/api/watchlist")
async def add_to_watchlist(request: WatchlistAddRequest):
    items = watchlist_store.add(request.symbol, request.note)
    # Warm the fast lane + forecast for the new symbol in the background
    import threading
    threading.Thread(target=market_cache.refresh_fast_lane, daemon=True).start()
    forecast_engine.get_or_start(request.symbol)
    return {"items": items}


@app.delete("/api/watchlist/{symbol}")
async def remove_from_watchlist(symbol: str):
    return {"items": watchlist_store.remove(symbol)}


class WatchlistEnrichRequest(BaseModel):
    symbols: List[str] = []


@app.post("/api/watchlist/enrich")
async def enrich_watchlist(req: WatchlistEnrichRequest):
    """Quotes and scores for a caller-supplied list of symbols.

    Stateless by design: the watchlist itself lives in the browser, so there
    is nothing to persist server-side and nothing to share between visitors.
    Pure memory reads."""
    out = []
    for sym in req.symbols[:100]:
        sym = sym.strip().upper()
        if not sym:
            continue
        quote = market_cache.get_quote(sym) or {}
        row = market_cache.get_screener_row(sym) or {}
        fund = market_cache.get_fundamental(sym) or {}
        out.append({
            "symbol": sym,
            "added_at": None,
            "note": "",
            "price": quote.get("price"),
            "change_pct": quote.get("change_pct"),
            "score": row.get("score"),
            "rsi": row.get("rsi"),
            "name": row.get("name") or fund.get("name") or sym.replace(".NS", ""),
            "sparkline": market_cache.get_sparkline(sym),
        })
    return {"items": out}


@app.get("/api/stock/{symbol}/factors")
async def get_stock_factors(symbol: str):
    """Layer-1 factor breakdown (CAPM, alpha, Treynor, momentum, composite)."""
    row = market_cache.get_screener_row(symbol.upper())
    if row is not None:
        return {"symbol": symbol.upper(), "in_universe": True, "factors": row}
    import asyncio
    loop = asyncio.get_event_loop()

    def _compute():
        prices = market_cache.get_history(symbol.upper())
        idx = market_cache.get_index_history()
        if prices is None or idx is None:
            return None
        return factors_mod.compute_stock_factors(prices, idx, market_cache.RISK_FREE_RATE)

    raw = await loop.run_in_executor(None, _compute)
    if raw is None:
        raise HTTPException(status_code=404, detail=f"No history for {symbol}")
    import numpy as np
    clean = {k: (round(v, 4) if isinstance(v, float) and np.isfinite(v)
                 else (None if isinstance(v, float) else v))
             for k, v in raw.items()}
    return {"symbol": symbol.upper(), "in_universe": False, "factors": clean}


@app.get("/api/stock/{symbol}/ohlc")
async def get_ohlc(
    symbol: str,
    period: str = Query("1y", regex="^(1mo|3mo|6mo|1y|2y|5y|max)$"),
    interval: str = Query("1d", regex="^(1d|1wk|1mo|60m|15m)$"),
):
    """OHLCV arrays + moving averages for candlestick charts (cached 5 min)."""
    import asyncio
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(
        None, market_cache.get_ohlc, symbol.upper(), period, interval)
    if data is None:
        raise HTTPException(status_code=404, detail=f"No OHLC data for {symbol}")
    return data


@app.get("/api/stock/{symbol}/overview")
async def get_overview(symbol: str):
    """One-call stock workspace payload: quote, all ratios, factor scores and
    a technical snapshot. Universe symbols answer from memory; unknown symbols
    trigger cached on-demand fetches in a worker thread."""
    import asyncio
    import numpy as np
    sym = symbol.upper()
    loop = asyncio.get_event_loop()

    def _build():
        prices = market_cache.get_history(sym, min_rows=60)
        if prices is None or len(prices) < 60:
            return None
        fund = market_cache.get_fundamental(sym) or {}
        row = market_cache.get_screener_row(sym)
        if row is None:
            idx = market_cache.get_index_history()
            raw = factors_mod.compute_stock_factors(prices, idx, market_cache.RISK_FREE_RATE) \
                if idx is not None else {}
            row = {k: (round(v, 4) if isinstance(v, float) and np.isfinite(v)
                       else (None if isinstance(v, float) else v))
                   for k, v in raw.items()}

        # Technical snapshot on daily closes
        s = prices.dropna()
        last = float(s.iloc[-1])
        prev = float(s.iloc[-2]) if len(s) >= 2 else last
        ma50 = float(s.rolling(50).mean().iloc[-1]) if len(s) >= 50 else None
        ma200 = float(s.rolling(200).mean().iloc[-1]) if len(s) >= 200 else None
        # MACD state
        ema12 = s.ewm(span=12, adjust=False).mean()
        ema26 = s.ewm(span=26, adjust=False).mean()
        macd = ema12 - ema26
        macd_sig = macd.ewm(span=9, adjust=False).mean()
        macd_hist = float(macd.iloc[-1] - macd_sig.iloc[-1])
        # Bollinger position
        mid = s.rolling(20).mean()
        std = s.rolling(20).std()
        bb_pos = None
        if len(s) >= 20 and float(std.iloc[-1]) > 0:
            bb_pos = float((last - mid.iloc[-1]) / (2 * std.iloc[-1]))  # -1..1 inside bands

        hi52 = fund.get("high_52w") or float(s.tail(252).max())
        lo52 = fund.get("low_52w") or float(s.tail(252).min())

        return {
            "symbol": sym,
            "name": fund.get("name") or (row.get("name") if row else None) or sym.replace(".NS", ""),
            "quote": {
                "price": round(last, 2),
                "change_pct": round((last / prev - 1) * 100, 2),
                "high_52w": hi52, "low_52w": lo52,
                "as_of": s.index[-1].strftime("%Y-%m-%d"),
            },
            "fundamentals": fund,
            "factors": row,
            "technicals": {
                "rsi": row.get("rsi") if row else None,
                "ma50": round(ma50, 2) if ma50 else None,
                "ma200": round(ma200, 2) if ma200 else None,
                "price_vs_ma50": round((last / ma50 - 1) * 100, 2) if ma50 else None,
                "price_vs_ma200": round((last / ma200 - 1) * 100, 2) if ma200 else None,
                "macd_hist": round(macd_hist, 3),
                "macd_state": "bullish" if macd_hist > 0 else "bearish",
                "bb_position": round(bb_pos, 2) if bb_pos is not None else None,
                "golden_cross": bool(ma50 and ma200 and ma50 > ma200),
            },
            "sparkline": market_cache.get_sparkline(sym, points=60),
        }

    data = await loop.run_in_executor(None, _build)
    if data is None:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")
    return data


_news_cache: Dict[str, Any] = {}


@app.get("/api/stock/{symbol}/news")
async def get_stock_news(symbol: str):
    """Live headlines for a company with quick per-headline sentiment.
    Cached 15 minutes per symbol."""
    import asyncio
    import time as _time
    sym = symbol.upper()
    cached = _news_cache.get(sym)
    if cached and _time.time() - cached["ts"] < 900:
        return cached["payload"]

    loop = asyncio.get_event_loop()

    def _fetch():
        fund = market_cache.get_fundamental(sym) or {}
        company = (fund.get("name") or sym.replace(".NS", "").replace(".BO", ""))
        # strip legal suffixes for a better news query
        for suffix in (" Limited", " Ltd.", " Ltd"):
            if company.endswith(suffix):
                company = company[: -len(suffix)]
        # Yahoo first: it is the only source that yields a real publisher URL
        # and a summary, so those items can be scored on their text. Google
        # News adds Indian coverage but hides the target behind an encrypted
        # redirect, so those are headline-only and labelled as such.
        merged = news_sentiment.yahoo_news(sym)
        seen = {i["title"].lower() for i in merged}
        google = data_fetch.get_headlines(f"{company} stock") or []
        if not google:
            google = data_fetch.get_headlines(company) or []
        for h in google:
            t = (h.get("title") or "").strip()
            if t and t.lower() not in seen:
                seen.add(t.lower())
                merged.append({"title": t, "link": h.get("link", "#"),
                               "summary": "", "source": None, "published": None})
        # Full-article, finance-contextual scoring: reads each story, keeps
        # only the sentences about this company, and applies an Indian-market
        # event lexicon over FinBERT.
        return news_sentiment.analyse(merged, company, sym, limit=18)

    payload = await loop.run_in_executor(None, _fetch)
    _news_cache[sym] = {"ts": _time.time(), "payload": payload}
    return payload


_calendar_cache: Dict[str, Any] = {}


@app.get("/api/calendar")
async def get_corporate_calendar():
    """Upcoming corporate events (earnings, dividends) for watchlist symbols.
    Cached 6h — yfinance calendar calls are slow, so they run in a worker."""
    import asyncio
    import time as _time
    cached = _calendar_cache.get("payload")
    if cached and _time.time() - _calendar_cache.get("ts", 0) < 6 * 3600:
        return cached

    loop = asyncio.get_event_loop()

    def _fetch():
        import datetime as _dt
        import yfinance as yf
        events = []
        today = _dt.date.today()
        for sym in watchlist_store.get_symbols()[:20]:
            name = (market_cache.get_fundamental(sym) or {}).get("name") \
                or market_cache.get_universe_names().get(sym) or sym.replace(".NS", "")
            try:
                cal = yf.Ticker(sym).calendar or {}
            except Exception:
                continue
            for d in (cal.get("Earnings Date") or [])[:1]:
                if hasattr(d, "date"):
                    d = d.date() if hasattr(d, "date") else d
                if isinstance(d, _dt.date) and d >= today:
                    events.append({"symbol": sym, "name": name, "type": "earnings",
                                   "date": d.isoformat(), "detail": "Quarterly results expected"})
            exd = cal.get("Ex-Dividend Date")
            if exd is not None:
                if hasattr(exd, "date"):
                    exd = exd.date()
                if isinstance(exd, _dt.date) and exd >= today:
                    events.append({"symbol": sym, "name": name, "type": "ex_dividend",
                                   "date": exd.isoformat(),
                                   "detail": "Buy before this date to receive the dividend"})
            dd = cal.get("Dividend Date")
            if dd is not None:
                if hasattr(dd, "date"):
                    dd = dd.date()
                if isinstance(dd, _dt.date) and dd >= today:
                    events.append({"symbol": sym, "name": name, "type": "dividend",
                                   "date": dd.isoformat(), "detail": "Dividend payout"})
        events.sort(key=lambda e: e["date"])
        from datetime import datetime, timezone
        return {"as_of": datetime.now(timezone.utc).isoformat(), "events": events[:20]}

    payload = await loop.run_in_executor(None, _fetch)
    _calendar_cache["payload"] = payload
    _calendar_cache["ts"] = _time.time()
    return payload


@app.get("/api/stock/{symbol}/longterm")
async def get_longterm_outlook(symbol: str):
    """Investor view: 1/3/5-year Grinold-Kroner return decomposition with
    quality-gated Monte Carlo. Cached 6h; computes in ~100ms warm."""
    import asyncio
    from modules import longterm_engine
    loop = asyncio.get_event_loop()
    try:
        return await loop.run_in_executor(
            None, longterm_engine.get_longterm, symbol.upper())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception:
        logger.error(f"Long-term outlook error for '{symbol}': {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Long-term computation failed")


@app.get("/api/stock/{symbol}/forecast-v2")
async def get_forecast_v2(symbol: str, horizon: int = Query(90, ge=10, le=365)):
    """Probabilistic forecast (GARCH + Prophet + Monte Carlo).

    Instant response: {"status": "ready", "result": ...} when cached,
    else {"status": "computing"} while a background thread works — the
    frontend polls this same endpoint every couple of seconds.
    """
    return forecast_engine.get_or_start(symbol.upper(), horizon)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=6150, reload=True)
