"""
vectorstore/faiss_store.py
---------------------------
FAISS vector store wrapper for PromptShield.

WHY FAISS?
  When Layer 1 receives a user input, it needs to compare it against
  potentially 100,000+ known attack embeddings from HackAPrompt + TensorTrust.
  Doing this with a naive numpy loop would be O(n) and too slow.

  FAISS (Facebook AI Similarity Search) uses an Inverted File Index (IVF)
  or Flat index to do approximate nearest-neighbor search in O(log n) or
  even O(1) amortized time — returning the top-k most similar vectors
  in milliseconds even over millions of vectors.

INDEX TYPES USED:
  - IndexFlatIP  : Exact inner product (= cosine sim for normalized vectors).
                   Used when corpus is small (< 50k). Exact but slower.
  - IndexIVFFlat : Approximate, partitions vectors into clusters (nlist).
                   Used when corpus is large (>= 50k). Fast but approximate.

USAGE:
    store = FAISSStore.load("data/attack_embeddings/hackaprompt.index")
    scores, indices = store.search(query_vec, top_k=5)
"""

from __future__ import annotations

import os
import pickle
from pathlib import Path

import faiss
import numpy as np


class FAISSStore:
    """
    Wraps a FAISS index with metadata storage.

    Each vector in the index has a corresponding metadata entry (stored
    in a parallel list) containing the original text and attack label.

    Attributes:
        index     : The FAISS index object
        metadata  : List of dicts, one per vector: {"text": ..., "label": ..., "source": ...}
        dim       : Embedding dimension
    """

    def __init__(self, dim: int):
        self.dim = dim
        self.index: faiss.Index | None = None
        self.metadata: list[dict] = []

    # ── Building ───────────────────────────────────────────────────────────────

    def build(self, vectors: np.ndarray, metadata: list[dict], use_ivf: bool | None = None) -> None:
        """
        Build a FAISS index from a matrix of L2-normalized embeddings.

        Args:
            vectors  : np.ndarray of shape (n, dim), dtype float32, L2-normalized
            metadata : list of dicts, one per vector
            use_ivf  : Force IVF (True) or Flat (False). Auto-detect if None.
        """
        assert vectors.ndim == 2, "vectors must be 2D: (n, dim)"
        assert vectors.shape[1] == self.dim, f"Expected dim={self.dim}, got {vectors.shape[1]}"
        assert len(vectors) == len(metadata), "vectors and metadata must have same length"

        # Ensure float32 — FAISS requires it
        vectors = vectors.astype(np.float32)

        n = len(vectors)

        # Auto-select index type based on corpus size
        if use_ivf is None:
            use_ivf = n >= 50_000

        if use_ivf:
            # IVFFlat: partition into sqrt(n) clusters for fast approximate search
            nlist = max(1, int(np.sqrt(n)))
            nlist = min(nlist, n)  # can't have more clusters than vectors
            quantizer = faiss.IndexFlatIP(self.dim)
            self.index = faiss.IndexIVFFlat(quantizer, self.dim, nlist, faiss.METRIC_INNER_PRODUCT)
            print(f"[FAISS] Training IVFFlat index (n={n}, nlist={nlist}) ...")
            self.index.train(vectors)
        else:
            # Flat exact search — precise, fine for small corpora
            self.index = faiss.IndexFlatIP(self.dim)
            print(f"[FAISS] Building FlatIP index (n={n}) ...")

        self.index.add(vectors)
        self.metadata = metadata
        print(f"[FAISS] Index built. Total vectors: {self.index.ntotal}")

    # ── Searching ──────────────────────────────────────────────────────────────

    def search(self, query_vec: np.ndarray, top_k: int = 5) -> tuple[np.ndarray, list[dict]]:
        """
        Find the top_k most similar vectors to query_vec.

        Args:
            query_vec : 1-D array of shape (dim,), L2-normalized
            top_k     : Number of nearest neighbors to return

        Returns:
            scores    : np.ndarray of shape (top_k,) — cosine similarities
            results   : list of metadata dicts for the top_k matches
        """
        assert self.index is not None, "Index not built yet. Call build() or load() first."

        # FAISS expects shape (1, dim) for single query
        query = query_vec.astype(np.float32).reshape(1, -1)

        # Set nprobe for IVF indexes (how many clusters to search)
        if hasattr(self.index, "nprobe"):
            self.index.nprobe = min(10, self.index.nlist)

        scores, indices = self.index.search(query, top_k)

        # Flatten from (1, top_k) to (top_k,)
        scores = scores[0]
        indices = indices[0]

        # Filter out invalid indices (-1 means FAISS found fewer than top_k results)
        valid = [(s, i) for s, i in zip(scores, indices) if i != -1]

        if not valid:
            return np.array([]), []

        valid_scores = np.array([s for s, _ in valid])
        valid_meta = [self.metadata[i] for _, i in valid]

        return valid_scores, valid_meta

    def max_similarity(self, query_vec: np.ndarray) -> float:
        """
        Return only the highest cosine similarity score (the closest match).
        This is what Layer 1 uses as its primary signal.
        """
        scores, _ = self.search(query_vec, top_k=1)
        if len(scores) == 0:
            return 0.0
        return float(scores[0])

    # ── Persistence ────────────────────────────────────────────────────────────

    def save(self, index_path: str) -> None:
        """
        Save the FAISS index and metadata to disk.

        Saves two files:
          <index_path>.index   — the binary FAISS index
          <index_path>.meta    — the metadata list (pickle)
        """
        path = Path(index_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        faiss.write_index(self.index, str(path.with_suffix(".index")))

        with open(path.with_suffix(".meta"), "wb") as f:
            pickle.dump({"metadata": self.metadata, "dim": self.dim}, f)

        print(f"[FAISS] Saved index → {path.with_suffix('.index')}")
        print(f"[FAISS] Saved metadata → {path.with_suffix('.meta')}")

    @classmethod
    def load(cls, index_path: str) -> "FAISSStore":
        """
        Load a previously saved FAISSStore from disk.

        Args:
            index_path: path without extension, or with .index extension
        """
        path = Path(index_path).with_suffix("")

        index_file = path.with_suffix(".index")
        meta_file = path.with_suffix(".meta")

        if not index_file.exists():
            raise FileNotFoundError(f"FAISS index not found: {index_file}")
        if not meta_file.exists():
            raise FileNotFoundError(f"FAISS metadata not found: {meta_file}")

        with open(meta_file, "rb") as f:
            saved = pickle.load(f)

        store = cls(dim=saved["dim"])
        store.index = faiss.read_index(str(index_file))
        store.metadata = saved["metadata"]

        print(f"[FAISS] Loaded index: {store.index.ntotal} vectors, dim={store.dim}")
        return store

    @classmethod
    def exists(cls, index_path: str) -> bool:
        """Check if a saved index exists at the given path."""
        path = Path(index_path).with_suffix("")
        return path.with_suffix(".index").exists() and path.with_suffix(".meta").exists()

    def __len__(self) -> int:
        return self.index.ntotal if self.index else 0

    def __repr__(self) -> str:
        return f"FAISSStore(vectors={len(self)}, dim={self.dim})"
