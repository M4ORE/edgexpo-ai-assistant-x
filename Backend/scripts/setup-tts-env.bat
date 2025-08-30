@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

REM Get simple timestamp
set "timestamp=%time:~0,5%"

echo Setting up TTS service environment...

REM Set paths
set SCRIPT_DIR=%~dp0
set ROOT_DIR=%SCRIPT_DIR%..
set TTS_SERVICE_DIR=%ROOT_DIR%\service-tts
set USER_DATA_DIR=%APPDATA%\EdgExpo-AI-Assistant-X
set TTS_VENV_DIR=%TTS_SERVICE_DIR%\venv-tts

REM Remove existing virtual environment if it exists
if exist "%TTS_VENV_DIR%" (
    echo [INFO] Removing existing TTS virtual environment...
    rmdir /s /q "%TTS_VENV_DIR%"
    timeout /t 2 /nobreak >nul
)

echo [INFO] Creating new TTS virtual environment...
echo {"phase": "creating_tts_venv", "status": "running", "progress": 0, "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"

REM Get detected Python command from check-dependencies.bat
if exist "%USER_DATA_DIR%\python_cmd.txt" (
    set /p PYTHON_CMD=<"%USER_DATA_DIR%\python_cmd.txt"
    echo Using detected Python command: !PYTHON_CMD!
) else (
    echo Python command not detected. Please run check-dependencies.bat first.
    echo {"phase": "error", "status": "failed", "message": "Python command not detected", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"
    exit /b 1
)

REM Create virtual environment
!PYTHON_CMD! -m venv "%TTS_VENV_DIR%"
if errorlevel 1 (
    echo [ERROR] TTS virtual environment creation failed
    echo {"phase": "error", "status": "failed", "message": "TTS venv creation failed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"
    exit /b 1
)

echo [OK] TTS virtual environment created

REM Check requirements.txt
if not exist "%TTS_SERVICE_DIR%\requirements.txt" (
    echo [ERROR] TTS requirements.txt not found
    exit /b 1
)

echo Installing TTS dependencies in existing virtual environment...
echo {"phase": "installing_tts", "status": "running", "progress": 50, "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"

REM Install dependencies in the existing virtual environment
"%TTS_VENV_DIR%\Scripts\python.exe" -m pip install --upgrade pip
"%TTS_VENV_DIR%\Scripts\python.exe" -m pip install -r "%TTS_SERVICE_DIR%\requirements.txt"

if errorlevel 1 (
    echo [ERROR] TTS dependencies installation failed
    echo {"phase": "error", "status": "failed", "message": "TTS dependencies installation failed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"
    exit /b 1
)

REM Test if edge-tts is available
echo Testing edge-tts...
"%TTS_VENV_DIR%\Scripts\python.exe" -c "import edge_tts; print('edge-tts imported successfully')"
if errorlevel 1 (
    echo [ERROR] edge-tts test failed
    echo {"phase": "error", "status": "failed", "message": "edge-tts test failed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"
    exit /b 1
)

echo [OK] TTS environment setup completed
echo {"phase": "tts_ready", "status": "completed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"