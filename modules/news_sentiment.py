"""Finance-contextual news sentiment, scored on full articles.

Three things this does that headline-only FinBERT does not:

1. **Reads the article, not the headline.** Headlines are written to be
   ambiguous or dramatic ("X in focus", "all you need to know"). The body says
   what actually happened. We fetch the publisher page, extract the text, and
   score it.

2. **Only scores sentences about this company.** A market round-up naming
   twenty companies must not hand its overall tone to each of them. Sentences
   that do not refer to the company are dropped before scoring.

3. **Knows Indian market vocabulary.** FinBERT is trained on US analyst-report
   tone and is flat on the events that actually move Indian stocks — promoter
   pledges, QIPs, SEBI probes, block deals, bonus issues, NCLT admissions. A
   bounded lexicon overlay supplies that, without being allowed to overrule the
   model outright.

Scores are in [-1, 1]. The sign convention is the investor's: positive means
good for a holder of the stock.
"""

import logging
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse, parse_qs, unquote

import requests
from bs4 import BeautifulSoup

from modules import finbert_backend as _sent  # .score(); FinBERT locally, hosted API on serverless

logger = logging.getLogger(__name__)

_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
_TIMEOUT = 7
_MAX_WORKERS = 6
_ARTICLE_TTL = 3600

_article_cache: dict[str, tuple[float, str]] = {}
_cache_lock = threading.Lock()

# ---------------------------------------------------------------------------
# Finance event lexicon. Weights are the size of the nudge, not the final
# score; the total overlay is clamped so wording can shade a reading but never
# invent one. Tuned for Indian listed-company news.
# ---------------------------------------------------------------------------
_BULLISH = {
    r"\bbonus issue\b": 0.5, r"\bstock split\b": 0.3, r"\bbuyback\b": 0.5,
    r"\brecord (?:date|dividend)\b": 0.3, r"\bspecial dividend\b": 0.5,
    r"\bdividend (?:hike|raised|increase)": 0.5,
    r"\border (?:win|book)\b": 0.5,
    # Order sizes sit between the verb and the noun ("bags a Rs 2,400 crore order"),
    # so these have to span the amount rather than expect adjacent words.
    r"\bbags?\b.{0,40}\b(?:order|contract|deal|project)\b": 0.6,
    r"\bwins?\b.{0,40}\b(?:order|contract|mandate|tender|project)\b": 0.6,
    r"\bnew high\b|\brecord high\b|\ball-?time high\b": 0.4,
    r"\bupgrade[sd]?\b|\braises? target\b|\btarget price raised\b": 0.6,
    r"\bbeats? (?:estimates|expectations|street)\b": 0.7,
    r"\bprofit (?:jumps?|surges?|rises?|doubles?|up)\b": 0.6,
    r"\bmargin expansion\b|\bmargins? (?:improve|expand)": 0.5,
    r"\bcapacity expansion\b|\bcapex\b": 0.2,
    r"\bstake (?:buy|purchase|acquisition)\b": 0.2,
    r"\bdebt (?:reduction|repayment|free)\b|\bdeleverag": 0.5,
    r"\bcredit rating upgrade\b|\brating upgraded\b": 0.6,
    r"\bapproval (?:from|by) (?:cdsco|usfda|fda|cci|rbi|sebi)\b": 0.5,
    r"\bturnaround\b|\bback (?:to|in) (?:the )?black\b": 0.5,
}
_BEARISH = {
    r"\bpromoters?\b.{0,25}\bpledg\w*": -0.7,
    r"\bpledg\w*\b.{0,25}\bshares\b": -0.5,
    r"\bqip\b|\bpreferential (?:issue|allotment)\b": -0.2,
    r"\bstake sale\b|\bblock deal\b|\boffloads?\b|\bpares? stake\b": -0.4,
    r"\bsebi\b.{0,30}\b(?:probe|investigat|notice|order|ban|penalt|show cause)": -0.9,
    r"\b(?:income tax|gst|ed|cbi)\b.{0,25}\b(?:raid|notice|search|summons)": -0.8,
    r"\bauditor (?:resign|quit|flags?|qualifi)": -0.9,
    r"\bnclt\b|\binsolvenc|\bbankrupt|\bliquidat": -0.9,
    r"\bdefault(?:s|ed)?\b|\bmisses? (?:payment|repayment)\b": -0.8,
    r"\bfraud\b|\bembezzl|\bsiphon|\bshell (?:compan|entit)": -0.9,
    r"\bdowngrade[sd]?\b|\bcuts? target\b|\btarget price cut\b": -0.6,
    r"\bmisses? (?:estimates|expectations|street)\b": -0.7,
    r"\bnet loss\b|\bloss widens?\b|\bslips? into (?:the )?red\b": -0.7,
    r"\bprofit (?:falls?|drops?|declines?|slumps?|plunges?|down)\b": -0.6,
    r"\bbad loans?\b|\bnpas?\b|\basset quality (?:deterior|worsen|stress)": -0.7,
    r"\bmargin (?:pressure|contraction|compression)\b|\bmargins? (?:shrink|contract|fall)": -0.5,
    r"\brecall\b|\bban(?:s|ned)?\b|\bsuspend": -0.6,
    r"\bresign(?:s|ed|ation)\b.{0,25}\b(?:ceo|cfo|md|chairman|director)": -0.6,
    r"\b(?:ceo|cfo|md|chairman)\b.{0,25}\bresign": -0.6,
    r"\blayoffs?\b|\bjob cuts?\b|\bshuts? down\b|\bplant closure\b": -0.5,
    r"\b52-week low\b|\bhits? (?:a )?(?:new )?low\b|\bcrash(?:es|ed)?\b|\bplunge[sd]?\b|\btumble[sd]?\b": -0.5,
    r"\bcredit rating downgrade\b|\brating downgraded\b": -0.7,
    r"\bstake (?:sold|sale) by promoter": -0.7,
}
_BULL_RE = [(re.compile(p, re.I), w) for p, w in _BULLISH.items()]
_BEAR_RE = [(re.compile(p, re.I), w) for p, w in _BEARISH.items()]

# Headlines that carry no information; scoring them produces noise.
_EMPTY_RE = re.compile(
    r"all you need to know|here's what|what to expect|in focus|stocks? to watch|"
    r"top (?:gainers|losers|picks)|market wrap|closing bell|live updates?|"
    r"buy or sell|should you (?:buy|invest)", re.I)


# ---------------------------------------------------------------------------
# Article fetching
# ---------------------------------------------------------------------------
def _resolve(url: str) -> str:
    """Google News wraps publisher links; unwrap what we can cheaply."""
    try:
        u = urlparse(url)
        if "news.google" in u.netloc:
            qs = parse_qs(u.query)
            if "url" in qs:
                return unquote(qs["url"][0])
    except Exception:
        pass
    return url


def _extract(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    for bad in soup(["script", "style", "nav", "header", "footer", "aside", "form", "noscript"]):
        bad.decompose()
    node = soup.find("article") or soup.find(attrs={"itemprop": "articleBody"})
    if node is None:
        # Densest block of paragraphs on the page is almost always the story.
        best, best_len = None, 0
        for cand in soup.find_all(["div", "section", "main"], limit=400):
            ps = cand.find_all("p", recursive=False)
            n = sum(len(p.get_text(strip=True)) for p in ps)
            if n > best_len:
                best, best_len = cand, n
        node = best or soup
    paras = [p.get_text(" ", strip=True) for p in node.find_all("p")]
    text = " ".join(p for p in paras if len(p) > 40)
    return re.sub(r"\s+", " ", text).strip()


def fetch_article(url: str) -> str:
    """Article body text, or '' when it cannot be retrieved."""
    if not url or url == "#":
        return ""
    now = time.time()
    with _cache_lock:
        hit = _article_cache.get(url)
        if hit and now - hit[0] < _ARTICLE_TTL:
            return hit[1]
    text = ""
    try:
        r = requests.get(_resolve(url), timeout=_TIMEOUT,
                         headers={"User-Agent": _UA, "Accept-Language": "en-IN,en;q=0.9"},
                         allow_redirects=True)
        if r.status_code == 200 and "html" in r.headers.get("content-type", ""):
            text = _extract(r.text)
            # Landed on Google's interstitial rather than the publisher.
            if "news.google" in urlparse(r.url).netloc and len(text) < 400:
                text = ""
    except Exception:
        pass
    with _cache_lock:
        _article_cache[url] = (now, text)
        if len(_article_cache) > 800:
            for k in sorted(_article_cache, key=lambda k: _article_cache[k][0])[:200]:
                _article_cache.pop(k, None)
    return text


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------
# Words that appear in thousands of company names and in unrelated articles.
# Matching on these is how a Porsche story ends up scored as TCS news.
_GENERIC = {
    "limited", "ltd", "inc", "corporation", "corp", "company", "co", "the",
    "india", "indian", "industries", "enterprises", "services", "service",
    "solutions", "systems", "technologies", "technology", "holdings", "group",
    "international", "global", "national", "products", "finance", "financial",
    "investments", "ventures", "projects", "energy", "power", "steel", "motors",
    "bank", "banking", "insurance", "life", "general", "chemicals", "pharma",
    "pharmaceuticals", "laboratories", "labs", "cements", "cement", "textiles",
    "auto", "consultancy", "consulting", "digital", "networks", "communications",
    "and", "for",
}


def _company_tokens(company: str, symbol: str) -> list[str]:
    """Distinctive identifiers only. Generic corporate words are dropped, so
    relevance means 'this story names the company', not 'this story contains
    the word services'."""
    toks = {t.lower() for t in re.findall(r"[A-Za-z&]{3,}", company)}
    toks -= _GENERIC
    base = symbol.replace(".NS", "").replace(".BO", "").lower()
    if base:
        toks.add(base)
    # A two-word opening ("tata consultancy", "bajaj finance") identifies a
    # company even when each half alone does not.
    words = [w.lower() for w in re.findall(r"[A-Za-z&]{2,}", company)]
    if len(words) >= 2 and words[0] not in _GENERIC:
        toks.add(f"{words[0]} {words[1]}")
    return sorted(toks, key=len, reverse=True)


def _split_sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 25]


def _lexicon(text: str) -> float:
    """Bounded finance-event adjustment for what FinBERT's training missed."""
    score = 0.0
    for rx, w in _BULL_RE:
        if rx.search(text):
            score += w
    for rx, w in _BEAR_RE:
        if rx.search(text):
            score += w
    return max(-1.0, min(1.0, score))


def _blend(model: float, lex: float) -> float:
    """Model leads; the lexicon shifts it. When the model is flat but the
    vocabulary is unambiguous (a bonus issue, an auditor resigning), the
    lexicon is allowed to carry more weight — that flatness is exactly the
    blind spot it exists to cover."""
    weight = 0.55 if abs(model) < 0.25 else 0.3
    return max(-1.0, min(1.0, model * (1 - weight) + lex * weight))


def score_article(title: str, body: str, tokens: list[str]) -> dict:
    """Score one article. Returns the blended score and its components."""
    title = (title or "").strip()
    head_model = _sent.score(title) if title else 0.0
    head_lex = _lexicon(title)
    head = _blend(head_model, head_lex)

    relevant: list[str] = []
    if body:
        sents = _split_sentences(body)
        for i, s in enumerate(sents[:60]):
            low = s.lower()
            if any(t in low for t in tokens):
                relevant.append(s)
            # Opening lines of a story are about its subject even before the
            # company is named again.
            elif i < 3 and len(relevant) == 0:
                relevant.append(s)

    if not relevant:
        return {"score": round(head, 3), "headline_score": round(head, 3),
                "body_score": None, "basis": "headline", "sentences_used": 0}

    # Lead sentences carry the story; later ones are background.
    chunk, scores, weights = [], [], []
    for i, s in enumerate(relevant[:25]):
        chunk.append(s)
        if sum(len(c) for c in chunk) > 900 or i == len(relevant[:25]) - 1:
            joined = " ".join(chunk)
            m = _sent.score(joined)
            scores.append(_blend(m, _lexicon(joined)))
            weights.append(1.0 / (1 + 0.6 * len(scores)))
            chunk = []
    body_score = sum(s * w for s, w in zip(scores, weights)) / sum(weights) if scores else 0.0

    # The body decides; the headline is a check on it.
    final = 0.32 * head + 0.68 * body_score
    return {"score": round(max(-1.0, min(1.0, final)), 3),
            "headline_score": round(head, 3),
            "body_score": round(body_score, 3),
            "basis": "article",
            "sentences_used": len(relevant)}


def label_for(score: float) -> str:
    return "positive" if score > 0.15 else "negative" if score < -0.15 else "neutral"


def yahoo_news(symbol: str) -> list[dict]:
    """Yahoo's per-ticker feed. Worth having as the primary source because it
    carries the real publisher URL and a summary — Google News now hides the
    target behind an encrypted redirect that cannot be resolved offline, so
    those items can only ever be scored on their headline."""
    try:
        import yfinance as yf
        raw = yf.Ticker(symbol).news or []
    except Exception:
        logger.exception("yahoo news failed for %s", symbol)
        return []
    out = []
    for it in raw:
        c = it.get("content") or it
        title = (c.get("title") or "").strip()
        if not title:
            continue
        url = ""
        for key in ("canonicalUrl", "clickThroughUrl"):
            v = c.get(key)
            if isinstance(v, dict) and v.get("url"):
                url = v["url"]
                break
        prov = c.get("provider") or {}
        out.append({
            "title": title,
            "link": url or "#",
            "summary": (c.get("summary") or c.get("description") or "").strip(),
            "source": prov.get("displayName") if isinstance(prov, dict) else None,
            "published": c.get("pubDate"),
        })
    return out


def _mentions(text: str, tokens: list[str]) -> bool:
    low = (text or "").lower()
    return any(t in low for t in tokens)


def analyse(headlines: list[dict], company: str, symbol: str, limit: int = 15) -> dict:
    """Score {title, link, summary?} items for one company."""
    tokens = _company_tokens(company, symbol)
    items = headlines[:limit]

    bodies: dict[int, str] = {}
    with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as ex:
        futs = {ex.submit(fetch_article, h.get("link", "")): i for i, h in enumerate(items)}
        for f in as_completed(futs, timeout=_TIMEOUT * 3 + 5):
            try:
                bodies[futs[f]] = f.result()
            except Exception:
                bodies[futs[f]] = ""

    out = []
    for i, h in enumerate(items):
        title = h.get("title", "")
        body = bodies.get(i, "")
        summary = (h.get("summary") or "").strip()
        # A summary is real reporting text, so it beats a headline even when
        # the publisher page cannot be fetched.
        if len(body) < 300 and summary:
            body = summary if not body else f"{summary} {body}"
        # Yahoo's ticker feed carries stories about other companies. If neither
        # the headline nor the text names this one, it says nothing about it.
        in_title = _mentions(title, tokens)
        if not in_title and not _mentions(body[:1500], tokens):
            out.append({
                "title": title, "link": h.get("link", "#"),
                "sentiment": 0.0, "label": "neutral", "basis": "off-topic",
                "headline_sentiment": 0.0, "body_sentiment": None,
                "source": h.get("source"), "published": h.get("published"),
            })
            continue
        try:
            r = score_article(title, body, tokens)
        except Exception:
            logger.exception("scoring failed")
            r = {"score": 0.0, "headline_score": 0.0, "body_score": None,
                 "basis": "headline", "sentences_used": 0}
        # A round-up headline with no usable body carries no company signal.
        if r["basis"] == "headline" and _EMPTY_RE.search(title or ""):
            r["score"] = 0.0
            r["basis"] = "uninformative"
        out.append({
            "title": title,
            "link": h.get("link", "#"),
            "sentiment": r["score"],
            "label": label_for(r["score"]),
            "basis": r["basis"],
            "headline_sentiment": r["headline_score"],
            "body_sentiment": r["body_score"],
            "source": h.get("source"),
            "published": h.get("published"),
            "relevance": "direct" if in_title else "mention",
        })

    scored = [i for i in out if i["basis"] not in ("uninformative", "off-topic")]
    # Full-article reads are more trustworthy than headline-only ones.
    if scored:
        # A story that names the company in its headline is about the company.
        # One that mentions it midway is usually a round-up, so it counts less.
        w = [(1.0 if i["basis"] == "article" else 0.5) *
             (1.0 if i.get("relevance") == "direct" else 0.4) for i in scored]
        avg = sum(i["sentiment"] * wi for i, wi in zip(scored, w)) / sum(w)
    else:
        avg = None

    return {
        "symbol": symbol,
        "company": company,
        "avg_sentiment": round(avg, 3) if avg is not None else None,
        "distribution": {
            "positive": sum(1 for i in out if i["label"] == "positive"),
            "neutral": sum(1 for i in out if i["label"] == "neutral"),
            "negative": sum(1 for i in out if i["label"] == "negative"),
        },
        "articles_read": sum(1 for i in out if i["basis"] == "article"),
        "off_topic": sum(1 for i in out if i["basis"] == "off-topic"),
        "items": out,
    }
