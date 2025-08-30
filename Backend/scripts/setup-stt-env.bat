@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

REM Get simple timestamp
set "timestamp=%time:~0,5%"

echo Setting up STT service environment...

REM Set paths
set SCRIPT_DIR=%~dp0
set ROOT_DIR=%SCRIPT_DIR%..
set STT_SERVICE_DIR=%ROOT_DIR%\service-stt
set USER_DATA_DIR=%APPDATA%\EdgExpo-AI-Assistant-X
set STT_VENV_DIR=%STT_SERVICE_DIR%\venv-stt

REM Check requirements.txt
if not exist "%STT_SERVICE_DIR%\requirements.txt" (
    echo [ERROR] STT requirements.txt not found
    exit /b 1
)

REM Remove existing virtual environment if it exists
if exist "%STT_VENV_DIR%" (
    echo [INFO] Removing existing STT virtual environment...
    rmdir /s /q "%STT_VENV_DIR%"
    timeout /t 2 /nobreak >nul
)

REM Get detected Python command from check-dependencies.bat
if exist "%USER_DATA_DIR%\python_cmd.txt" (
    set /p PYTHON_CMD=<"%USER_DATA_DIR%\python_cmd.txt"
    echo Using detected Python command: !PYTHON_CMD!
) else (
    echo Python command not detected. Please run check-dependencies.bat first.
    echo {"phase": "error", "status": "failed", "message": "Python command not detected", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"
    exit /b 1
)

echo [INFO] Creating new STT virtual environment...
echo {"phase": "creating_stt_venv", "status": "running", "progress": 0, "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"

REM Create virtual environment
!PYTHON_CMD! -m venv "%STT_VENV_DIR%"
if errorlevel 1 (
    echo [ERROR] STT virtual environment creation failed
    echo {"phase": "error", "status": "failed", "message": "STT venv creation failed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"
    exit /b 1
)

echo [OK] STT virtual environment created

echo Installing STT dependencies in existing virtual environment...
echo {"phase": "installing_stt", "status": "running", "progress": 50, "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"

REM Install dependencies in the existing virtual environment
"%STT_VENV_DIR%\Scripts\python.exe" -m pip install --upgrade pip
"%STT_VENV_DIR%\Scripts\python.exe" -m pip install -r "%STT_SERVICE_DIR%\requirements.txt"

if errorlevel 1 (
    echo [ERROR] STT dependencies installation failed
    echo {"phase": "error", "status": "failed", "message": "STT dependencies installation failed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"
    exit /b 1
)

REM Install QNN-specific dependencies
echo [INFO] Installing QNN and Whisper dependencies...

REM First remove any existing onnxruntime to avoid conflicts
echo [INFO] Removing existing onnxruntime packages...
"%STT_VENV_DIR%\Scripts\python.exe" -m pip uninstall -y onnxruntime onnxruntime-qnn 2>nul

REM Install onnxruntime-qnn
echo [INFO] Installing onnxruntime-qnn...
"%STT_VENV_DIR%\Scripts\python.exe" -m pip install onnxruntime-qnn==1.22.0
if errorlevel 1 (
    echo [WARNING] onnxruntime-qnn installation failed - installing regular onnxruntime...
    "%STT_VENV_DIR%\Scripts\python.exe" -m pip install onnxruntime==1.22.0
)

REM Install qai_hub_models and related QNN dependencies
echo [INFO] Installing qai_hub_models...
"%STT_VENV_DIR%\Scripts\python.exe" -m pip install qai-hub-models
if errorlevel 1 (
    echo [WARNING] qai-hub-models installation failed
)

REM Install transformers if needed by whisper_api_server
echo [INFO] Installing transformers for Whisper...
"%STT_VENV_DIR%\Scripts\python.exe" -m pip install transformers
if errorlevel 1 (
    echo [WARNING] transformers installation failed
)


echo [OK] STT environment setup completed
echo {"phase": "stt_ready", "status": "completed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"