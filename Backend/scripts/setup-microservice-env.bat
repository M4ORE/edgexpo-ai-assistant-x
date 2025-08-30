@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

REM Get simple timestamp
set "timestamp=%time:~0,5%"

echo Setting up EdgExpo AI Assistant Microservice Environment...
echo.

REM Set paths
set SCRIPT_DIR=%~dp0
set ROOT_DIR=%SCRIPT_DIR%..
set USER_DATA_DIR=%APPDATA%\EdgExpo-AI-Assistant-X

REM Create necessary directories
if not exist "%USER_DATA_DIR%" mkdir "%USER_DATA_DIR%"

echo {"phase": "environment_setup", "status": "running", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\setup_status.json"

REM Get detected Python command from check-dependencies.bat
if exist "%USER_DATA_DIR%\python_cmd.txt" (
    set /p PYTHON_CMD=<"%USER_DATA_DIR%\python_cmd.txt"
    echo Using detected Python command: !PYTHON_CMD!
) else (
    echo Python command not detected. Please run check-dependencies.bat first.
    echo {"phase": "error", "status": "failed", "message": "Python command not detected", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\setup_status.json"
    pause
    exit /b 1
)

REM Step 1: Check if main backend venv exists, create if needed
echo [1/4] Setting up main backend environment...
if not exist "%ROOT_DIR%\venv" (
    echo Creating main backend virtual environment...
    !PYTHON_CMD! -m venv "%ROOT_DIR%\venv"
    if errorlevel 1 (
        echo [ERROR] Failed to create main backend venv
        echo {"phase": "error", "status": "failed", "message": "backend venv creation failed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\setup_status.json"
        pause
        exit /b 1
    )
    
    REM Activate and install dependencies
    call "%ROOT_DIR%\venv\Scripts\activate.bat"
    if exist "%ROOT_DIR%\requirements.txt" (
        echo Installing main backend dependencies...
        python -m pip install --upgrade pip
        python -m pip install -r "%ROOT_DIR%\requirements.txt"
        if errorlevel 1 (
            echo [WARNING] Some backend dependencies may have failed to install
        ) else (
            echo [OK] Backend dependencies installed
        )
    )
    call deactivate
) else (
    echo [OK] Main backend venv already exists
)

REM Step 2: Setup microservice environments
echo [2/4] Setting up microservice environments...

REM Setup TTS
echo Setting up TTS service...
if not exist "%ROOT_DIR%\service-tts\venv-tts" (
    call "%SCRIPT_DIR%setup-tts-env.bat"
    if errorlevel 1 (
        echo [ERROR] TTS environment setup failed
        echo {"phase": "error", "status": "failed", "message": "TTS setup failed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\setup_status.json"
        pause
        exit /b 1
    )
) else (
    echo [OK] TTS venv already exists
)

REM Setup STT
echo Setting up STT service...
if not exist "%ROOT_DIR%\service-stt\venv-stt" (
    call "%SCRIPT_DIR%setup-stt-env.bat"
    if errorlevel 1 (
        echo [ERROR] STT environment setup failed
        echo {"phase": "error", "status": "failed", "message": "STT setup failed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\setup_status.json"
        pause
        exit /b 1
    )
) else (
    echo [OK] STT venv already exists
)

REM Setup Embedding
echo Setting up Embedding service...
if not exist "%ROOT_DIR%\service-embedding\venv-embedding" (
    call "%SCRIPT_DIR%setup-embedding-env.bat"
    if errorlevel 1 (
        echo [ERROR] Embedding environment setup failed
        echo {"phase": "error", "status": "failed", "message": "Embedding setup failed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\setup_status.json"
        pause
        exit /b 1
    )
) else (
    echo [OK] Embedding venv already exists
)

echo [3/4] Environment setup completed

REM Step 3: Verify LLM service files
echo [4/4] Verifying LLM service...
if not exist "%ROOT_DIR%\service-llm\GenieAPIService.exe" (
    echo [ERROR] GenieAPIService.exe not found in service-llm directory
    echo {"phase": "error", "status": "failed", "message": "LLM service executable not found", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\setup_status.json"
    pause
    exit /b 1
)
echo [OK] LLM service files verified

echo {"phase": "completed", "status": "ready", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\setup_status.json"

echo.
echo ================================================================================
echo  EdgExpo AI Assistant Microservice Environment Setup Completed
echo ================================================================================
echo.
echo Services configured:
echo   - Backend API Gateway (main venv)
echo   - TTS Service (Edge-TTS)
echo   - STT Service (Whisper + QNN)
echo   - Embedding Service (Nomic Embed + QNN)
echo   - LLM Service (Genie) - files verified
echo.
echo Next steps:
echo   1. Run 'start-all-microservices.bat' to start all services
echo   2. Or run individual services from their directories
echo.
echo Status file: %USER_DATA_DIR%\setup_status.json
echo.
pause