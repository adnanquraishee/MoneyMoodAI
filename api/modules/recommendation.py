# modules/recommendation.py
import numpy as np
import matplotlib.pyplot as plt
import plotly.graph_objects as go
from modules import fundamentals, forecast, sentiment
import pandas as pd
import yfinance as yf

def _normalize(value, low, high):
    if value is None or np.isnan(value):
        return 0
    return max(-1, min(1, 2 * ((value - low) / (high - low)) - 1))

# --- MODIFICATION: Function now accepts pre-computed data ---
def get_recommendation(company_name: str, hist_df: pd.DataFrame, simulations: np.ndarray, sentiment_score: float):
    """
    Generates Buy/Hold/Sell recommendation with
    composite logic + interactive confidence gauge.
    """
    try:
        # ---------- Fundamentals ----------
        metrics, _, _ = fundamentals.get_fundamentals(company_name)
        
        def safe_num(v):
            try: return float(str(v).replace("%","").replace(",","").replace("$",""))
            except: return np.nan

        pe = safe_num(metrics.get("P/E Ratio"))
        roe = safe_num(metrics.get("ROE"))
        pm = safe_num(metrics.get("Profit Margin"))
        de = safe_num(metrics.get("Debt-to-Equity"))

        f_score = 0
        if not np.isnan(pe):  f_score += _normalize(40 - pe, -20, 40)
        if not np.isnan(roe): f_score += _normalize(roe, 0, 25)
        if not np.isnan(pm):  f_score += _normalize(pm, 0, 30)
        if not np.isnan(de):  f_score += _normalize(200 - de, -100, 200) # D/E is a %, so adjust scale
        fundamental_score = f_score / 4 if f_score else 0

        # ---------- Forecast (MODIFIED) ----------
        try:
            # --- Use pre-computed data ---
            last_actual = hist_df['y'].iloc[-1]
            
            # Get the median (50th percentile) of the final day's simulations
            median_forecast_price = np.percentile(simulations[-1, :], 50)
            
            # Create the sentiment-adjusted score
            sentiment_drift = (last_actual * sentiment_score * 0.1) # 10% nudge over 30 days
            avg_future_adjusted = median_forecast_price + sentiment_drift
            
            percent_change = ((avg_future_adjusted - last_actual) / last_actual) * 100
            forecast_score = _normalize(percent_change, -10, 10) # Normalize the adjusted forecast
            
        except Exception as e:
            print(f"Forecast score error: {e}")
            forecast_score = 0

        # ---------- Sentiment (Already provided) ----------
        sentiment_score_normalized = _normalize(sentiment_score, -1, 1)

        # ---------- Composite ----------
        comp = 0.4*forecast_score + 0.3*fundamental_score + 0.3*sentiment_score_normalized
        
        # Determine Label
        if comp > 0.6: label, color = "Strong Buy","#1ED760"
        elif comp > 0.3: label, color = "Buy","#88D66C"
        elif comp > -0.3: label, color = "Hold","#FFC107"
        elif comp > -0.6: label, color = "Sell","#FF6B4E"
        else: label, color = "Strong Sell","#D40000"
        
        # Determine Emoji
        if comp > 0.3: emoji = "📈"
        elif comp < -0.3: emoji = "📉"
        else: emoji = "🤔"


        conf = abs(comp)
        text = (
            f"### 🤖 AI Recommendation — **{company_name}**\n\n"
            f"**Action:** {label} {emoji}\n\n"
            f"📊 **Composite Score:** {comp:.2f}\n"
            f"💡 **Confidence:** {conf:.2f}\n\n"
            f"**Breakdown (Sentiment-Adjusted):**\n"
            f"• 30-Day Monte Carlo Forecast: {forecast_score:.2f}\n"
            f"• Fundamental Health: {fundamental_score:.2f}\n"
            f"• Market Sentiment: {sentiment_score_normalized:.2f}\n\n"
            "AI blends simulation momentum, fundamental health and market tone for this signal."
        )

        # ---------- Plotly Gauge ----------
        gauge = go.Figure(go.Indicator(
            mode="gauge+number+delta",
            value=comp*100,
            delta={"reference":0,"increasing":{"color":color}, "decreasing":{"color":color}},
            gauge={
                "axis":{"range":[-100,100],"tickwidth":1,"tickcolor":"#8899AB"},
                "bar":{"color":color},
                "bgcolor":"#101820", # Match theme background
                "borderwidth":2,
                "bordercolor":"#30363D",
                "steps":[
                    {"range":[-100,-60],"color":"#D40000"},
                    {"range":[-60,-30],"color":"#FF6B4E"},
                    {"range":[-30,30],"color":"#FFC107"},
                    {"range":[30,60],"color":"#88D66C"},
                    {"range":[60,100],"color":"#1ED760"},
                ],
                "threshold":{"line":{"color":"white","width":3},"thickness":0.8,"value":comp*100}
            },
            title={"text":f"<b>{label}</b>", "font":{"color":"white","size":20}}
        ))
        
        gauge.update_layout(
            paper_bgcolor="#121A2A", # Match theme panel
            font={"color":"white"},
            height=280, 
            margin=dict(t=60, b=20, l=30, r=30)
        )

        return text, gauge

    except Exception as e:
        return f"⚠️ Error generating recommendation: {e}", None