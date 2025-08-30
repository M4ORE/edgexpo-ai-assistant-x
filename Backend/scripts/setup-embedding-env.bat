@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

REM Get simple timestamp
set "timestamp=%time:~0,5%"

echo Setting up Embedding service environment...

REM Set paths
set SCRIPT_DIR=%~dp0
set ROOT_DIR=%SCRIPT_DIR%..
set EMBEDDING_SERVICE_DIR=%ROOT_DIR%\service-embedding
set USER_DATA_DIR=%APPDATA%\EdgExpo-AI-Assistant-X
set EMBEDDING_VENV_DIR=%EMBEDDING_SERVICE_DIR%\venv-embedding

REM Check requirements.txt
if not exist "%EMBEDDING_SERVICE_DIR%\requirements.txt" (
    echo [ERROR] Embedding requirements.txt not found
    exit /b 1
)

REM Remove existing virtual environment if it exists
if exist "%EMBEDDING_VENV_DIR%" (
    echo [INFO] Removing existing Embedding virtual environment...
    rmdir /s /q "%EMBEDDING_VENV_DIR%"
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

echo [INFO] Creating new Embedding virtual environment...
echo {"phase": "creating_embedding_venv", "status": "running", "progress": 0, "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"

REM Create virtual environment
!PYTHON_CMD! -m venv "%EMBEDDING_VENV_DIR%"
if errorlevel 1 (
    echo [ERROR] Embedding virtual environment creation failed
    echo {"phase": "error", "status": "failed", "message": "Embedding venv creation failed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"
    exit /b 1
)

echo [OK] Embedding virtual environment created

echo Installing Embedding dependencies in existing virtual environment...
echo {"phase": "installing_embedding", "status": "running", "progress": 50, "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"

REM Install dependencies in the existing virtual environment
"%EMBEDDING_VENV_DIR%\Scripts\python.exe" -m pip install --upgrade pip
"%EMBEDDING_VENV_DIR%\Scripts\python.exe" -m pip install -r "%EMBEDDING_SERVICE_DIR%\requirements.txt"

if errorlevel 1 (
    echo [ERROR] Embedding dependencies installation failed
    echo {"phase": "error", "status": "failed", "message": "Embedding dependencies installation failed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"
    exit /b 1
)

REM Install onnxruntime-qnn if requirements-qnn.txt exists
if exist "%EMBEDDING_SERVICE_DIR%\requirements-qnn.txt" (
    echo [INFO] Installing QNN dependencies...
    "%EMBEDDING_VENV_DIR%\Scripts\python.exe" -m pip install -r "%EMBEDDING_SERVICE_DIR%\requirements-qnn.txt"
    if errorlevel 1 (
        echo [WARNING] QNN requirements installation failed - continuing with regular requirements...
    )
)

REM Test if the embedding service can import required modules
echo Testing embedding imports...
"%EMBEDDING_VENV_DIR%\Scripts\python.exe" -c "import onnxruntime; import numpy; print('Core embedding dependencies imported successfully')"
if errorlevel 1 (
    echo [ERROR] Embedding dependencies test failed
    echo {"phase": "error", "status": "failed", "message": "Embedding dependencies test failed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"
    exit /b 1
)

echo [OK] Embedding environment setup completed
echo {"phase": "embedding_ready", "status": "completed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"