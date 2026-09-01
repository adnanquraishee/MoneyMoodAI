import numpy as np
import matplotlib.pyplot as plt
from nltk.sentiment.vader import SentimentIntensityAnalyzer
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
from modules import data_fetch
import nltk
nltk.download("vader_lexicon", quiet=True)

# Load FinBERT model once
_tokenizer = AutoTokenizer.from_pretrained("yiyanghkust/finbert-tone")
_model = AutoModelForSequenceClassification.from_pretrained("yiyanghkust/finbert-tone")
_sia = SentimentIntensityAnalyzer() # Load VADER once

# Read the label order from the model instead of assuming it. finbert-tone
# ships {0: Neutral, 1: Positive, 2: Negative} — NOT the negative/neutral/
# positive order that is conventional elsewhere. Hardcoding indices here had
# the model computing (negative - neutral), which inverted the sign of every
# score and fed that inversion into the news tab and the forecast engine.
def _label_index(name: str) -> int:
    for i, lbl in _model.config.id2label.items():
        if lbl.strip().lower() == name:
            return int(i)
    raise KeyError(name)


_POS_IDX = _label_index("positive")
_NEG_IDX = _label_index("negative")
_labels = [_model.config.id2label[i].strip().lower() for i in sorted(_model.config.id2label)]


def finbert_probs(text: str) -> tuple[float, float, float]:
    """(negative, neutral, positive) probabilities for one piece of text."""
    inputs = _tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        logits = _model(**inputs).logits
    p = torch.nn.functional.softmax(logits, dim=-1)[0]
    neg, pos = float(p[_NEG_IDX]), float(p[_POS_IDX])
    return neg, max(0.0, 1.0 - neg - pos), pos


def finbert_score(text):
    """FinBERT sentiment score in [-1, 1]: positive probability minus negative."""
    try:
        neg, _, pos = finbert_probs(text)
        return pos - neg
    except Exception:
        return 0.0

def _get_hybrid_score(text: str):
    """Helper to get a single hybrid score for one headline."""
    vader_score = _sia.polarity_scores(text)["compound"]
    finbert_s = finbert_score(text)
    return 0.7 * finbert_s + 0.3 * vader_score

def analyze_sentiment(company_name: str):
    """
    Analyze recent news sentiment for a company using both
    VADER (lexical) and FinBERT (contextual financial) models.
    Returns (summary string, matplotlib figure, avg_sentiment float).
    """
    try:
        headlines = data_fetch.get_headlines(company_name)

        if not headlines:
            return "No recent headlines found.", None, 0.0

        valid = []
        seen = set()
        for h in headlines:
            title = h.get("title", "").strip()
            if not title or len(title) < 8 or title in seen:
                continue
            seen.add(title)
            valid.append(title)

        if not valid:
            return "No valid text headlines found.", None, 0.0

        # Calculate hybrid scores
        hybrid_scores = [_get_hybrid_score(t) for t in valid]

        avg_sentiment = np.mean(hybrid_scores)
        positive = sum(1 for s in hybrid_scores if s > 0.1)
        negative = sum(1 for s in hybrid_scores if s < -0.1)
        neutral = len(hybrid_scores) - positive - negative
        confidence = min(1.0, len(valid) / 40.0)

        # Tone label
        if avg_sentiment > 0.05:
            tone = "Bullish 😄"
            color = "#1ED760" # Green
        elif avg_sentiment < -0.05:
            tone = "Bearish 😞"
            color = "#D40000" # Red
        else:
            tone = "Neutral 😐"
            color = "#FFC107" # Gold

        summary = (
            f"**Company Sentiment — {company_name}**\n\n"
            f"📰 Headlines analyzed: {len(valid)}\n"
            f"📈 Average Sentiment: {avg_sentiment:.3f}\n"
            f"💬 Tone: {tone}\n"
            f"🔍 Confidence: {confidence:.2f}\n\n"
            f"Hybrid sentiment blends quick lexical (VADER) and deep financial context (FinBERT) "
            f"for a more accurate emotional snapshot of market tone."
        )

        # ---- Visualization (Side-by-Side Bar + Pie) ----
        fig, axes = plt.subplots(1, 2, figsize=(8.5, 2.3))
        fig.patch.set_facecolor("#121A2A") # Panel BG
        
        # Bar
        ax = axes[0]
        ax.barh([0], [avg_sentiment], color=color, height=0.35)
        ax.set_xlim(-1, 1)
        ax.set_yticks([])
        ax.set_xticks([-1, 0, 1])
        ax.set_xticklabels(["Bearish", "Neutral", "Bullish"], color="white", fontsize=8)
        ax.set_title(f"Sentiment Index — {tone}", color="white", fontsize=9)
        ax.set_facecolor("#121A2A")
        for spine in ax.spines.values():
            spine.set_color("#30363D")
        ax.grid(True, color="#30363D", alpha=0.25)

        # Pie
        ax2 = axes[1]
        sizes = [positive, neutral, negative]
        labels = ["Positive", "Neutral", "Negative"]
        colors = ["#1ED760", "#FFC107", "#D40000"]
        ax2.pie(
            sizes,
            labels=labels,
            autopct="%1.1f%%",
            startangle=90,
            colors=colors,
            textprops={"color": "white", "fontsize": 8},
        )
        ax2.set_title("Sentiment Breakdown", color="white", fontsize=9)
        ax2.set_facecolor("#121A2A")

        plt.tight_layout(pad=1.0)

        return summary, fig, avg_sentiment

    except Exception as e:
        return f"Error analyzing sentiment: {e}", None, 0.0

# --- NEW FUNCTION ---
def get_headline_sentiment_list(headlines: list):
    """
    Takes a list of headline dicts and returns the same
    list with a 'score' key added to each.
    """
    if not headlines:
        return []

    output_list = []
    seen = set()
    
    for h in headlines:
        title = h.get("title", "").strip()
        
        # Basic cleaning and deduplication
        if not title or len(title) < 8 or title in seen:
            continue
        seen.add(title)
        
        # Calculate hybrid score
        score = _get_hybrid_score(title)
        
        output_list.append({
            "Headline": title,
            "Score": score,
            "Link": h.get("link", "#")
        })
    
    return output_list