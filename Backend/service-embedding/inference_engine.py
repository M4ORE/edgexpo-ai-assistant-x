#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ONNX Runtime QNN Inference Engine
Similar to ollama design philosophy
"""

import numpy as np
from pathlib import Path
from typing import Optional, Dict, Any, List
import json
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ModelConfig:
    """Model configuration"""
    name: str
    version: str
    sequence_length: int
    embedding_dim: int
    model_path: str
    provider: str = "QNNExecutionProvider"  # Default using QNN
    
    def to_dict(self):
        return {
            "name": self.name,
            "version": self.version,
            "sequence_length": self.sequence_length,
            "embedding_dim": self.embedding_dim,
            "model_path": self.model_path,
            "provider": self.provider
        }


class EmbeddingEngine:
    """
    Embedding vector Inference Engine
    Design similar to ollama, but focused on embedding models
    """
    
    def __init__(self, model_config: ModelConfig):
        self.config = model_config
        self.session = None
        self.tokenizer = None
        self._initialize_session()
        self._initialize_tokenizer()
    
    def _initialize_session(self):
        """Initialize ONNX Runtime session"""
        try:
            import onnxruntime as ort
            
            # Check if model file exists
            if not Path(self.config.model_path).exists():
                raise FileNotFoundError(f"Model file not found: {self.config.model_path}")
            
            # Setup providers
            providers = self._get_providers()
            
            # Create session options
            sess_options = ort.SessionOptions()
            sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            
            # Setup logging level (2=Warning for more info)
            sess_options.log_severity_level = 2
            
            # Disable profiling for production
            sess_options.enable_profiling = False
            
            # Setup provider options
            provider_options = []
            
            # If using QNN, setup QNN specific options
            if "QNNExecutionProvider" in providers:
                qnn_options = {
                    'backend_path': 'C:\\Qualcomm\\AIStack\\lib\\aarch64-windows-msvc\\QnnHtp.dll',
                    'profiling_level': 'basic',
                    'rpc_control_latency': '100',
                    'htp_performance_mode': 'high_performance',
                    'htp_graph_finalization_optimization_mode': '3',
                    'soc_model': '0',  # Auto detect
                    'device_id': '0'
                }
                provider_options.append(qnn_options)
            
            # CPU provider options
            if "CPUExecutionProvider" in providers:
                cpu_options = {}
                if len(provider_options) == 0:
                    provider_options.append(cpu_options)
                else:
                    provider_options.append(cpu_options)
            
            logger.info(f"Using providers: {providers}")
            logger.info(f"Loading model: {self.config.model_path}")
            
            # Create session
            try:
                if provider_options:
                    self.session = ort.InferenceSession(
                        self.config.model_path,
                        sess_options=sess_options,
                        providers=providers,
                        provider_options=provider_options
                    )
                else:
                    self.session = ort.InferenceSession(
                        self.config.model_path,
                        sess_options=sess_options,
                        providers=providers
                    )
            except Exception as provider_error:
                logger.warning(f"Failed with specified provider: {provider_error}")
                logger.info("Falling back to CPU provider...")
                # Fallback to CPU provider
                self.session = ort.InferenceSession(
                    self.config.model_path,
                    sess_options=sess_options,
                    providers=["CPUExecutionProvider"]
                )
            
            # Show actual provider being used
            actual_providers = self.session.get_providers()
            logger.info(f"Actual provider: {actual_providers[0]}")
            
            # Check model input specs
            input_details = self.session.get_inputs()
            logger.info("Model input specs:")
            for inp in input_details:
                logger.info(f"  - {inp.name}: {inp.type}, shape: {inp.shape}")
            
            logger.info(f"Successfully loaded model: {self.config.name} v{self.config.version}")
            
        except ImportError:
            raise RuntimeError("Please install onnxruntime or onnxruntime-qnn")
        except Exception as e:
            logger.error(f"Failed to initialize model: {e}")
            raise
    
    def _get_providers(self) -> List[str]:
        """
        Get available execution providers
        Priority: QNN > CUDA > CPU
        """
        try:
            import onnxruntime as ort
            available_providers = ort.get_available_providers()
            providers = []
            
            # Priority: QNN (Qualcomm Neural Network)
            if self.config.provider == "QNNExecutionProvider" and "QNNExecutionProvider" in available_providers:
                providers.append("QNNExecutionProvider")
            
            # Fallback: CUDA
            if "CUDAExecutionProvider" in available_providers:
                providers.append("CUDAExecutionProvider")
            
            # Final: CPU
            providers.append("CPUExecutionProvider")
            
            return providers
        except:
            return ["CPUExecutionProvider"]
    
    def _initialize_tokenizer(self):
        """Initialize tokenizer"""
        logger.info("Initializing tokenizer")
        from transformers import AutoTokenizer
        
        self.tokenizer = AutoTokenizer.from_pretrained(
            "bert-base-uncased",
            model_max_length=self.config.sequence_length
        )
    
    def encode_text(self, text: str) -> Dict[str, np.ndarray]:
        """
        Encode text to tokens
        
        Args:
            text: Input text
            
        Returns:
            Dictionary containing input_ids and attention_mask
        """
        inputs = self.tokenizer(
            text,
            padding="max_length",
            truncation=True,
            max_length=self.config.sequence_length,
            return_tensors="np"
        )
        
        return {
            "input_tokens": inputs["input_ids"].astype(np.int32),
            "attention_masks": inputs["attention_mask"].astype(np.int32)
        }
    
    def embed(self, text: str) -> np.ndarray:
        """
        Generate text embedding vector
        
        Args:
            text: Input text
            
        Returns:
            Embedding vector (shape: [embedding_dim])
        """
        # Encode text
        inputs = self.encode_text(text)
        
        # Run inference
        outputs = self.session.run(
            None,
            {
                "input_tokens": inputs["input_tokens"],
                "attention_masks": inputs["attention_masks"]
            }
        )
        
        # Return embedding vector (remove batch dimension)
        embeddings = outputs[0]
        return embeddings[0]  # shape: [embedding_dim]
    
    def embed_batch(self, texts: List[str]) -> np.ndarray:
        """
        Batch generate embedding vectors
        
        Args:
            texts: List of texts
            
        Returns:
            Array of embedding vectors (shape: [batch_size, embedding_dim])
        """
        embeddings = []
        for text in texts:
            embedding = self.embed(text)
            embeddings.append(embedding)
        
        return np.array(embeddings)
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        return {
            "name": self.config.name,
            "version": self.config.version,
            "sequence_length": self.config.sequence_length,
            "embedding_dim": self.config.embedding_dim,
            "provider": self.session.get_providers()[0] if self.session else "Not initialized"
        }


class ModelManager:
    """
    Model manager (similar to ollama model management)
    Manages multiple model loading, switching and inference
    """
    
    def __init__(self, models_dir: str = "models", preload: bool = True):
        self.models_dir = Path(models_dir)
        self.models: Dict[str, EmbeddingEngine] = {}
        self.current_model: Optional[str] = None
        
        # Ensure models directory exists
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
        # Load model configurations
        self._load_model_configs()
        
        # Preload models
        if preload:
            self._preload_models()
    
    def _load_model_configs(self):
        """Load all available model configurations"""
        config_file = self.models_dir / "models.json"
        
        if config_file.exists():
            with open(config_file, 'r', encoding='utf-8') as f:
                configs = json.load(f)
                
            for model_name, config_dict in configs.items():
                # Check if model file exists
                model_path = Path(config_dict['model_path'])
                if model_path.exists():
                    config = ModelConfig(**config_dict)
                    logger.info(f"Found model: {model_name}")
    
    def _preload_models(self):
        """Preload all available models"""
        logger.info("Starting to preload models...")
        
        # Load nomic-embed model
        try:
            self.load_model("nomic-embed")
            logger.info("nomic-embed model preloaded successfully")
        except Exception as e:
            logger.error(f"Failed to preload nomic-embed: {e}")
    
    def load_model(self, model_name: str) -> EmbeddingEngine:
        """
        Load specified model
        
        Args:
            model_name: Model name
            
        Returns:
            Inference engine instance
        """
        if model_name in self.models:
            self.current_model = model_name
            return self.models[model_name]
        
        # Try to load model
        config_file = self.models_dir / f"{model_name}_config.json"
        
        if not config_file.exists():
            # Use default configuration
            model_path = self.models_dir / "nomic_embed_text" / "model.onnx"
            if not model_path.exists():
                raise ValueError(f"Model not found: {model_name}")
            
            config = ModelConfig(
                name=model_name,
                version="1.5",
                sequence_length=128,
                embedding_dim=768,
                model_path=str(model_path),
                provider="CPUExecutionProvider"
            )
        else:
            with open(config_file, 'r', encoding='utf-8') as f:
                config_dict = json.load(f)
            config = ModelConfig(**config_dict)
        
        # Create inference engine
        engine = EmbeddingEngine(config)
        self.models[model_name] = engine
        self.current_model = model_name
        
        return engine
    
    def get_current_engine(self) -> Optional[EmbeddingEngine]:
        """Get current inference engine"""
        if self.current_model and self.current_model in self.models:
            return self.models[self.current_model]
        return None
    
    def list_models(self) -> List[str]:
        """List all available models"""
        models = []
        
        # Already loaded models
        models.extend(self.models.keys())
        
        # Available but not loaded models
        for onnx_file in self.models_dir.glob("**/*.onnx"):
            model_name = onnx_file.parent.name
            if model_name not in models and model_name != "models":
                models.append(model_name)
        
        # Default to nomic-embed if no models found
        if not models:
            models.append("nomic-embed")
        
        return models
    
    def embed(self, text: str, model_name: Optional[str] = None) -> np.ndarray:
        """
        Generate embedding vector using specified model
        
        Args:
            text: Input text
            model_name: Model name (if None, use current model)
            
        Returns:
            Embedding vector
        """
        if model_name:
            # If already loaded, use it; otherwise load it
            if model_name in self.models:
                engine = self.models[model_name]
                self.current_model = model_name
            else:
                engine = self.load_model(model_name)
        else:
            engine = self.get_current_engine()
            if not engine:
                # If no current model, try to use nomic-embed
                if "nomic-embed" in self.models:
                    engine = self.models["nomic-embed"]
                    self.current_model = "nomic-embed"
                else:
                    engine = self.load_model("nomic-embed")
        
        return engine.embed(text)


# Singleton global model manager
_global_manager: Optional[ModelManager] = None


def get_model_manager() -> ModelManager:
    """Get global model manager"""
    global _global_manager
    if _global_manager is None:
        _global_manager = ModelManager()
    return _global_manager


if __name__ == "__main__":
    # Test code
    logging.basicConfig(level=logging.INFO)
    
    # Create model configuration
    config = ModelConfig(
        name="nomic-embed",
        version="1.5",
        sequence_length=128,
        embedding_dim=768,
        model_path="models/nomic_embed_text/model.onnx"
    )
    
    # Create inference engine
    engine = EmbeddingEngine(config)
    
    # Test inference
    test_text = "This is a test text"
    embedding = engine.embed(test_text)
    
    print(f"Model info: {engine.get_model_info()}")
    print(f"Embedding dimension: {embedding.shape}")
    print(f"First 10 dimensions: {embedding[:10]}")