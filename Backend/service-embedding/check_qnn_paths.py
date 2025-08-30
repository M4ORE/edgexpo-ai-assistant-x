#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Check QNN backend path and available options
"""

import os
import sys
from pathlib import Path


def check_qnn_paths():
    """Check all possible QNN paths"""
    print("=== QNN Backend Path Check ===")
    
    # 1. Check onnxruntime-qnn package path
    try:
        import onnxruntime as ort
        package_path = Path(ort.__file__).parent
        capi_path = package_path / "capi"
        
        print(f"1. ONNXRuntime package path: {package_path}")
        print(f"   CAPI path: {capi_path}")
        
        if capi_path.exists():
            dll_files = list(capi_path.glob("Qnn*.dll"))
            print(f"   Found QNN DLLs:")
            for dll in dll_files:
                print(f"     {dll}")
        else:
            print("   CAPI directory does not exist")
            
    except ImportError:
        print("   Unable to import onnxruntime")
    
    # 2. Check current using path
    current_path = Path("C:\\Users\\paste\\Documents\\project\\EdgeExpo\\service-llm\\QnnHtp.dll")
    print(f"\n2. Current using path: {current_path}")
    if current_path.exists():
        print("   File exists")
        print(f"   File size: {current_path.stat().st_size / (1024*1024):.2f} MB")
    else:
        print("   File does not exist")
    
    # 3. Check environment variables
    print("\n3. Related environment variables:")
    qnn_vars = [
        "QNN_SDK_ROOT",
        "QNN_HOME", 
        "QUALCOMM_AI_ENGINE_ROOT",
        "PATH",
        "LD_LIBRARY_PATH"
    ]
    
    for var in qnn_vars:
        value = os.environ.get(var, "Not set")
        if var == "PATH" and value != "Not set":
            # Check if PATH contains QNN related paths
            paths = value.split(os.pathsep)
            qnn_paths = [p for p in paths if "qnn" in p.lower()]
            if qnn_paths:
                print(f"   {var}: Found {len(qnn_paths)} QNN related paths")
                for p in qnn_paths[:3]:  # Show only first 3
                    print(f"     - {p}")
            else:
                print(f"   {var}: No QNN related paths in PATH")
        else:
            print(f"   {var}: {value}")
    
    # 4. Check common QNN SDK install paths
    print("\n4. Common QNN SDK path check:")
    common_paths = [
        "C:\\Qualcomm\\QNN",
        "C:\\Program Files\\Qualcomm\\QNN", 
        "C:\\QNN",
        "C:\\Qualcomm\\AIStack",
    ]
    
    for path in common_paths:
        path_obj = Path(path)
        if path_obj.exists():
            print(f"   ✓ {path}")
            # Find DLL files
            dll_files = list(path_obj.rglob("Qnn*.dll"))
            if dll_files:
                print(f"     Found {len(dll_files)} DLL files:")
                for dll in dll_files[:5]:  # Show only first 5
                    print(f"       - {dll}")
        else:
            print(f"   ✗ {path}")


def check_qnn_providers():
    """Check available QNN providers"""
    print("\n=== QNN Provider Check ===")
    
    try:
        import onnxruntime as ort
        available_providers = ort.get_available_providers()
        
        print(f"All available providers:")
        for i, provider in enumerate(available_providers):
            marker = "★" if "QNN" in provider else " "
            print(f"  {marker} {i+1}. {provider}")
        
        if "QNNExecutionProvider" in available_providers:
            print("\n✓ QNNExecutionProvider is available!")
        else:
            print("\n✗ QNNExecutionProvider is not available")
            print("  You may need to install onnxruntime-qnn")
            
    except ImportError:
        print("  Unable to import onnxruntime")


def suggest_config():
    """Suggest optimal configuration"""
    print("\n=== Suggested Configuration ===")
    
    # Check your DLL
    your_dll = Path("C:\\Users\\paste\\Documents\\project\\EdgeExpo\\service-llm\\QnnHtp.dll")
    if your_dll.exists():
        print("✓ Recommended: Use your DLL (already tested):")
        print(f"  backend_path: '{your_dll}'")
    
    # Check package DLL
    try:
        import onnxruntime as ort
        package_dll = Path(ort.__file__).parent / "capi" / "QnnHtp.dll"
        if package_dll.exists():
            print("\n✓ Alternative: Use package bundled DLL:")
            print(f"  backend_path: '{package_dll}'")
    except ImportError:
        pass
    
    print("\n✓ Suggested qnn_options:")
    print("""
qnn_options = {
    'backend_path': 'C:\\\\Users\\\\paste\\\\Documents\\\\project\\\\EdgeExpo\\\\service-llm\\\\QnnHtp.dll',
    'profiling_level': 'basic',
    'htp_performance_mode': 'high_performance',
    'htp_graph_finalization_optimization_mode': '3',
    'soc_model': '0',  # Auto detect
    'device_id': '0'
}""")


if __name__ == "__main__":
    check_qnn_paths()
    check_qnn_providers()
    suggest_config()