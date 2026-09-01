import traceback
import os
import sys

from fastapi import FastAPI
app = FastAPI()

@app.get("/api/debug")
def debug_info():
    try:
        from modules import data_fetch
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "traceback": traceback.format_exc()}

