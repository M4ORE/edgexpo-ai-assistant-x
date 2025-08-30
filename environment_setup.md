# Environment Setup Guide

## Technical Architecture

- **Speech Processing**: Whisper → Snapdragon NPU with ONNX Runtime + QNN
- **Text Recognition**: EasyOCR/TrOCR → Snapdragon NPU with ONNX Runtime + QNN  
- **Large Language Model**: Phi-3.5-mini → Snapdragon NPU with ONNX Runtime + QNN
- **Inference Backend**: ONNX Runtime + QNN/DirectML → Snapdragon NPU

## Environment Installation Steps

### 1. Python 3.12(x64) Installation (Windows)

We recommend installing Python 3.12(x64) from Microsoft Store for the best Windows integration experience:

1. Open **Microsoft Store**
2. Search for **Python 3.12**
3. Click **Get** to install
4. Verify installation:
   ```powershell
   python --version
   # Should display: Python 3.12.x
   ```

### 2. Create Virtual Environment

Use Python's built-in venv module to create an isolated development environment:

```powershell
# Create virtual environment in project root directory
python -m venv venv

# Activate virtual environment
# Windows PowerShell:
.\venv\Scripts\Activate.ps1

# Windows Command Prompt:
venv\Scripts\activate.bat

# Confirm virtual environment is activated (prompt should display (venv))
(venv) C:\Users\paste\Documents\Github\edgexpo-ai-assistant-x>
```

### 3. Qualcomm AI Engine Direct (QNN SDK) Installation

#### 3.1 Download and Install QAIRT

1. Go to [Qualcomm AI Engine Direct](https://www.qualcomm.com/developer/software/neural-processing-sdk-for-ai) download page
2. Register/login to Qualcomm developer account
3. Download QAIRT SDK for Windows (version 2.37.1 or newer)
4. Run the installer, default installation path:
   ```
   C:\Qualcomm\AIStack\QAIRT\2.37.1.250807\
   ```

#### 3.2 Set Environment Variables

Refer to [Windows Setup Guide](https://docs.qualcomm.com/bundle/publicresource/topics/80-63442-50/windows_setup.html) to set the following environment variables:

**Method 1: Using PowerShell (Temporary Setup)**
```powershell
# Set QAIRT_SDK_ROOT
$env:QAIRT_SDK_ROOT = "C:\Qualcomm\AIStack\QAIRT\2.37.1.250807"

# Set QNN_SDK_ROOT (same path)
$env:QNN_SDK_ROOT = "C:\Qualcomm\AIStack\QAIRT\2.37.1.250807"

# Add necessary DLL paths to PATH
$env:PATH = "$env:QAIRT_SDK_ROOT\lib\arm64x-windows-msvc;$env:PATH"
$env:PATH = "$env:QAIRT_SDK_ROOT\bin\x86_64-windows-msvc;$env:PATH"
```

**Method 2: Permanent Setup (System Environment Variables)**
1. Open **System Properties** → **Advanced System Settings** → **Environment Variables**
2. Add to **System Variables**:
   - Variable Name: `QAIRT_SDK_ROOT`
   - Variable Value: `C:\Qualcomm\AIStack\QAIRT\2.37.1.250807`
3. Also add `QNN_SDK_ROOT` variable (same value)
4. Edit `PATH` variable, add the following paths:
   - `%QAIRT_SDK_ROOT%\lib\arm64x-windows-msvc`
   - `%QAIRT_SDK_ROOT%\bin\x86_64-windows-msvc`

#### 3.3 Verify Installation

```powershell
# Check environment variables
echo $env:QAIRT_SDK_ROOT

# Check if QNN tools are available
qnn-net-run --version

# List supported backends
qnn-platform-validator --list-backends
```

### 4. Install Python Packages

Install necessary packages in the virtual environment:

```powershell
# Ensure virtual environment is activated
(venv) > pip install --upgrade pip

# Install project dependencies
(venv) > pip install -r requirements.txt

# Or manually install core packages
(venv) > pip install onnxruntime-qnn qai-hub numpy psutil
```

### 5. Verify Complete Environment

Run the following Python script to verify environment setup:

```python
import os
import sys
import onnxruntime as ort

# Check Python version
print(f"Python Version: {sys.version}")

# Check QAIRT environment variables
qairt_root = os.environ.get('QAIRT_SDK_ROOT')
print(f"QAIRT_SDK_ROOT: {qairt_root}")

# Check ONNX Runtime QNN Provider
providers = ort.get_available_providers()
if 'QNNExecutionProvider' in providers:
    print("✓ QNN Provider available")
else:
    print("✗ QNN Provider unavailable, please check QAIRT installation")

print(f"Available Providers: {providers}")
```

### Troubleshooting

#### Common Issues

1. **PowerShell Execution Policy Error**
   ```powershell
   # If unable to execute Activate.ps1
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

2. **QNN Provider Unavailable**
   - Confirm Snapdragon X Elite processor
   - Check QAIRT SDK installation path
   - Verify environment variables are set correctly
   - Restart terminal or computer

3. **DLL Load Error**
   - Ensure ARM64X library path is at the front of PATH
   - Check if Visual C++ Redistributable is installed

## Profiling Tools

This project includes a deep learning model performance analysis toolkit optimized for Snapdragon X Elite NPU.

### Supported Models
- **Whisper**: Speech recognition model (tiny-en version)
- **OCR**: Text recognition models (EasyOCR, TrOCR)

### Quick Start

```bash
# Navigate to profiling directory
cd profiling/

# Install dependencies
pip install -r requirements.txt

# Run Whisper profiling (cloud)
python whisper/profile_whisper_npu.py

# Run OCR profiling
python ocr/profile_ocr_models.py
```

### Key Features
- NPU hardware acceleration performance analysis
- Model inference time measurement
- Memory usage tracking
- QAI Hub cloud profiling support
- Support for DLC and ONNX formats

### Environment Requirements
- Snapdragon X Elite processor
- QAIRT 2.37.1.250807 or newer
- Python 3.8+
- onnxruntime-qnn

For detailed usage instructions, please refer to [profiling/readme.md](profiling/readme.md)