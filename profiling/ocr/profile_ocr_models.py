import numpy as np
import time
import argparse
import qai_hub as hub
from pathlib import Path
import os
import json

def get_model_paths(model_type, format_type):
    """Get model file paths based on model type and format"""
    base_path = Path(model_type)
    
    if format_type == "dlc":
        if model_type == "easyocr":
            return {
                "detector": base_path / "easyocr-easyocrdetector.dlc",
                "recognizer": base_path / "easyocr-easyocrrecognizer.dlc"
            }
        elif model_type == "trocr":
            return {
                "encoder": base_path / "trocr-trocrencoder.dlc",
                "decoder": base_path / "trocr-trocrdecoder.dlc"
            }
    elif format_type == "onnx":
        if model_type == "easyocr":
            return {
                "recognizer": base_path / "easyocr-easyocrrecognizer.onnx" / "model.onnx" / "model.onnx"
            }
        elif model_type == "trocr":
            return {
                "encoder": base_path / "trocr-trocrencoder.onnx" / "model.onnx" / "model.onnx",
                "decoder": base_path / "trocr-trocrdecoder.onnx" / "model.onnx" / "model.onnx"
            }
    
    return {}

def create_sample_inputs(model_type, component):
    """Create sample inputs for different OCR model components"""
    if model_type == "easyocr":
        if component == "detector":
            # EasyOCR detector typically expects image input (1, 3, H, W)
            return {"image": [np.random.rand(1, 3, 640, 640).astype(np.float32)]}
        elif component == "recognizer":
            # EasyOCR recognizer expects cropped text regions
            return {"image": [np.random.rand(1, 3, 32, 128).astype(np.float32)]}
    
    elif model_type == "trocr":
        if component == "encoder":
            # TrOCR encoder expects image patches (1, 3, 384, 384)
            return {"pixel_values": [np.random.rand(1, 3, 384, 384).astype(np.float32)]}
        elif component == "decoder":
            # TrOCR decoder expects encoder hidden states and decoder input ids
            return {
                "encoder_hidden_states": [np.random.rand(1, 577, 768).astype(np.float32)],
                "decoder_input_ids": [np.array([[0]], dtype=np.int64)]
            }
    
    return {}

def profile_model_component(model_path, component_name, model_type, inputs=None):
    """Profile a single model component"""
    print(f"\n[{component_name.upper()}] Profiling {model_path.name}")
    print(f"    Component: {component_name}")
    
    try:
        device = hub.Device("Snapdragon X Elite CRD")
        
        # Upload model
        model = hub.upload_model(model_path)
        
        # Submit profile job (without custom inputs for now)
        print(f"    Profiling without custom inputs")
        profile_job = hub.submit_profile_job(model=model, device=device)
        
        # Wait for completion
        profile_job.wait()
        
        # Download profile results
        results_dir = f"{model_type}_{component_name}_profile_results"
        os.makedirs(results_dir, exist_ok=True)
        
        print(f"\n    Downloading profile results to: {results_dir}/")
        try:
            profile_path = profile_job.download_profile(results_dir)
            print(f"    ✅ Profile downloaded successfully")
            
            # Try to read and display the profile results if it's a text file
            profile_file = Path(results_dir) / "profile.json"
            if profile_file.exists():
                with open(profile_file, 'r') as f:
                    profile_data = json.load(f)
                    print(f"\n    Performance Metrics for {component_name}:")
                    
                    # Extract relevant metrics from the profile data
                    if 'execution_summary' in profile_data:
                        exec_summary = profile_data['execution_summary']
                        if 'estimated_inference_time_ms' in exec_summary:
                            print(f"    - Inference Time: {exec_summary['estimated_inference_time_ms']:.3f} ms")
                        if 'estimated_peak_memory_bytes' in exec_summary:
                            memory_mb = exec_summary['estimated_peak_memory_bytes'] / 1024 / 1024
                            print(f"    - Peak Memory: {memory_mb:.2f} MB")
                    
                    # Check for other performance metrics
                    if 'performance' in profile_data:
                        perf = profile_data['performance']
                        for key, value in perf.items():
                            print(f"    - {key}: {value}")
                            
        except Exception as e:
            print(f"    ⚠️  Could not parse profile results: {e}")
        
        # Also download all results using download_results
        try:
            profile_job.download_results(results_dir)
            print(f"    ✅ All results downloaded to {results_dir}/")
        except Exception as e:
            print(f"    ⚠️  Could not download all results: {e}")
        
        return True
        
    except Exception as e:
        print(f"    Error profiling {component_name}: {e}")
        return False

def profile_ocr_models(model_type, format_type, use_sample_inputs=True):
    """Main profiling function for OCR models"""
    print("=" * 80)
    print(f"{model_type.upper()} Model NPU Profiling ({format_type.upper()} format)")
    print("=" * 80)
    
    # Get model paths
    model_paths = get_model_paths(model_type, format_type)
    
    if not model_paths:
        print(f"Error: No model paths found for {model_type} with {format_type} format")
        return False
    
    # Check if model files exist
    missing_files = []
    for component, path in model_paths.items():
        if not path.exists():
            missing_files.append(str(path))
    
    if missing_files:
        print("Error: The following model files are missing:")
        for file in missing_files:
            print(f"  - {file}")
        return False
    
    device = hub.Device("Snapdragon X Elite CRD")
    print(f"Target Device: {device.name}")
    print(f"Model Type: {model_type}")
    print(f"Format: {format_type}")
    print("-" * 80)
    
    # Profile each component
    success_count = 0
    for component, model_path in model_paths.items():
        inputs = None
        if use_sample_inputs:
            inputs = create_sample_inputs(model_type, component)
        
        if profile_model_component(model_path, component, model_type, inputs):
            success_count += 1
        
        print("-" * 80)
    
    print(f"\nProfiling Summary:")
    print(f"  - Successfully profiled: {success_count}/{len(model_paths)} components")
    print(f"  - Model Type: {model_type}")
    print(f"  - Format: {format_type}")
    
    return success_count == len(model_paths)

def main():
    parser = argparse.ArgumentParser(description="Profile OCR Models on Snapdragon X Elite NPU")
    parser.add_argument("--model", choices=["easyocr", "trocr", "both"], default="both",
                       help="OCR model to profile")
    parser.add_argument("--format", choices=["onnx", "dlc", "both"], default="dlc",
                       help="Model format to use")
    parser.add_argument("--no-sample-inputs", action="store_true",
                       help="Disable sample input generation")
    
    args = parser.parse_args()
    
    models_to_profile = []
    if args.model == "both":
        models_to_profile = ["easyocr", "trocr"]
    else:
        models_to_profile = [args.model]
    
    formats_to_profile = []
    if args.format == "both":
        formats_to_profile = ["dlc", "onnx"]
    else:
        formats_to_profile = [args.format]
    
    use_sample_inputs = not args.no_sample_inputs
    
    print("Starting OCR Model NPU Profiling")
    print(f"Models: {', '.join(models_to_profile)}")
    print(f"Formats: {', '.join(formats_to_profile)}")
    print(f"Sample Inputs: {'Enabled' if use_sample_inputs else 'Disabled'}")
    print()
    
    total_success = 0
    total_attempts = 0
    
    for model_type in models_to_profile:
        for format_type in formats_to_profile:
            total_attempts += 1
            if profile_ocr_models(model_type, format_type, use_sample_inputs):
                total_success += 1
            print()
    
    print("=" * 80)
    print("Overall Profiling Summary")
    print("=" * 80)
    print(f"Successful profiles: {total_success}/{total_attempts}")
    
    if total_success == total_attempts:
        print("✓ All profiling completed successfully!")
    else:
        print("⚠ Some profiling attempts failed. Check the logs above for details.")

if __name__ == "__main__":
    main()