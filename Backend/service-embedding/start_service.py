#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Embedding Service startup script
"""

import sys
import os
from pathlib import Path

# Add current directory to Python path
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))


def main():
    try:
        from api_server import run_server
    except ImportError as e:
        print(f"Import failed: {e}")
        print("Please ensure all required packages are installed:")
        print("pip install fastapi uvicorn onnxruntime transformers numpy")
        sys.exit(1)
    
    import argparse
    
    parser = argparse.ArgumentParser(description="Embedding Service")
    parser.add_argument("--host", default="127.0.0.1", help="Server address")
    parser.add_argument("--port", type=int, default=11434, help="Server port")
    parser.add_argument("--log-level", default="info", help="Logging level")
    
    args = parser.parse_args()
    
    print("=== Embedding Service ===")
    print(f"Starting server: http://{args.host}:{args.port}")
    print(f"API documentation: http://{args.host}:{args.port}/docs")
    print(f"Model: nomic-embed (ONNX)")
    print("Press Ctrl+C to stop service")
    print("=" * 25)
    
    try:
        run_server(
            host=args.host,
            port=args.port,
            log_level=args.log_level
        )
    except KeyboardInterrupt:
        print("\nService stopped")
    except Exception as e:
        print(f"Service startup failed: {e}")
        print(f"Error details: {type(e).__name__}: {e}")
        
        import traceback
        print(f"Full error stack: {traceback.format_exc()}")
        
        print("\nPlease check:")
        print("1. Model files exist: models/nomic_embed_text/model.onnx")
        print("2. Required packages are installed")
        print("3. Port is not in use")
        print("4. QNN drivers or hardware are correctly configured")
        print("5. Check QnnHtp.dll is in the correct path")
        sys.exit(1)


if __name__ == "__main__":
    main()