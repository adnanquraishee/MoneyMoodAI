"""Sentiment scoring backend, with FinBERT made optional.

torch + transformers are ~518 MB, which is more than twice Vercel's 250 MB
serverless bundle limit. So the model is loaded only if it happens to be
installed (local development, or any host with room), and otherwise the same
scores come from Groq's hosted API — which the app already uses for Salahkaar,
with the key already configured.

Both paths return the same thing: a score in [-1, 1] where positive means good
for a holder of the stock. Callers do not need to know which one ran.
"""

import json
import logging
import os
import re
import threading
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
# compound-mini answers in plain JSON. The gpt-oss/qwen reasoning models
# spend the token budget thinking before emitting any, so they fail the
# json_object validator outright.
GROQ_MODEL = "groq/compound-mini"
_TIMEOUT = 20

_lock = threading.Lock()
_cache: dict[str, float] = {}
_CACHE_MAX = 2000


# --------------------------------------------------------------- local model
def _try_load_finbert():
    try:
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        import torch  # noqa: F401
    except Exception:
        logger.info("FinBERT not installed — sentiment will use the hosted API")
        return None
    try:
        tok = AutoTokenizer.from_pretrained("yiyanghkust/finbert-tone")
        mdl = AutoModelForSequenceClassification.from_pretrained("yiyanghkust/finbert-tone")

        def idx(name: str) -> int:
            for i, lbl in mdl.config.id2label.items():
                if lbl.strip().lower() == name:
                    return int(i)
            raise KeyError(name)

        # Read the order from the model. finbert-tone ships
        # {0: Neutral, 1: Positive, 2: Negative}; assuming the conventional
        # order here is what previously inverted every score.
        return {"tok": tok, "mdl": mdl, "pos": idx("positive"), "neg": idx("negative")}
    except Exception:
        logger.exception("FinBERT failed to load — falling back to the hosted API")
        return None


_FINBERT = _try_load_finbert()
HAS_LOCAL_MODEL = _FINBERT is not None


def _finbert_score(text: str) -> float:
    import torch
    b = _FINBERT
    inputs = b["tok"](text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        logits = b["mdl"](**inputs).logits
    p = torch.nn.functional.softmax(logits, dim=-1)[0]
    return float(p[b["pos"]]) - float(p[b["neg"]])


# ----------------------------------------------------------------- hosted API
def _api_key() -> str | None:
    key = os.getenv("GROQ_API_KEY")
    if key:
        return key.strip()
    env_file = Path(__file__).resolve().parent.parent / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("GROQ_API_KEY="):
                return line.split("=", 1)[1].strip()
    return None


_PROMPT = (
    "You rate financial news for an investor holding the stock in question. "
    "Reply with ONLY a JSON object: {\"score\": <number between -1 and 1>}. "
    "-1 means clearly bad for the shareholder (fraud, losses widening, regulatory action, "
    "downgrades, defaults). +1 means clearly good (profit growth, order wins, upgrades, "
    "buybacks, debt reduction). 0 means neutral or purely factual. "
    "Judge the effect on the shareholder, not the emotional tone of the writing."
)

_NUM = re.compile(r"-?\d*\.?\d+")


def _groq_score(text: str) -> float:
    key = _api_key()
    if not key:
        return 0.0
    try:
        resp = requests.post(
            GROQ_URL,
            json={
                "model": GROQ_MODEL,
                "temperature": 0.0,
                "max_tokens": 40,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": _PROMPT},
                    {"role": "user", "content": text[:4000]},
                ],
            },
            timeout=_TIMEOUT,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        try:
            val = float(json.loads(content).get("score", 0.0))
        except Exception:
            m = _NUM.search(content)
            val = float(m.group()) if m else 0.0
        return max(-1.0, min(1.0, val))
    except Exception:
        logger.exception("hosted sentiment call failed")
        return 0.0


# -------------------------------------------------------------------- public
def score(text: str) -> float:
    """Sentiment for one piece of text, in [-1, 1]."""
    text = (text or "").strip()
    if not text:
        return 0.0
    key = text[:400]
    with _lock:
        if key in _cache:
            return _cache[key]
    try:
        val = _finbert_score(text) if _FINBERT else _groq_score(text)
    except Exception:
        logger.exception("sentiment scoring failed")
        val = 0.0
    with _lock:
        if len(_cache) >= _CACHE_MAX:
            for k in list(_cache)[:_CACHE_MAX // 4]:
                _cache.pop(k, None)
        _cache[key] = val
    return val


def backend_name() -> str:
    return "finbert-local" if _FINBERT else "groq-hosted"
