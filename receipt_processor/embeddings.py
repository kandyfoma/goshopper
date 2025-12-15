"""
Embeddings Module for Semantic Matching
Uses text embeddings for advanced product matching based on meaning, not just text similarity.

This module provides:
1. Simple TF-IDF based embeddings (lightweight, no external dependencies)
2. Optional integration with sentence transformers for better results
3. Cosine similarity for semantic matching
"""

import json
import logging
import math
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from collections import Counter

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Try to import sentence transformers (optional, better quality)
try:
    from sentence_transformers import SentenceTransformer  # type: ignore
    import numpy as np  # type: ignore
    SENTENCE_TRANSFORMERS_AVAILABLE = True
    NUMPY_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    NUMPY_AVAILABLE = False
    # Try just numpy
    try:
        import numpy as np  # type: ignore
        NUMPY_AVAILABLE = True
    except ImportError:
        NUMPY_AVAILABLE = False
    logger.info("sentence-transformers not available. Using TF-IDF embeddings instead.")


class TFIDFEmbedder:
    """
    Simple TF-IDF based embeddings for semantic similarity.
    
    This is a lightweight alternative that doesn't require any ML libraries.
    Good for basic semantic matching without external dependencies.
    """
    
    def __init__(self):
        self.vocabulary: Dict[str, int] = {}
        self.idf: Dict[str, float] = {}
        self.documents: List[str] = []
        logger.info("TFIDFEmbedder initialized")
    
    def fit(self, documents: List[str]) -> None:
        """
        Fit the TF-IDF model on a corpus of documents.
        
        Args:
            documents: List of text documents
        """
        self.documents = documents
        
        # Build vocabulary
        all_words = set()
        for doc in documents:
            words = doc.lower().split()
            all_words.update(words)
        
        self.vocabulary = {word: idx for idx, word in enumerate(sorted(all_words))}
        
        # Calculate IDF (Inverse Document Frequency)
        doc_count = len(documents)
        word_doc_count = Counter()
        
        for doc in documents:
            unique_words = set(doc.lower().split())
            for word in unique_words:
                word_doc_count[word] += 1
        
        # IDF = log(total_docs / docs_containing_word)
        for word in self.vocabulary:
            count = word_doc_count.get(word, 0)
            if count > 0:
                self.idf[word] = math.log(doc_count / count)
            else:
                self.idf[word] = 0.0
        
        logger.info(f"Fitted TF-IDF on {doc_count} documents with {len(self.vocabulary)} unique words")
    
    def embed(self, text: str) -> List[float]:
        """
        Convert text to TF-IDF embedding vector.
        
        Args:
            text: Input text
            
        Returns:
            Embedding vector
        """
        words = text.lower().split()
        vector = [0.0] * len(self.vocabulary)
        
        # Calculate term frequency
        word_count = Counter(words)
        total_words = len(words)
        
        for word, count in word_count.items():
            if word in self.vocabulary:
                idx = self.vocabulary[word]
                tf = count / total_words if total_words > 0 else 0
                idf = self.idf.get(word, 0)
                vector[idx] = tf * idf
        
        # Normalize vector
        magnitude = math.sqrt(sum(x * x for x in vector))
        if magnitude > 0:
            vector = [x / magnitude for x in vector]
        
        return vector
    
    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors.
        
        Args:
            vec1: First vector
            vec2: Second vector
            
        Returns:
            Cosine similarity score (0.0 to 1.0)
        """
        if len(vec1) != len(vec2):
            return 0.0
        
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        return max(0.0, min(1.0, dot_product))  # Clamp to [0, 1]
    
    def similarity(self, text1: str, text2: str) -> float:
        """
        Calculate semantic similarity between two texts.
        
        Args:
            text1: First text
            text2: Second text
            
        Returns:
            Similarity score (0.0 to 1.0)
        """
        vec1 = self.embed(text1)
        vec2 = self.embed(text2)
        return self.cosine_similarity(vec1, vec2)


class SentenceTransformerEmbedder:
    """
    Advanced embeddings using sentence transformers.
    
    This provides much better semantic matching but requires the
    sentence-transformers library to be installed.
    
    Install with: pip install sentence-transformers
    """
    
    def __init__(self, model_name: str = 'paraphrase-multilingual-MiniLM-L12-v2'):
        """
        Initialize with a pre-trained model.
        
        Args:
            model_name: Name of the sentence transformer model
                       Default is multilingual and works for French/English
        """
        if not SENTENCE_TRANSFORMERS_AVAILABLE:
            raise ImportError(
                "sentence-transformers not installed. "
                "Install with: pip install sentence-transformers"
            )
        
        self.model = SentenceTransformer(model_name)
        logger.info(f"SentenceTransformerEmbedder initialized with model: {model_name}")
    
    def embed(self, text: str):
        """
        Convert text to embedding vector.
        
        Args:
            text: Input text
            
        Returns:
            Embedding vector (numpy array if available)
        """
        return self.model.encode(text, convert_to_tensor=False)
    
    def embed_batch(self, texts: List[str]):
        """
        Convert multiple texts to embeddings (more efficient).
        
        Args:
            texts: List of input texts
            
        Returns:
            Matrix of embeddings
        """
        return self.model.encode(texts, convert_to_tensor=False)
    
    def cosine_similarity(self, vec1, vec2) -> float:
        """
        Calculate cosine similarity between two vectors.
        
        Args:
            vec1: First vector
            vec2: Second vector
            
        Returns:
            Cosine similarity score (0.0 to 1.0)
        """
        if not NUMPY_AVAILABLE:
            # Fallback to list-based calculation
            dot_product = sum(a * b for a, b in zip(vec1, vec2))
            norm1 = sum(a * a for a in vec1) ** 0.5
            norm2 = sum(b * b for b in vec2) ** 0.5
        else:
            import numpy as np
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        similarity = dot_product / (norm1 * norm2)
        return float(max(0.0, min(1.0, similarity)))
    
    def similarity(self, text1: str, text2: str) -> float:
        """
        Calculate semantic similarity between two texts.
        
        Args:
            text1: First text
            text2: Second text
            
        Returns:
            Similarity score (0.0 to 1.0)
        """
        vec1 = self.embed(text1)
        vec2 = self.embed(text2)
        return self.cosine_similarity(vec1, vec2)


class SemanticMatcher:
    """
    Unified semantic matching interface.
    
    Automatically uses the best available embedder:
    1. SentenceTransformers if available (best quality)
    2. TF-IDF otherwise (lightweight fallback)
    """
    
    def __init__(self, use_transformers: bool = True, corpus: Optional[List[str]] = None):
        """
        Initialize the semantic matcher.
        
        Args:
            use_transformers: Try to use sentence transformers if available
            corpus: Optional corpus for TF-IDF training
        """
        self.embedder = None
        self.embedder_type = None
        
        if use_transformers and SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                self.embedder = SentenceTransformerEmbedder()
                self.embedder_type = 'transformer'
                logger.info("Using SentenceTransformer embeddings")
            except Exception as e:
                logger.warning(f"Failed to load SentenceTransformer: {e}")
                use_transformers = False
        
        if not use_transformers or self.embedder is None:
            self.embedder = TFIDFEmbedder()
            self.embedder_type = 'tfidf'
            logger.info("Using TF-IDF embeddings")
            
            # Fit on corpus if provided
            if corpus:
                self.embedder.fit(corpus)
    
    def fit(self, corpus: List[str]) -> None:
        """
        Fit the model on a corpus (only needed for TF-IDF).
        
        Args:
            corpus: List of text documents
        """
        if self.embedder_type == 'tfidf':
            self.embedder.fit(corpus)
        else:
            logger.info("Transformer models don't need fitting")
    
    def similarity(self, text1: str, text2: str) -> float:
        """
        Calculate semantic similarity between two texts.
        
        Args:
            text1: First text
            text2: Second text
            
        Returns:
            Similarity score (0.0 to 1.0)
        """
        return self.embedder.similarity(text1, text2)
    
    def find_best_match(self, query: str, candidates: List[str]) -> Tuple[Optional[str], float]:
        """
        Find the best matching candidate for a query.
        
        Args:
            query: Search query
            candidates: List of candidate texts
            
        Returns:
            Tuple of (best_match, score)
        """
        if not candidates:
            return None, 0.0
        
        best_match = None
        best_score = 0.0
        
        for candidate in candidates:
            score = self.similarity(query, candidate)
            if score > best_score:
                best_score = score
                best_match = candidate
        
        return best_match, best_score
    
    def rank_candidates(self, query: str, candidates: List[str], 
                       top_k: int = 5) -> List[Tuple[str, float]]:
        """
        Rank candidates by similarity to query.
        
        Args:
            query: Search query
            candidates: List of candidate texts
            top_k: Number of top results to return
            
        Returns:
            List of (candidate, score) tuples, sorted by score
        """
        results = []
        
        for candidate in candidates:
            score = self.similarity(query, candidate)
            results.append((candidate, score))
        
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]


# ============================================================================
# Global Instance
# ============================================================================

# Create a default semantic matcher
semantic_matcher = SemanticMatcher(use_transformers=False)  # Start with TF-IDF


def init_semantic_matcher(product_names: List[str], use_transformers: bool = True) -> SemanticMatcher:
    """
    Initialize a semantic matcher with a corpus of product names.
    
    Args:
        product_names: List of product names to train on
        use_transformers: Try to use transformer models
        
    Returns:
        Initialized SemanticMatcher
    """
    matcher = SemanticMatcher(use_transformers=use_transformers, corpus=product_names)
    return matcher


# ============================================================================
# Main Entry Point (for testing)
# ============================================================================

if __name__ == "__main__":
    print("=" * 80)
    print("Embeddings Module Test")
    print("=" * 80)
    
    # Test corpus
    corpus = [
        "banana plantain",
        "sweet banana",
        "potato",
        "tomato",
        "onion",
        "garlic",
        "chicken",
        "beef",
        "fish",
        "vegetable oil",
        "palm oil",
        "rice",
        "bread",
        "milk",
        "water"
    ]
    
    # Initialize matcher
    matcher = SemanticMatcher(use_transformers=False, corpus=corpus)
    print(f"\nUsing embedder type: {matcher.embedder_type}")
    
    # Test cases
    test_queries = [
        "banane plantain",  # French for plantain
        "pomme de terre",   # French for potato
        "huile végétale",   # French for vegetable oil
        "poulet",           # French for chicken
        "BNN PLTN",         # Abbreviation
    ]
    
    print("\n" + "=" * 80)
    print("Semantic Matching Results")
    print("=" * 80)
    
    for query in test_queries:
        print(f"\nQuery: '{query}'")
        
        # Find best match
        best_match, score = matcher.find_best_match(query, corpus)
        print(f"  Best Match: '{best_match}' (score: {score:.3f})")
        
        # Top 3 matches
        top_matches = matcher.rank_candidates(query, corpus, top_k=3)
        print("  Top 3 Matches:")
        for candidate, similarity in top_matches:
            print(f"    - '{candidate}': {similarity:.3f}")
    
    print("\n" + "=" * 80)
    print("Embeddings module is ready!")
    print("\nTo use better quality embeddings, install sentence-transformers:")
    print("  pip install sentence-transformers")
    print("=" * 80)
