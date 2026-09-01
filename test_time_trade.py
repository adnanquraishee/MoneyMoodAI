import sys
sys.path.insert(0, './api')
from modules.time_trade_random import _candidates
from modules.time_trade import _history, NIFTY
pool = _candidates()
print(f"Candidates pool size: {len(pool) if pool else 0}")
idx = _history(NIFTY)
print(f"NIFTY history available: {idx is not None}")
