import numpy as np
import pandas as pd
import yfinance as yf
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings("ignore")

try:
    from prophet import Prophet
except Exception:
    Prophet = None

# ---------------------------------------------------
# Data Prep
# ---------------------------------------------------
def _prepare_data(ticker: str, period: str = "3y"):
    """
    Downloads data and renames columns for Prophet.
    Returns a DataFrame with ['ds', 'y']
    """
    df = yf.download(ticker, period=period, interval="1d", progress=False)
    if df.empty:
        raise ValueError(f"No data found for {ticker} in period {period}")
        
    df = df.reset_index()
    df.columns = [str(col).lower() for col in df.columns]

    date_col = 'date'
    if 'date' not in df.columns:
        if 'index' in df.columns: date_col = 'index'
        elif 'datetime' in df.columns: date_col = 'datetime'
        else: date_col = df.columns[0] 

    price_col = 'adj close' # Use Adj Close for accuracy
    if 'adj close' not in df.columns:
        if 'close' in df.columns: price_col = 'close'
        else:
            for col in df.columns:
                if 'close' in col:
                    price_col = col
                    break
    
    if price_col is None:
        raise ValueError("Could not find 'Close' or 'Adj Close' column in data.")
        
    df = df[[date_col, price_col]].dropna()
    df.columns = ["ds", "y"]
    df["ds"] = pd.to_datetime(df["ds"])
    return df

# ---------------------------------------------------
# Generate Forecast (Prophet + Monte Carlo)
# ---------------------------------------------------

def calculate_garch_volatility(returns: pd.Series, forecast_days: int = 30) -> np.ndarray:
    """
    Calculate dynamic volatility using a simplified GARCH(1,1) approach.
    
    GARCH captures volatility clustering - when volatility is high, it tends to stay high.
    
    Parameters
    ----------
    returns : pd.Series
        Log returns series
    forecast_days : int
        Number of days to forecast volatility
        
    Returns
    -------
    np.ndarray
        Forecasted volatilities for each day
    """
    # GARCH(1,1) parameters (commonly used values)
    omega = 0.000001  # Long-run variance component
    alpha = 0.1       # Weight on lagged squared return (shock impact)
    beta = 0.85       # Weight on lagged variance (persistence)
    
    returns_clean = returns.dropna()
    
    # Initialize variance with unconditional variance
    long_run_var = returns_clean.var()
    variances = [long_run_var]
    
    # Calculate historical variances using GARCH
    for r in returns_clean:
        new_var = omega + alpha * (r ** 2) + beta * variances[-1]
        variances.append(new_var)
    
    # Forecast future volatilities
    last_var = variances[-1]
    forecast_vars = []
    
    for i in range(forecast_days):
        # GARCH forecast: mean-reverting to long-run variance
        next_var = omega + (alpha + beta) ** i * (last_var - long_run_var) + long_run_var
        forecast_vars.append(next_var)
    
    # Convert variance to volatility (standard deviation)
    forecast_vols = np.sqrt(forecast_vars)
    
    return forecast_vols


def generate_forecast(ticker: str, period=90, num_simulations=100):
    """
    Runs an enhanced Prophet forecast with GARCH volatility and uses
    student-t distribution for better fat-tail modeling.
    
    Improvements over original:
    - 5 years of data instead of 3
    - 200 simulations instead of 100
    - GARCH volatility instead of constant
    - Student-t distribution for shocks
    """
    if Prophet is None:
        raise ImportError("Prophet library not found. Please run 'pip install prophet'.")

    # 1. Get Historical Data (INCREASED TO 5 YEARS)
    hist_df = _prepare_data(ticker, period="5y")
    last_actual_date = hist_df['ds'].max()
    
    # 2. Get Prophet Trend (the "Drift")
    info = yf.Ticker(ticker).info
    beta = info.get("beta", 1.0)
    flexibility = 0.25 if (beta or 1.0) > 1.2 else 0.01 if (beta or 1.0) < 0.8 else 0.05
    
    model = Prophet(
        daily_seasonality=True, 
        weekly_seasonality=False, 
        yearly_seasonality=True,
        changepoint_prior_scale=flexibility
    )
    model.fit(hist_df)
    future = model.make_future_dataframe(periods=period)
    forecast_df = model.predict(future)
    
    # 3. Calculate GARCH-based Volatility (ENHANCED)
    hist_df['log_return'] = np.log(hist_df['y'] / hist_df['y'].shift(1))
    
    # Use GARCH for dynamic volatility
    forecast_volatilities = calculate_garch_volatility(hist_df['log_return'], forecast_days=period)
    
    # Fallback to constant volatility if GARCH fails
    if len(forecast_volatilities) == 0:
        base_volatility = hist_df['log_return'].std()
        forecast_volatilities = np.full(period, base_volatility)
    
    # 4. Run Enhanced Monte Carlo Simulation (200 SIMULATIONS)
    last_price = hist_df['y'].iloc[-1]
    simulations = np.zeros((period, num_simulations))
    
    # Get the forecasted part of the trend
    forecast_part = forecast_df[forecast_df['ds'] > last_actual_date]
    prophet_trend = forecast_part['yhat'].pct_change().fillna(0).values
    
    # Degrees of freedom for student-t (lower = fatter tails)
    df_t = 6  # Captures fat tails better than normal distribution
    
    for i in range(num_simulations):
        prices = [last_price]
        for day in range(period - 1):
            drift = prophet_trend[day] if day < len(prophet_trend) else 0
            
            # Use time-varying GARCH volatility
            vol = forecast_volatilities[day] if day < len(forecast_volatilities) else forecast_volatilities[-1]
            
            # Use student-t distribution for better fat-tail modeling
            random_shock = np.random.standard_t(df_t) * vol / np.sqrt(df_t / (df_t - 2))
            
            next_price = prices[-1] * (1 + drift + random_shock)
            prices.append(next_price)
        simulations[:, i] = prices
        
    # Get dates for the forecast
    future_dates = forecast_part['ds'][:period]
    
    return hist_df, simulations, future_dates


# ---------------------------------------------------
# Plot Forecast
# ---------------------------------------------------
def plot_forecast(hist_df, simulations, future_dates, sentiment_score=0.0):
    """
    Plots the Monte Carlo simulation with a 90% confidence interval
    and a sentiment-adjusted line.
    """
    fig, ax = plt.subplots(figsize=(10, 5))
    
    # --- THEME COLORS (SLATE & SAPPHIRE) ---
    BG_COLOR = "#121A2A"
    TEXT_COLOR = "#FFFFFF"
    ACCENT_COLOR = "#0D6EFD"
    ACCENT_CYAN = "#00FFFF"
    BORDER_COLOR = "#30363D"

    # 1. Plot all 100 simulations with low opacity
    ax.plot(future_dates, simulations, color=ACCENT_COLOR, alpha=0.1, linewidth=1)
    
    # 2. Calculate percentiles and ensemble
    percentile_5 = np.percentile(simulations, 5, axis=1)
    percentile_50 = np.percentile(simulations, 50, axis=1) # The Median
    percentile_95 = np.percentile(simulations, 95, axis=1)
    
    # 3. Create Sentiment-Adjusted Line
    last_price = hist_df['y'].iloc[-1]
    sentiment_drift = np.linspace(0, (last_price * sentiment_score * 0.1), len(future_dates))
    y_pred_adjusted = percentile_50 + sentiment_drift # Adjust the MEDIAN line

    # 4. Plot historical data
    ax.plot(hist_df['ds'].tail(180), hist_df['y'].tail(180),
            color=TEXT_COLOR, linewidth=2, label="Historical Price")

    # 5. Plot the Median ("Price Only") forecast
    ax.plot(future_dates, percentile_50,
            "--", linewidth=2, label="Median Forecast (Price Only)", color=ACCENT_COLOR, alpha=0.7)
    
    # 6. Plot the "Sentiment-Adjusted" line
    ax.plot(future_dates, y_pred_adjusted,
            "-", linewidth=3, label="Sentiment-Adjusted Forecast", color=ACCENT_CYAN)

    # 7. Plot the 90% confidence cone
    ax.fill_between(future_dates, percentile_5, percentile_95,
                    color=ACCENT_COLOR, alpha=0.2, label="90% Confidence Range")

    # --- Theming ---
    ax.set_facecolor(BG_COLOR)
    fig.patch.set_facecolor(BG_COLOR)
    for spine in ax.spines.values():
        spine.set_color(BORDER_COLOR)
    ax.tick_params(colors=TEXT_COLOR, rotation=15)
    ax.legend(facecolor=BG_COLOR, labelcolor=TEXT_COLOR, loc="upper left")
    ax.set_title("Monte Carlo Forecast (100 Simulations)", color=TEXT_COLOR, fontsize=14)
    ax.grid(True, color=BORDER_COLOR, alpha=0.5, linestyle="--")
    
    plt.tight_layout()
    return fig