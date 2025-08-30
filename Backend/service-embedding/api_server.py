#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Embedding Service API Server
Provides Ollama-compatible API for embedding inference
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Union
import numpy as np
from datetime import datetime
import uvicorn
import logging
import sys
import os
from pathlib import Path

# Add current directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from inference_engine import get_model_manager, ModelConfig

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Embedding Service API",
    description="Ollama-like embedding inference service using onnxruntime",
    version="1.0.0"
)


# Request and response models
class EmbedRequest(BaseModel):
    """Embedding request model"""
    model: str = Field(default="nomic-embed", description="Model name")
    input: Optional[Union[str, List[str]]] = Field(None, description="Input text or list")
    prompt: Optional[Union[str, List[str]]] = Field(None, description="Alternative to input")
    
    def get_text_input(self) -> Union[str, List[str]]:
        """Get actual text input"""
        return self.input or self.prompt or ""


class EmbedResponse(BaseModel):
    """Embedding response model"""
    model: str
    embeddings: List[List[float]]


class ModelsResponse(BaseModel):
    """Models list response"""
    models: List[dict]


@app.on_event("startup")
async def startup_event():
    """Initialize service on startup"""
    logger.info("Starting Embedding Service...")
    try:
        manager = get_model_manager()
        loaded_models = list(manager.models.keys())
        if loaded_models:
            logger.info(f"Models loaded: {loaded_models}")
        else:
            logger.warning("No models loaded yet")
    except Exception as e:
        logger.error(f"Startup error: {e}")
    logger.info("Embedding Service started")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Embedding Service API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        manager = get_model_manager()
        models = manager.list_models()
        loaded_models = list(manager.models.keys())
        
        return {
            "status": "healthy",
            "service": "Embedding Service",
            "models_available": len(models),
            "models_loaded": len(loaded_models),
            "current_model": manager.current_model,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


@app.get("/api/tags", response_model=ModelsResponse)
async def list_models():
    """List available models (Ollama compatible)"""
    try:
        manager = get_model_manager()
        model_names = manager.list_models()
        
        models = []
        for name in model_names:
            models.append({
                "name": name,
                "modified_at": datetime.now().isoformat(),
                "size": "unknown",
                "digest": f"sha256:{name}",
                "details": {
                    "format": "onnx",
                    "family": "nomic-embed"
                }
            })
        
        return ModelsResponse(models=models)
    except Exception as e:
        logger.error(f"Failed to list models: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/embeddings", response_model=EmbedResponse)
async def create_embeddings(request: EmbedRequest):
    """Generate embeddings (Ollama compatible)"""
    try:
        manager = get_model_manager()
        
        # Load model
        engine = manager.load_model(request.model)
        
        # Get text input
        text_input = request.get_text_input()
        
        # Process input
        if isinstance(text_input, str):
            texts = [text_input]
        elif isinstance(text_input, list):
            texts = text_input
        else:
            raise ValueError("Input must be string or list of strings")
        
        # Generate embeddings
        embeddings = []
        for text in texts:
            embedding = engine.embed(text)
            embeddings.append(embedding.tolist())
        
        return EmbedResponse(
            model=request.model,
            embeddings=embeddings
        )
    except Exception as e:
        logger.error(f"Failed to generate embeddings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/embed")
async def embed_single(text: str, model: str = "nomic-embed"):
    """Simple embedding endpoint"""
    try:
        manager = get_model_manager()
        embedding = manager.embed(text, model)
        
        return {
            "text": text,
            "model": model,
            "embedding": embedding.tolist(),
            "dimension": len(embedding)
        }
    except Exception as e:
        logger.error(f"Embedding failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/embed/batch")
async def embed_batch(texts: List[str], model: str = "nomic-embed"):
    """Batch embedding endpoint"""
    try:
        manager = get_model_manager()
        engine = manager.load_model(model)
        
        embeddings = []
        for text in texts:
            embedding = engine.embed(text)
            embeddings.append(embedding.tolist())
        
        return {
            "texts": texts,
            "model": model,
            "embeddings": embeddings,
            "count": len(embeddings),
            "dimension": len(embeddings[0]) if embeddings else 0
        }
    except Exception as e:
        logger.error(f"Batch embedding failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def run_server(
    host: str = "127.0.0.1",
    port: int = 11434,
    log_level: str = "info"
):
    """Run the server"""
    logger.info(f"Starting Embedding Service API server...")
    logger.info(f"Server address: http://{host}:{port}")
    logger.info(f"API documentation: http://{host}:{port}/docs")
    
    uvicorn.run(
        "api_server:app",
        host=host,
        port=port,
        log_level=log_level,
        reload=False
    )


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Embedding Service API Server")
    parser.add_argument("--host", default="127.0.0.1", help="Server address")
    parser.add_argument("--port", type=int, default=11434, help="Server port")
    parser.add_argument("--log-level", default="info", help="Logging level")
    
    args = parser.parse_args()
    
    run_server(
        host=args.host,
        port=args.port,
        log_level=args.log_level
    )