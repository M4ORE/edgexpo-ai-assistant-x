#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Load existing model files
Adapt already downloaded ONNX models
"""

import json
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


def setup_existing_model(
    model_dir: str = "models/nomic_embed_text",
    model_name: str = "nomic-embed",
    sequence_length: int = 128,
    embedding_dim: int = 768
):
    """
    Setup existing model files
    
    Args:
        model_dir: Model directory path
        model_name: Model name
        sequence_length: Sequence length
        embedding_dim: Embedding vector dimension
    """
    model_dir = Path(model_dir)
    
    # Check model files
    onnx_file = model_dir / "model.onnx"
    if not onnx_file.exists():
        raise FileNotFoundError(f"ONNX model not found: {onnx_file}")
    
    logger.info(f"Found ONNX model: {onnx_file}")
    
    # Check other files
    bin_file = model_dir / "model.bin"
    data_file = model_dir / "model.data"
    
    if bin_file.exists():
        logger.info(f"Found binary file: {bin_file}")
    if data_file.exists():
        logger.info(f"Found data file: {data_file}")
    
    # Create model configuration
    config = {
        "name": model_name,
        "version": "1.5",
        "sequence_length": sequence_length,
        "embedding_dim": embedding_dim,
        "model_path": str(onnx_file),
        "provider": "CPUExecutionProvider"  # Default to CPU
    }
    
    # Save configuration to models root directory
    models_root = Path("models")
    models_root.mkdir(parents=True, exist_ok=True)
    
    config_file = models_root / f"{model_name}_config.json"
    with open(config_file, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Model configuration saved: {config_file}")
    
    # Create or update model registry
    registry_file = models_root / "models.json"
    
    if registry_file.exists():
        with open(registry_file, 'r', encoding='utf-8') as f:
            registry = json.load(f)
    else:
        registry = {}
    
    registry[model_name] = config
    
    with open(registry_file, 'w', encoding='utf-8') as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Model registered to: {registry_file}")
    
    return config


def validate_onnx_model(model_path: str):
    """Validate ONNX model"""
    try:
        import onnx
        
        logger.info(f"Validating ONNX model: {model_path}")
        model = onnx.load(model_path)
        onnx.checker.check_model(model)
        
        # Display model information
        logger.info(f"Model IR version: {model.ir_version}")
        logger.info(f"Producer: {model.producer_name} {model.producer_version}")
        
        # Display inputs and outputs
        graph = model.graph
        
        logger.info("Model inputs:")
        for input_tensor in graph.input:
            logger.info(f"  - {input_tensor.name}: {input_tensor.type}")
        
        logger.info("Model outputs:")
        for output_tensor in graph.output:
            logger.info(f"  - {output_tensor.name}: {output_tensor.type}")
        
        logger.info("ONNX model validation successful")
        return True
        
    except ImportError:
        logger.warning("onnx package not installed, skipping validation")
        return True
    except Exception as e:
        logger.error(f"ONNX model validation failed: {e}")
        return False


def test_model_inference(model_path: str):
    """Test model inference"""
    try:
        import onnxruntime as ort
        import numpy as np
        
        logger.info(f"Testing model inference: {model_path}")
        
        # Create session
        session = ort.InferenceSession(str(model_path))
        
        # Get input details
        inputs = session.get_inputs()
        logger.info(f"Model expects {len(inputs)} inputs:")
        for inp in inputs:
            logger.info(f"  - {inp.name}: shape {inp.shape}, type {inp.type}")
        
        # Prepare test input based on actual model requirements
        if len(inputs) == 2:
            # Assume input_tokens and attention_masks
            sequence_length = 128
            input_tokens = np.random.randint(0, 1000, (1, sequence_length), dtype=np.int32)
            attention_masks = np.ones((1, sequence_length), dtype=np.int32)
            
            feed_dict = {
                inputs[0].name: input_tokens,
                inputs[1].name: attention_masks
            }
        else:
            logger.error(f"Unexpected number of inputs: {len(inputs)}")
            return False
        
        # Run inference
        outputs = session.run(None, feed_dict)
        
        # Check output
        embedding = outputs[0]
        logger.info(f"Inference successful")
        logger.info(f"Output shape: {embedding.shape}")
        logger.info(f"Output dtype: {embedding.dtype}")
        logger.info(f"Value range: [{embedding.min():.4f}, {embedding.max():.4f}]")
        
        return True
        
    except Exception as e:
        logger.error(f"Model inference test failed: {e}")
        return False


if __name__ == "__main__":
    import argparse
    
    logging.basicConfig(level=logging.INFO)
    
    parser = argparse.ArgumentParser(description="Setup existing model")
    parser.add_argument("--model-dir", default="models/nomic_embed_text", 
                       help="Model directory path")
    parser.add_argument("--model-name", default="nomic-embed", 
                       help="Model name")
    parser.add_argument("--sequence-length", type=int, default=128, 
                       help="Sequence length")
    parser.add_argument("--embedding-dim", type=int, default=768, 
                       help="Embedding vector dimension")
    parser.add_argument("--validate", action="store_true", 
                       help="Validate ONNX model")
    parser.add_argument("--test", action="store_true", 
                       help="Test model inference")
    
    args = parser.parse_args()
    
    try:
        # Setup model
        config = setup_existing_model(
            model_dir=args.model_dir,
            model_name=args.model_name,
            sequence_length=args.sequence_length,
            embedding_dim=args.embedding_dim
        )
        
        model_path = config["model_path"]
        
        # Validate model
        if args.validate:
            validate_onnx_model(model_path)
        
        # Test inference
        if args.test:
            test_model_inference(model_path)
        
        logger.info("=== Model setup complete ===")
        logger.info(f"Model name: {config['name']}")
        logger.info(f"Model path: {config['model_path']}")
        logger.info("You can now start the service:")
        logger.info("  python start_service.py")
        
    except Exception as e:
        logger.error(f"Setup failed: {e}")
        exit(1)