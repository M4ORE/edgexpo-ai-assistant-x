import numpy as np
import time
import qai_hub as hub
from pathlib import Path

def profile_whisper_models():
    encoder_dlc_path = Path("whisper_tiny_en-whisperencoderinf.dlc")
    decoder_dlc_path = Path("whisper_tiny_en-whisperdecoderinf.dlc")
    
    if not encoder_dlc_path.exists() or not decoder_dlc_path.exists():
        print("Error: DLC files not found in current directory")
        return
    
    print("=" * 60)
    print("Whisper Model NPU Profiling")
    print("=" * 60)
    
    device = hub.Device("Snapdragon X Elite CRD")
    print(f"Target Device: {device.name}")
    print("-" * 60)
    
    # Profile Encoder
    print("\n[1] Profiling Whisper Encoder")
    print(f"    Model: {encoder_dlc_path.name}")
    
    try:
        encoder_model = hub.upload_model(encoder_dlc_path)
        
        encoder_profile_job = hub.submit_profile_job(
            model=encoder_model,
            device=device,
        )
        
        # Wait for job to complete
        encoder_profile_job.wait()
        
        # Get profile results
        encoder_profile_results = encoder_profile_job.get_profile_results()
        
        print("\n    Encoder Performance Metrics:")
        if encoder_profile_results:
            for key, value in encoder_profile_results.items():
                if 'inference_time' in key.lower():
                    print(f"    - {key}: {value:.3f} ms")
                elif 'throughput' in key.lower():
                    print(f"    - {key}: {value:.2f} inferences/sec")
                elif 'memory' in key.lower():
                    if isinstance(value, (int, float)):
                        print(f"    - {key}: {value / 1024 / 1024:.2f} MB")
                    else:
                        print(f"    - {key}: {value}")
                else:
                    print(f"    - {key}: {value}")
        
        print(f"\n    Downloading full profiling report to: encoder_profile_results/")
        encoder_profile_job.download_results("encoder_profile_results")
        
    except Exception as e:
        print(f"    Error profiling encoder: {e}")
    
    print("-" * 60)
    
    # Profile Decoder
    print("\n[2] Profiling Whisper Decoder")
    print(f"    Model: {decoder_dlc_path.name}")
    
    try:
        decoder_model = hub.upload_model(decoder_dlc_path)
        
        decoder_profile_job = hub.submit_profile_job(
            model=decoder_model,
            device=device,
        )
        
        # Wait for job to complete
        decoder_profile_job.wait()
        
        # Get profile results
        decoder_profile_results = decoder_profile_job.get_profile_results()
        
        print("\n    Decoder Performance Metrics:")
        if decoder_profile_results:
            for key, value in decoder_profile_results.items():
                if 'inference_time' in key.lower():
                    print(f"    - {key}: {value:.3f} ms")
                elif 'throughput' in key.lower():
                    print(f"    - {key}: {value:.2f} inferences/sec")
                elif 'memory' in key.lower():
                    if isinstance(value, (int, float)):
                        print(f"    - {key}: {value / 1024 / 1024:.2f} MB")
                    else:
                        print(f"    - {key}: {value}")
                else:
                    print(f"    - {key}: {value}")
        
        print(f"\n    Downloading full profiling report to: decoder_profile_results/")
        decoder_profile_job.download_results("decoder_profile_results")
        
    except Exception as e:
        print(f"    Error profiling decoder: {e}")
    
    print("\n" + "=" * 60)
    print("Profiling Complete")
    print("=" * 60)

def profile_with_custom_input():
    print("\n" + "=" * 60)
    print("Whisper Model NPU Profiling with Custom Input")
    print("=" * 60)
    
    encoder_dlc_path = Path("whisper_tiny_en-whisperencoderinf.dlc")
    decoder_dlc_path = Path("whisper_tiny_en-whisperdecoderinf.dlc")
    
    device = hub.Device("Snapdragon X Elite CRD")
    
    # Create sample input for encoder (mel spectrogram)
    # Whisper tiny expects (1, 80, 3000) for 30 seconds of audio
    mel_input = np.random.randn(1, 80, 3000).astype(np.float32)
    
    print("\n[1] Profiling Encoder with Sample Input")
    print(f"    Input shape: {mel_input.shape}")
    
    try:
        encoder_model = hub.upload_model(encoder_dlc_path)
        
        # Submit profile job with input
        encoder_profile_job = hub.submit_profile_job(
            model=encoder_model,
            device=device,
            inputs={"mel": [mel_input]},
        )
        
        # Wait and get results
        encoder_profile_job.wait()
        
        print("\n    Detailed Performance Analysis:")
        
        # Get profile results
        profile_results = encoder_profile_job.get_profile_results()
        
        if profile_results:
            print("\n    Profile Results:")
            for key, value in profile_results.items():
                if isinstance(value, dict):
                    print(f"    - {key}:")
                    for sub_key, sub_value in value.items():
                        print(f"        {sub_key}: {sub_value}")
                else:
                    print(f"    - {key}: {value}")
        
        # Download detailed profiling data
        print(f"\n    Downloading detailed profile to: encoder_detailed_profile/")
        encoder_profile_job.download_results("encoder_detailed_profile")
        
    except Exception as e:
        print(f"    Error in detailed profiling: {e}")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    print("Starting NPU Profile for Whisper Models\n")
    
    # Basic profiling
    profile_whisper_models()
    
    # Detailed profiling with custom input
    profile_with_custom_input()