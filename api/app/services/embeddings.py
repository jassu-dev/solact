import logging
import re
import math
from typing import List, Optional
import os
import threading

import numpy as np
import httpx
from bs4 import BeautifulSoup
from fastembed import TextEmbedding

from ..config import settings

logger = logging.getLogger(__name__)

FASTEMBED_CACHE_DIR = os.environ.get("FASTEMBED_CACHE_DIR", "/root/.cache/huggingface/fastembed")

_model_lock = threading.Lock()
_embedding_model: Optional[TextEmbedding] = None


def get_embedding_model() -> TextEmbedding:
    global _embedding_model
    if _embedding_model is None:
        with _model_lock:
            if _embedding_model is None:
                logger.info(f"Loading fastembed model: {settings.EMBEDDING_MODEL} (cache_dir: {FASTEMBED_CACHE_DIR})")
                os.makedirs(FASTEMBED_CACHE_DIR, exist_ok=True)
                _embedding_model = TextEmbedding(
                    model_name=settings.EMBEDDING_MODEL,
                    cache_dir=FASTEMBED_CACHE_DIR,
                )
    return _embedding_model


def warmup_embeddings():
    """Pre-warm embedding model in memory on server boot to guarantee ~7ms latency."""
    try:
        model = get_embedding_model()
        list(model.embed(["warmup"]))
        logger.info("FastEmbed model pre-warmed successfully in memory.")
    except Exception as e:
        logger.warning(f"Could not pre-warm embedding model: {e}")


def embed_texts(texts: List[str]) -> np.ndarray:
    if not texts:
        return np.zeros((0, settings.EMBEDDING_DIM), dtype=np.float32)
    model = get_embedding_model()
    result = list(model.embed(texts))
    return np.asarray(result, dtype=np.float32)


def embed_single(text: str) -> np.ndarray:
    res = embed_texts([text])
    return res[0] if res.size else np.zeros(settings.EMBEDDING_DIM, dtype=np.float32)


def clean_text(text: str) -> str:
    if not text:
        return ""
    text = BeautifulSoup(text, "lxml").get_text(separator=" ", strip=True)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    return text.strip()


def chunk_text(
    text: str,
    chunk_size: int = 500,
    chunk_overlap: int = 80,
) -> List[str]:
    if not text:
        return []
    words = text.split()
    if len(words) <= chunk_size:
        return [text]
    chunks: List[str] = []
    step = max(1, chunk_size - chunk_overlap)
    for i in range(0, len(words), step):
        chunk_words = words[i : i + chunk_size]
        if chunk_words:
            chunks.append(" ".join(chunk_words))
        if i + chunk_size >= len(words):
            break
    return chunks


def estimate_tokens(text: str) -> int:
    return max(1, int(math.ceil(len(text) / 4)))


def fetch_website_text(url: str, timeout: int = 30) -> str:
    try:
        r = httpx.get(url, timeout=timeout, follow_redirects=True, headers={
            "User-Agent": "Mozilla/5.0 (compatible; SolactBot/1.0; +https://solact.ai)"
        })
        r.raise_for_status()
        html = r.text
        soup = BeautifulSoup(html, "lxml")
        for tag in soup(["script", "style", "nav", "footer", "header", "iframe", "noscript"]):
            tag.decompose()
        title = soup.title.string if soup.title else ""
        main = soup.find("main") or soup.find("article") or soup.find("body") or soup
        text = main.get_text(separator="\n", strip=True)
        return f"# {title}\n\n{text}".strip()
    except Exception as e:
        raise Exception(f"Failed to fetch {url}: {e}")
