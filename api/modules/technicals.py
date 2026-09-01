import pandas as pd
import numpy as np

def calculate_bbands(data: pd.DataFrame, length=20, std_dev=2):
    """Calculates Bollinger Bands and appends them to the DataFrame."""
    # Calculate Middle Band (SMA)
    middle_band = data['Close'].rolling(window=length).mean()
    # Calculate Standard Deviation
    std = data['Close'].rolling(window=length).std()
    
    # Calculate Upper and Lower Bands
    data[f'BBU_{length}_{std_dev}_0'] = middle_band + (std * std_dev)
    data[f'BBM_{length}_{std_dev}_0'] = middle_band
    data[f'BBL_{length}_{std_dev}_0'] = middle_band - (std * std_dev)
    return data

def calculate_rsi(data: pd.DataFrame, length=14):
    """Calculates the Relative Strength Index (RSI) and appends it."""
    delta = data['Close'].diff(1)
    
    # Get positive and negative price changes
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)

    # Calculate the exponential moving average of gain and loss
    avg_gain = gain.ewm(com=length - 1, min_periods=length).mean()
    avg_loss = loss.ewm(com=length - 1, min_periods=length).mean()

    # Calculate RS
    rs = avg_gain / avg_loss
    
    # Calculate RSI
    rsi = 100 - (100 / (1 + rs))
    data[f'RSI_{length}'] = rsi
    return data

def calculate_macd(data: pd.DataFrame, fast=12, slow=26, signal=9):
    """Calculates MACD and appends it."""
    # Calculate Fast and Slow EMAs
    ema_fast = data['Close'].ewm(span=fast, adjust=False).mean()
    ema_slow = data['Close'].ewm(span=slow, adjust=False).mean()
    
    # Calculate MACD line
    data[f'MACD_{fast}_{slow}_{signal}'] = ema_fast - ema_slow
    
    # Calculate Signal line
    data[f'MACDs_{fast}_{slow}_{signal}'] = data[f'MACD_{fast}_{slow}_{signal}'].ewm(span=signal, adjust=False).mean()
    
    # Calculate MACD Histogram
    data[f'MACDh_{fast}_{slow}_{signal}'] = data[f'MACD_{fast}_{slow}_{signal}'] - data[f'MACDs_{fast}_{slow}_{signal}']
    return data