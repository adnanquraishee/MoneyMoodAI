import yfinance as yf
import pandas as pd
import requests
from bs4 import BeautifulSoup
# NOTE: The get_ticker_from_name function has been moved to ticker_resolver.py

# ------------------------------------------------------------
# ✅ STOCK DATA FETCH
# ------------------------------------------------------------

def resolve_ticker(query: str) -> str:
    """Resolve user query to a valid ticker symbol."""
    return query.strip().upper()


def get_price_history(ticker: str, period: str = "24mo", interval: str = "1d") -> pd.DataFrame:
    """
    Fetch and clean historical stock price data using yfinance.

    Returns
    -------
    pd.DataFrame
        Clean DataFrame with DatetimeIndex and numeric columns.
    """
    try:
        t = yf.Ticker(ticker)
        hist = t.history(period=period, interval=interval)

        if hist.empty:
            return pd.DataFrame()

        # Ensure DatetimeIndex
        hist.reset_index(inplace=True)
        hist['Date'] = pd.to_datetime(hist['Date']).dt.strftime('%Y-%m-%d')
        hist.set_index('Date', inplace=True)

        # Keep relevant numeric columns
        numeric_cols = ['Open', 'High', 'Low', 'Close', 'Volume']
        
        cols_to_use = [col for col in numeric_cols if col in hist.columns]
        hist = hist[cols_to_use]

        # Remove duplicates & ensure numeric
        hist = hist.apply(pd.to_numeric, errors='coerce').dropna()

        return hist

    except Exception as e:
        print(f"Error in get_price_history: {e}")
        return pd.DataFrame()


# ------------------------------------------------------------
# ✅ COMPANY FINANCIALS FETCH
# ------------------------------------------------------------

def get_financials(ticker: str):
    """Fetch company financials using yfinance."""
    try:
        t = yf.Ticker(ticker)
        fin = t.financials
        if fin is not None and not fin.empty:
            return fin
        else:
            return None
    except Exception as e:
        return None


# ------------------------------------------------------------
# ✅ NEWS HEADLINES FETCH (MODIFIED)
# ------------------------------------------------------------
def get_headlines(topic: str = None, limit: int = 20):
    """
    Fetch latest Google News headlines via RSS.
    Cleans up empty, duplicate, or invalid results.
    """
    headlines = []
    
    try:
        topic_query = topic.replace(" ", "+") if topic else "Business"
        topic_url = f"https://news.google.com/rss/search?q={topic_query}"
        response = requests.get(topic_url, timeout=10)

        if response.status_code == 200:
            soup = BeautifulSoup(response.content, "xml")
            items = soup.find_all("item")
            for item in items[:limit]:
                title = item.title.text.strip()
                link = item.link.text.strip()

                if (
                    not title
                    or title.lower().startswith("http")
                    or "..." in title
                    or len(title) < 5
                ):
                    continue

                headlines.append({"title": title, "link": link})
    except Exception as e:
        pass
        
    unique_titles = set()
    clean_headlines = []
    for h in headlines:
        if h["title"] not in unique_titles:
            unique_titles.add(h["title"])
            clean_headlines.append(h)

    return clean_headlines


# ------------------------------------------------------------
# ✅ WRAPPER FUNCTION FOR APP
# ------------------------------------------------------------

def get_stock_data(symbol: str, period: str = "2y", interval: str = "1d"):
    """
    Wrapper for app.py → fetches clean, ready-to-train stock data.
    """
    ticker = resolve_ticker(symbol)
    data = get_price_history(ticker, period=period, interval=interval)
    return data

# ------------------------------------------------------------
# ✅ MARKET DATA FUNCTION
# ------------------------------------------------------------
def get_market_data(tickers: list):
    """
    Fetches recent data for a list of tickers to get current price and % change.
    Handles NaN values by finding the most recent valid price for each ticker.
    
    Weekend Handling:
    - Global markets are closed on weekends (Saturday/Sunday)
    - This function fetches 10 days of historical data
    - On weekends, it automatically shows the most recent trading day's data (typically Friday)
    - The dropna() operation ensures we skip weekend gaps and find the last valid trading session
    """
    try:
        # Download 10 days to handle market closures and weekends
        # This ensures weekend requests get Friday's data
        data = yf.download(tickers, period="10d", interval="1d", auto_adjust=True, progress=False)
        if data.empty:
            return {}
            
        close_data = data['Close']
        if len(close_data) < 2:
            return {} 
        
        market_data = {}
        
        # Handle multiple tickers
        if isinstance(close_data, pd.DataFrame):
            for ticker in tickers:
                if ticker not in close_data.columns:
                    continue
                    
                # Get the ticker's price series and drop NaN values
                ticker_prices = close_data[ticker].dropna()
                
                if len(ticker_prices) >= 2:
                    latest_price = ticker_prices.iloc[-1]
                    prev_price = ticker_prices.iloc[-2]
                    pct_change = ((latest_price - prev_price) / prev_price) * 100
                    
                    market_data[ticker] = {
                        "price": latest_price,
                        "change": pct_change
                    }
        # Handle single ticker
        else:
            ticker_prices = close_data.dropna()
            if len(ticker_prices) >= 2:
                ticker = tickers[0]
                latest_price = ticker_prices.iloc[-1]
                prev_price = ticker_prices.iloc[-2]
                pct_change = ((latest_price - prev_price) / prev_price) * 100
                
                market_data[ticker] = {
                    "price": latest_price,
                    "change": pct_change
                }

        return market_data
    except Exception as e:
        print(f"Error in get_market_data: {e}")
        import traceback
        traceback.print_exc()
        return {}