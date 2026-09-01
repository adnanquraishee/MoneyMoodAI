import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# =========================================================
# 🔹 Helper Functions
# =========================================================

def _format_large_number(num, currency_symbol="$"):
    """Formats large numbers (e.g., Market Cap) into B/T."""
    if pd.isna(num) or num == "N/A": return "N/A"
    try:
        num = float(num)
        # Use the passed currency_symbol instead of hardcoded '$'
        if abs(num) > 1_000_000_000_000:
            return f"{currency_symbol}{num / 1_000_000_000_000:.2f}T"
        elif abs(num) > 1_000_000_000:
            return f"{currency_symbol}{num / 1_000_000_000:.2f}B"
        elif abs(num) > 1_000_000:
            return f"{currency_symbol}{num / 1_000_000:.2f}M"
        else:
            return f"{currency_symbol}{num:,.2f}"
    except (ValueError, TypeError):
        return "N/A"

def _format_ratio(num, is_percent=False):
    """Formats ratios and percentages neatly."""
    if pd.isna(num) or num == "N/A": return "N/A"
    try:
        num = float(num)
        if is_percent:
            return f"{num * 100:.2f}%"
        return f"{num:.2f}"
    except (ValueError, TypeError):
        return "N/A"

# =============================================================
# ✅ REVISED UNIVERSAL FUNDAMENTALS
# =============================================================
def get_fundamentals(ticker_symbol: str):
    """
    Fetches all financial fundamentals using yfinance, providing robust handling
    for missing data and dynamic currency symbols.
    """
    try:
        t = yf.Ticker(ticker_symbol)
        info = t.info
        fin = t.financials
        bs = t.balance_sheet
        cf = t.cashflow

        def normalize(df):
            if df is not None and not df.empty:
                df = df.transpose().fillna(0)
                df.columns = df.columns.astype(str).str.lower().str.replace(r'[^\w]', '', regex=True)
                return df.iloc[::-1]
            return pd.DataFrame()

        fin = normalize(fin)
        bs = normalize(bs)
        cf = normalize(cf)
        
        # =============================================================
        # 🔹 Currency Detection
        # =============================================================
        currency_code = info.get("currency", "USD")
        currency_symbol = "$" # Default
        if currency_code != "USD":
            currency_map = {"INR": "₹", "CAD": "C$", "EUR": "€", "GBP": "£", "JPY": "¥", "AUD": "A$"}
            # Fallback to the code if not in map (e.g., "SEK ")
            currency_symbol = currency_map.get(currency_code.upper(), f"{currency_code.upper()} ")

        # =============================================================
        # 🔹 Get Current Price
        # =============================================================
        current_price = info.get("currentPrice", info.get("regularMarketPrice"))
        if not current_price or current_price == 0:
            current_price = info.get("previousClose", 0)

        # =============================================================
        # 🔹 Dividend & Payout
        # =============================================================
        dividend_yield_info = info.get("dividendYield", 0.0)
        trailing_div = info.get("trailingAnnualDividendRate", 0)
        trailing_eps = info.get("trailingEps", 0)
        payout_ratio = info.get("payoutRatio", 0.0)

        div_yield = dividend_yield_info / 100
        if payout_ratio == 0.0 and trailing_div > 0 and trailing_eps > 0:
             payout_ratio = (trailing_div / trailing_eps)
        
        payout_ratio_pct = payout_ratio * 100

        # =============================================================
        # 🔹 Advanced Ratios — D/E, ROE, ROA
        # =============================================================
        roe = info.get("returnOnEquity")
        roa = info.get("returnOnAssets")
        de_ratio = info.get("debtToEquity")

        # =============================================================
        # 🔹 Full Metrics Dictionary
        # =============================================================
        metrics = {
            "Current Price": f"{currency_symbol}{_format_ratio(current_price)}",
            "Market Cap": _format_large_number(info.get('marketCap'), currency_symbol),
            "Revenue (TTM)": _format_large_number(info.get('totalRevenue'), currency_symbol),
            "Profit Margin": _format_ratio(info.get('profitMargins'), is_percent=True),
            "P/E Ratio": _format_ratio(info.get("trailingPE")),
            "Forward P/E": _format_ratio(info.get("forwardPE")),
            "PEG Ratio": _format_ratio(info.get("pegRatio")),
            "EPS": f"{currency_symbol}{_format_ratio(info.get('trailingEps'))}",
            "Beta": _format_ratio(info.get("beta")),
            "Dividend Yield": _format_ratio(div_yield, is_percent=True),
            "ROE": _format_ratio(roe, is_percent=True),
            "Debt-to-Equity": f"{_format_ratio(de_ratio)}%" 
        }

        # =============================================================
        # 🔹 Company Profile Info
        # =============================================================
        profile_info = {
            "longName": info.get("longName", ticker_symbol),
            "summary": info.get("longBusinessSummary", "No business summary available."),
            "sector": info.get("sector", "N/A"),
            "industry": info.get("industry", "N/A"),
            "website": info.get("website", "N/A"),
            "employees": f"{info.get('fullTimeEmployees', 0):,}" if info.get('fullTimeEmployees') else "N/A"
        }

        # =============================================================
        # 🔹 Financial Trend Visualizations (3 Graphs)
        # =============================================================
        figs = {}
        
        # --- THEME COLORS (SLATE & SAPPHIRE) ---
        BG_COLOR = "#121A2A" # Dark Panel Blue
        TEXT_COLOR = "#FFFFFF"
        ACCENT_COLOR = "#0D6EFD" # Sapphire Blue
        ACCENT_ALT = "#00FFFF" # Cyan
        BORDER_COLOR = "#30363D"

        # 1️⃣ Revenue vs Net Income
        try:
            if not fin.empty and "totalrevenue" in fin.columns and "netincome" in fin.columns:
                fig1, ax1 = plt.subplots(figsize=(5, 2.5))
                ax1.plot(fin.index, fin["totalrevenue"] / 1e9, label=f"Revenue (B{currency_symbol})", color=ACCENT_COLOR, linewidth=2)
                ax1.plot(fin.index, fin["netincome"] / 1e9, label=f"Net Income (B{currency_symbol})", color=ACCENT_ALT, linewidth=2, linestyle='--')
                ax1.legend(facecolor=BG_COLOR, labelcolor=TEXT_COLOR, fontsize=7)
                ax1.set_facecolor(BG_COLOR)
                fig1.patch.set_facecolor(BG_COLOR)
                ax1.set_title(f"{ticker_symbol} Revenue vs Net Income", color=TEXT_COLOR, fontsize=9)
                ax1.tick_params(colors=TEXT_COLOR, rotation=25)
                for spine in ax1.spines.values():
                    spine.set_color(BORDER_COLOR)
                plt.tight_layout()
                figs["rev_income"] = fig1
        except Exception:
            pass

        # 2️⃣ Operating Cash Flow
        try:
            if not cf.empty and "totalcashfromoperatingactivities" in cf.columns:
                fig2, ax2 = plt.subplots(figsize=(5, 2.5))
                ax2.bar(cf.index, cf["totalcashfromoperatingactivities"] / 1e9, color=ACCENT_COLOR)
                ax2.set_facecolor(BG_COLOR)
                fig2.patch.set_facecolor(BG_COLOR)
                ax2.set_title(f"{ticker_symbol} Operating Cash Flow (B{currency_symbol})", color=TEXT_COLOR, fontsize=9)
                ax2.tick_params(colors=TEXT_COLOR, rotation=25)
                for spine in ax2.spines.values():
                    spine.set_color(BORDER_COLOR)
                plt.tight_layout()
                figs["cash_flow"] = fig2
        except Exception:
            pass

        # 3️⃣ Balance Sheet Snapshot (always draw something)
        try:
            equity = info.get("totalStockholderEquity", 0)
            assets = info.get("totalAssets", 0)
            liab = info.get("totalLiab", 0)
            
            if assets > 0 and liab > 0 and equity > 0:
                fig3, ax3 = plt.subplots(figsize=(3.5, 2))
                ax3.bar(["Assets", "Liabilities", "Equity"], 
                        [assets / 1e9, liab / 1e9, equity / 1e9],
                        color=[ACCENT_COLOR, "#D40000", ACCENT_ALT]) # Blue, Red, Cyan
                ax3.set_facecolor(BG_COLOR)
                fig3.patch.set_facecolor(BG_COLOR)
                ax3.set_title(f"Balance Sheet (B{currency_symbol})", color=TEXT_COLOR, fontsize=9)
                ax3.tick_params(colors=TEXT_COLOR)
                for spine in ax3.spines.values():
                    spine.set_color(BORDER_COLOR)
                plt.tight_layout()
                figs["balance_sheet"] = fig3
        except Exception as e:
            pass

        # --- FIX: Return all 3 items ---
        return metrics, figs, profile_info

    except Exception as e:
        return {"Error": f"Failed to fetch data for {ticker_symbol}: {str(e)}"}, {}, {}