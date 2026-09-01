# modules/accuracy.py
"""
Forecast accuracy testing and validation module.
Implements backtesting and accuracy metrics for forecast models.
"""

import numpy as np
import pandas as pd
import yfinance as yf
import matplotlib.pyplot as plt
from typing import Dict, List, Tuple
import warnings
warnings.filterwarnings("ignore")

try:
    from prophet import Prophet
except Exception:
    Prophet = None


def calculate_metrics(actual: np.ndarray, predicted: np.ndarray) -> Dict[str, float]:
    """
    Calculate comprehensive accuracy metrics.
    
    Parameters
    ----------
    actual : np.ndarray
        Actual prices
    predicted : np.ndarray
        Predicted prices
        
    Returns
    -------
    Dict[str, float]
        Dictionary containing RMSE, MAE, MAPE, and directional accuracy
    """
    # Remove any NaN values
    actual = np.asarray(actual).flatten()
    predicted = np.asarray(predicted).flatten()
    
    mask = ~(np.isnan(actual) | np.isnan(predicted))
    actual = actual[mask]
    predicted = predicted[mask]
    
    if len(actual) == 0:
        return {
            'RMSE': np.nan,
            'MAE': np.nan,
            'MAPE': np.nan,
            'Directional_Accuracy': np.nan
        }
    
    # Root Mean Square Error
    rmse = np.sqrt(np.mean((actual - predicted) ** 2))
    
    # Mean Absolute Error
    mae = np.mean(np.abs(actual - predicted))
    
    # Mean Absolute Percentage Error
    mape = np.mean(np.abs((actual - predicted) / actual)) * 100
    
    # Directional Accuracy (did we predict the direction correctly?)
    if len(actual) > 1:
        actual_direction = np.diff(actual) > 0
        predicted_direction = np.diff(predicted) > 0
        directional_accuracy = np.mean(actual_direction == predicted_direction) * 100
    else:
        directional_accuracy = np.nan
    
    return {
        'RMSE': rmse,
        'MAE': mae,
        'MAPE': mape,
        'Directional_Accuracy': directional_accuracy
    }


def get_accuracy_score(metrics: Dict[str, float], avg_price: float) -> float:
    """
    Generate an overall accuracy score from 0-100.
    Higher is better.
    
    Parameters
    ----------
    metrics : Dict[str, float]
        Dictionary of accuracy metrics
    avg_price : float
        Average price for normalization
        
    Returns
    -------
    float
        Overall accuracy score (0-100)
    """
    try:
        # Normalize MAPE (lower is better, cap at 50%)
        mape_score = max(0, 100 - metrics['MAPE'] * 2)  # 0% error = 100, 50% error = 0
        
        # Normalize RMSE relative to price (lower is better)
        rmse_pct = (metrics['RMSE'] / avg_price) * 100
        rmse_score = max(0, 100 - rmse_pct * 4)  # 0% = 100, 25% = 0
        
        # Directional accuracy (already 0-100)
        directional_score = metrics['Directional_Accuracy']
        
        # Weighted average (directional accuracy is most important for trading)
        overall_score = (
            0.5 * directional_score +
            0.3 * mape_score +
            0.2 * rmse_score
        )
        
        return max(0, min(100, overall_score))
    except:
        return 0.0


def run_backtest(ticker: str, forecast_days: int = 30, num_simulations: int = 200) -> Dict:
    """
    Run a backtest by forecasting from a past date and comparing to actual prices.
    
    Parameters
    ----------
    ticker : str
        Stock ticker symbol
    forecast_days : int
        Number of days to forecast
    num_simulations : int
        Number of Monte Carlo simulations
        
    Returns
    -------
    Dict
        Dictionary containing metrics, actual prices, predicted prices, dates
    """
    try:
        # Download extended historical data
        data = yf.download(ticker, period="1y", interval="1d", progress=False)
        if data.empty or len(data) < forecast_days + 60:
            return {'error': 'Insufficient data for backtesting'}
        
        # Use data up to forecast_days ago as training
        split_idx = len(data) - forecast_days
        train_data = data.iloc[:split_idx].copy()
        test_data = data.iloc[split_idx:].copy()
        
        # Prepare data for Prophet
        df = train_data.reset_index()
        df.columns = [str(col).lower() for col in df.columns]
        
        # Find date and price columns
        date_col = 'date' if 'date' in df.columns else df.columns[0]
        
        # Try to find close/adj close column
        price_col = None
        for col in ['adj close', 'close', 'adjclose']:
            if col in df.columns:
                price_col = col
                break
        
        # If still not found, look for any column with 'close' in the name
        if price_col is None:
            for col in df.columns:
                if 'close' in col.lower():
                    price_col = col
                    break
        
        if price_col is None:
            return {'error': 'Could not find price column in data'}
        
        df = df[[date_col, price_col]].dropna()
        df.columns = ['ds', 'y']
        df['ds'] = pd.to_datetime(df['ds'])
        
        # Run Prophet forecast
        if Prophet is None:
            return {'error': 'Prophet not installed'}
        
        model = Prophet(
            daily_seasonality=True,
            weekly_seasonality=False,
            yearly_seasonality=True,
            changepoint_prior_scale=0.05
        )
        model.fit(df)
        
        future = model.make_future_dataframe(periods=forecast_days)
        forecast_df = model.predict(future)
        
        # Get forecasted values
        last_actual_date = df['ds'].max()
        forecast_part = forecast_df[forecast_df['ds'] > last_actual_date]
        
        # Calculate volatility from training data
        df['log_return'] = np.log(df['y'] / df['y'].shift(1))
        volatility = df['log_return'].std()
        
        # Run Monte Carlo simulations
        last_price = df['y'].iloc[-1]
        prophet_trend = forecast_part['yhat'].pct_change().fillna(0).values
        
        simulations = np.zeros((min(forecast_days, len(prophet_trend)), num_simulations))
        
        for i in range(num_simulations):
            prices = [last_price]
            for day in range(min(forecast_days - 1, len(prophet_trend) - 1)):
                drift = prophet_trend[day]
                random_shock = np.random.normal(0, volatility)
                next_price = prices[-1] * (1 + drift + random_shock)
                prices.append(next_price)
            simulations[:, i] = prices
        
        # Get median forecast
        predicted_prices = np.percentile(simulations, 50, axis=1)
        
        # Get actual prices
        actual_prices = test_data['Close'].values[:len(predicted_prices)]
        
        # Calculate metrics
        metrics = calculate_metrics(actual_prices, predicted_prices)
        avg_price = np.mean(actual_prices)
        accuracy_score = get_accuracy_score(metrics, avg_price)
        
        # Get dates
        test_dates = test_data.index[:len(predicted_prices)]
        
        # Convert to JSON-serializable types
        return {
            'metrics': {
                'rmse': float(metrics['RMSE']) if not np.isnan(metrics['RMSE']) else None,
                'mae': float(metrics['MAE']) if not np.isnan(metrics['MAE']) else None,
                'mape': float(metrics['MAPE']) if not np.isnan(metrics['MAPE']) else None,
                'directional_accuracy': float(metrics['Directional_Accuracy']) if not np.isnan(metrics['Directional_Accuracy']) else None
            },
            'accuracy_score': float(accuracy_score) if not np.isnan(accuracy_score) else 0.0,
            'forecast_days': int(forecast_days)
        }
        
    except Exception as e:
        print(f"Backtest error: {e}")
        import traceback
        traceback.print_exc()
        return {'error': str(e)}


def plot_backtest_results(results: Dict) -> plt.Figure:
    """
    Plot actual vs predicted prices from backtest.
    
    Parameters
    ----------
    results : Dict
        Results from run_backtest function
        
    Returns
    -------
    plt.Figure
        Matplotlib figure
    """
    if 'error' in results:
        fig, ax = plt.subplots(figsize=(10, 4))
        ax.text(0.5, 0.5, f"Error: {results['error']}", 
                ha='center', va='center', fontsize=12, color='red')
        ax.set_facecolor('#121A2A')
        fig.patch.set_facecolor('#121A2A')
        return fig
    
    fig, ax = plt.subplots(figsize=(10, 5))
    
    # Theme colors
    BG_COLOR = "#121A2A"
    TEXT_COLOR = "#FFFFFF"
    ACTUAL_COLOR = "#1ED760"
    PREDICTED_COLOR = "#0D6EFD"
    BORDER_COLOR = "#30363D"
    
    dates = results['dates']
    actual = results['actual_prices']
    predicted = results['predicted_prices']
    
    # Plot lines
    dates_array = dates if not hasattr(dates, 'to_numpy') else dates.to_numpy()
    ax.plot(dates, actual, color=ACTUAL_COLOR, linewidth=2, label='Actual Price', marker='o', markersize=4)
    ax.plot(dates, predicted, color=PREDICTED_COLOR, linewidth=2, label='Predicted Price', 
            linestyle='--', marker='s', markersize=4)
    
    # Fill area between (only if arrays are compatible)
    try:
        ax.fill_between(dates_array, actual.flatten(), predicted.flatten(), alpha=0.2, color=PREDICTED_COLOR)
    except:
        pass  # Skip fill if there's a shape mismatch
    
    # Styling
    ax.set_facecolor(BG_COLOR)
    fig.patch.set_facecolor(BG_COLOR)
    
    for spine in ax.spines.values():
        spine.set_color(BORDER_COLOR)
    
    ax.tick_params(colors=TEXT_COLOR, rotation=15)
    ax.legend(facecolor=BG_COLOR, labelcolor=TEXT_COLOR, loc='best')
    ax.set_title(f"Backtest: Actual vs Predicted ({results['forecast_days']} days)", 
                 color=TEXT_COLOR, fontsize=14, fontweight='bold')
    ax.set_xlabel('Date', color=TEXT_COLOR)
    ax.set_ylabel('Price', color=TEXT_COLOR)
    ax.grid(True, color=BORDER_COLOR, alpha=0.3, linestyle='--')
    
    plt.tight_layout()
    return fig


def format_metrics_table(metrics: Dict[str, float], accuracy_score: float) -> pd.DataFrame:
    """
    Format metrics as a nice DataFrame for display.
    
    Parameters
    ----------
    metrics : Dict[str, float]
        Accuracy metrics
    accuracy_score : float
        Overall accuracy score
        
    Returns
    -------
    pd.DataFrame
        Formatted metrics table
    """
    data = {
        'Metric': [
            'RMSE (Root Mean Square Error)',
            'MAE (Mean Absolute Error)',
            'MAPE (Mean Abs % Error)',
            'Directional Accuracy',
            'Overall Accuracy Score'
        ],
        'Value': [
            f"${metrics.get('RMSE', 0):.2f}",
            f"${metrics.get('MAE', 0):.2f}",
            f"{metrics.get('MAPE', 0):.2f}%",
            f"{metrics.get('Directional_Accuracy', 0):.1f}%",
            f"{accuracy_score:.1f}/100"
        ],
        'Interpretation': [
            'Lower is better - avg prediction error',
            'Lower is better - avg absolute error',
            'Lower is better - % prediction error',
            'Higher is better - direction prediction',
            'Overall model quality (0-100)'
        ]
    }
    
    return pd.DataFrame(data)
