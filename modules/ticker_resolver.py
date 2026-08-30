# modules/ticker_resolver.py
import html
import requests
import yfinance as yf

def find_ticker_options(company_name: str) -> list[dict]:
    """
    Uses the Yahoo Finance search API to find all potential equity matches
    for a given company name.

    Returns:
        list[dict]: A list of dictionaries, e.g.,
        [{'ticker': 'AAPL', 'name': 'Apple Inc.', 'exchange': 'NMS'}, ...]
    """
    
    try:
        user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
        url = "https://query2.finance.yahoo.com/v1/finance/search"
        params = {"q": company_name, "quotesCount": 20, "lang": "en-IN", "region": "IN"}
        
        response = requests.get(url, params=params, headers={'User-Agent': user_agent})
        
        if response.status_code != 200:
            return []
        
        data = response.json()
        quotes = data.get("quotes", [])
        
        options = []
        for quote in quotes:
            # We only want to show stocks/equities
            if quote.get("quoteType") == "EQUITY":
                options.append({
                    "ticker": quote.get("symbol"),
                    "name": html.unescape(quote.get("longname", quote.get("shortname", "N/A")) or "N/A"),
                    "exchange": quote.get("exchDisp", "N/A") # Display exchange, e.g., "NYSE", "LSE"
                })
        
        return options
        
    except Exception:
        return []