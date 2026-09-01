import yfinance as yf
import numpy as np
import pandas as pd
import traceback

# =========================================================
# 🔹 Helper Functions
# =========================================================

def _format_large_number(num):
    """Formats large numbers (e.g., Market Cap) into B/T."""
    if pd.isna(num) or num == "N/A": return "N/A"
    try:
        num = float(num)
        if abs(num) > 1_000_000_000_000:
            return f"${num / 1_000_000_000_000:.2f}T"
        elif abs(num) > 1_000_000_000:
            return f"${num / 1_000_000_000:.2f}B"
        elif abs(num) > 1_000_000:
            return f"${num / 1_000_000:.2f}M"
        else:
            return f"${num:,.2f}"
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

# =========================================================
# 🔹 AI SUMMARY GENERATOR (v2.2)
# =========================================================

def generate_ai_summary(ticker: str):
    """
    Generates an advanced, AI-style financial summary by synthesizing
    company profile, market trends, technicals, and fundamentals.
    """
    try:
        # --- 1. Data Fetching ---
        company = yf.Ticker(ticker)
        info = company.info
        if not info or 'shortName' not in info:
            return f"⚠️ No company profile data found for **{ticker}**. The symbol may be delisted or invalid."
        hist = company.history(period="1y")
        if hist.empty:
            return f"⚠️ Could not retrieve price history for **{ticker}**."

        # --- 2. Extract Data for Narrative ---
        short_name = info.get('shortName', ticker)
        summary = info.get('longBusinessSummary', 'No business summary available.')
        
        pe_ratio = _format_ratio(info.get('trailingPE'))
        fwd_pe_ratio = _format_ratio(info.get('forwardPE'))
        peg_ratio = _format_ratio(info.get('pegRatio'))
        roe = _format_ratio(info.get('returnOnEquity'), is_percent=True)
        de_ratio = f"{_format_ratio(info.get('debtToEquity'))}%"
        margin = _format_ratio(info.get('profitMargins'), is_percent=True)
        dividend_yield = _format_ratio(info.get('dividendYield'), is_percent=True)
        beta = _format_ratio(info.get('beta'))

        # --- 3. Calculate Market & Technical Data ---
        current_price = hist['Close'].iloc[-1]
        
        hist_6m = hist.tail(126) 
        price_6m_ago = hist_6m['Close'].iloc[0]
        change_6m_pct = ((current_price / price_6m_ago) - 1) * 100
        
        hist_10d = hist.tail(10)
        price_10d_ago = hist_10d['Close'].iloc[0]
        change_10d_pct = ((current_price / price_10d_ago) - 1) * 100

        volatility = _format_ratio(hist_6m['Close'].pct_change().std() * np.sqrt(252), is_percent=True)
        sma_50 = hist['Close'].rolling(50).mean().iloc[-1]
        sma_200 = hist['Close'].rolling(200).mean().iloc[-1]

        # --- 4. Generate AI Narrative ---

        trend_6m_desc = "strong upward" if change_6m_pct > 15 else "upward" if change_6m_pct > 0 else "downward" if change_6m_pct < -5 else "stable"
        trend_10d_desc = "positive" if change_10d_pct > 0 else "negative"
        
        market_narrative = (
            f"Over the past 6 months, the stock has shown a **{trend_6m_desc} trend** ({change_6m_pct:.2f}%). "
            f"Recent short-term (10-day) momentum has been **{trend_10d_desc}** ({change_10d_pct:.2f}%). "
            f"Annualized volatility stands at **{volatility}**, which indicates its price fluctuation."
        )

        if pd.isna(sma_50) or pd.isna(sma_200):
            tech_narrative = "Insufficient data for full technical analysis."
        else:
            tech_posture = "a bullish posture" if current_price > sma_50 and sma_50 > 200 else \
                           "a bearish posture" if current_price < sma_50 and sma_50 < 200 else \
                           "a mixed/transitional posture"
            beta_val = 1.0 if pd.isna(beta) or beta == "N/A" else float(beta) 
            beta_desc = "more volatile than" if beta_val > 1.1 else "less volatile than" if beta_val < 0.9 else "in line with"
            
            # --- MODIFICATION: Removed all ** from variables ---
            tech_narrative = (
                f"From a technical standpoint, the stock is in **{tech_posture}**. "
                f"It is currently trading at ${current_price:.2f}, which is "
                f"{('above' if current_price > sma_50 else 'below')} its 50-day MA (${sma_50:.2f}) "
                f"and {('above' if current_price > sma_200 else 'below')} its 200-day MA (${sma_200:.2f}). "
                f"A Beta of {beta} suggests the stock is {beta_desc} the broader market."
            )

        def safe_float(value, default=0.0):
            try:
                return float(str(value).replace('%', '').replace('N/A', str(default)))
            except (ValueError, TypeError):
                return default

        fwd_pe_val = safe_float(fwd_pe_ratio)
        pe_val = safe_float(pe_ratio)
        peg_val = safe_float(peg_ratio)
        roe_val = safe_float(roe)
        margin_val = safe_float(margin)
        div_val = safe_float(dividend_yield)

        val_desc = "potentially undervalued" if fwd_pe_val < pe_val and peg_val < 1 and fwd_pe_val > 0 and peg_val > 0 else \
                   "appears fully valued" if pe_val > 30 or peg_val > 2 else \
                   "at a reasonable valuation"
        profit_desc = "exceptionally strong" if margin_val > 20 and roe_val > 20 else \
                      "healthy" if margin_val > 10 and roe_val > 15 else \
                      "an area for improvement"
        
        # --- MODIFICATION: Removed all ** from variables ---
        fundamental_narrative = (
            f"Fundamentally, the company is at **{val_desc}** with a TTM P/E of {pe_ratio} and a Forward P/E of {fwd_pe_ratio}. "
            f"Profitability is **{profit_desc}**, with a {margin} profit margin and a {roe} Return on Equity. "
            f"The financial structure includes a Debt-to-Equity ratio of {de_ratio} and a dividend yield of {dividend_yield}."
        )

        # --- 5. Synthesize Final Insight ---
        insight = ""
        if change_6m_pct > 10 and (pe_val > 35 or peg_val > 2):
            insight = (f"The market has priced in significant optimism (**{change_6m_pct:.0f}%** 6-mo gain), "
                       f"and valuations (P/E: {pe_ratio}) appear stretched. This suggests high expectations are already set.")
        elif change_6m_pct < -5 and roe_val > 15 and margin_val > 10:
            insight = (f"There appears to be a disconnect: the stock has a negative 6-month trend (**{change_6m_pct:.0f}%**), "
                       f"but its core fundamentals (ROE: {roe}, Margin: {margin}) remain strong, suggesting a potential misalignment.")
        elif trend_6m_desc == "stable" and div_val > 2:
            insight = (f"The stock has provided stability and a solid dividend (**{dividend_yield}**), "
                       f"making it a potential candidate for income-focused portfolios.")
        else:
            insight = (f"The company's market performance (**{trend_6m_desc} trend**) appears "
                       f"justified by its fundamentals, showing a balanced profile between valuation and profitability.")

        # --- 6. Combine all parts into the final summary ---
        summary = f"""
### 🧠 Analysis

**Market & Trend:**
> {market_narrative}

**Technical Posture:**
> {tech_narrative}

**Fundamentals:**
> {fundamental_narrative}

---

### 💡 Analyst Insight
> **{insight}**
        """
        return summary

    except Exception as e:
        print(traceback.format_exc()) # For debugging in the console
        return f"⚠️ An error occurred while generating the AI summary for **{ticker}**: {e}"