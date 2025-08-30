#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Embedding Service Python client example
"""

import requests
import numpy as np
from typing import List, Union


class EmbeddingClient:
    """Embedding Service client"""
    
    def __init__(self, base_url: str = "http://127.0.0.1:11434"):
        self.base_url = base_url
        self.model_name = "nomic-embed"
    
    def embed(self, text: str) -> List[float]:
        """Generate single text embedding vector"""
        response = requests.post(
            f"{self.base_url}/embed",
            json={"text": text, "model": self.model_name},
            timeout=30
        )
        response.raise_for_status()
        return response.json()["embedding"]
    
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Batch generate embedding vectors"""
        response = requests.post(
            f"{self.base_url}/embed/batch",
            json={"texts": texts, "model": self.model_name},
            timeout=60
        )
        response.raise_for_status()
        return response.json()["embeddings"]
    
    def similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity between two texts"""
        embeddings = self.embed_batch([text1, text2])
        
        # Calculate cosine similarity
        vec1 = np.array(embeddings[0])
        vec2 = np.array(embeddings[1])
        
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        return dot_product / (norm1 * norm2)


def example_usage():
    """Usage examples"""
    client = EmbeddingClient()
    
    print("=== Embedding Client Example ===")
    
    # 1. Single text embedding
    text = "Artificial intelligence is changing the world"
    embedding = client.embed(text)
    print(f"\nText: {text}")
    print(f"Embedding dimension: {len(embedding)}")
    print(f"First 5 values: {embedding[:5]}")
    
    # 2. Batch embedding
    texts = [
        "Machine learning is a subset of artificial intelligence",
        "Deep learning uses neural networks",
        "Natural language processing handles text data"
    ]
    embeddings = client.embed_batch(texts)
    print(f"\nBatch processed {len(texts)} texts")
    for i, text in enumerate(texts):
        print(f"  {i+1}. {text} -> dimension: {len(embeddings[i])}")
    
    # 3. Similarity calculation
    text1 = "I love machine learning"
    text2 = "Machine learning is interesting"
    text3 = "The weather is nice today"
    
    sim12 = client.similarity(text1, text2)
    sim13 = client.similarity(text1, text3)
    
    print(f"\nSimilarity calculation:")
    print(f"  '{text1}' vs '{text2}': {sim12:.4f}")
    print(f"  '{text1}' vs '{text3}': {sim13:.4f}")


if __name__ == "__main__":
    try:
        example_usage()
    except Exception as e:
        print(f"Error: {e}")
        print("Please ensure service is running: python start_service.py")