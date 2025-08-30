@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

REM Get simple timestamp
set "timestamp=%time:~0,5%"

echo Starting all microservices for EdgExpo AI Assistant...
echo.

REM Set paths
set SCRIPT_DIR=%~dp0
set ROOT_DIR=%SCRIPT_DIR%..
set USER_DATA_DIR=%APPDATA%\EdgExpo-AI-Assistant-X
set SERVICE_STATUS_DIR=%USER_DATA_DIR%\services

REM Create necessary directories
if not exist "%USER_DATA_DIR%" mkdir "%USER_DATA_DIR%"
if not exist "%SERVICE_STATUS_DIR%" mkdir "%SERVICE_STATUS_DIR%"

REM Write initial status
echo {"phase": "starting", "status": "running", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\microservices_status.json"

echo Starting microservices in order...

REM 1. Start Embedding Service (port 11434)
echo [1/4] Starting Embedding Service...
echo {"service": "embedding", "phase": "starting", "port": 11434, "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\embedding.json"

cd /d "%ROOT_DIR%\service-embedding"
if not exist "venv-embedding\Scripts\python.exe" (
    echo [ERROR] Embedding virtual environment not found. Run setup-embedding-env.bat first.
    echo {"service": "embedding", "phase": "error", "message": "venv not found", "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\embedding.json"
    goto ERROR_EXIT
)

start "Embedding Service (Port 11434)" cmd /c "venv-embedding\Scripts\python.exe start_service.py --host 127.0.0.1 --port 11434"
timeout /t 3 /nobreak >nul

REM Check if embedding service started
curl -s http://127.0.0.1:11434/health >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Embedding service health check failed, but continuing...
    echo {"service": "embedding", "phase": "warning", "message": "health check failed", "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\embedding.json"
) else (
    echo [OK] Embedding service started
    echo {"service": "embedding", "phase": "ready", "port": 11434, "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\embedding.json"
)

REM 2. Start LLM Service (port 8910) 
echo [2/4] Starting LLM Service (Genie)...
echo {"service": "llm", "phase": "starting", "port": 8910, "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\llm.json"

cd /d "%ROOT_DIR%\service-llm"
start "LLM Service - Genie (Port 8910)" cmd /c "start.bat"
timeout /t 5 /nobreak >nul

REM Check if LLM service started
curl -s http://127.0.0.1:8910/v1/models >nul 2>&1
if errorlevel 1 (
    echo [WARNING] LLM service health check failed, but continuing...
    echo {"service": "llm", "phase": "warning", "message": "health check failed", "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\llm.json"
) else (
    echo [OK] LLM service started
    echo {"service": "llm", "phase": "ready", "port": 8910, "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\llm.json"
)

REM 3. Start STT Service (port 5003)
echo [3/4] Starting STT Service...
echo {"service": "stt", "phase": "starting", "port": 5003, "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\stt.json"

cd /d "%ROOT_DIR%\service-stt"
if not exist "venv-stt\Scripts\python.exe" (
    echo [ERROR] STT virtual environment not found. Run setup-stt-env.bat first.
    echo {"service": "stt", "phase": "error", "message": "venv not found", "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\stt.json"
    goto ERROR_EXIT
)

start "STT Service - Whisper (Port 5003)" cmd /c "venv-stt\Scripts\python.exe whisper_api_server.py"
timeout /t 5 /nobreak >nul

REM Check if STT service started
curl -s http://127.0.0.1:5003/health >nul 2>&1
if errorlevel 1 (
    echo [WARNING] STT service health check failed, but continuing...
    echo {"service": "stt", "phase": "warning", "message": "health check failed", "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\stt.json"
) else (
    echo [OK] STT service started
    echo {"service": "stt", "phase": "ready", "port": 5003, "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\stt.json"
)

REM 4. Start TTS Service (port 5004)
echo [4/4] Starting TTS Service...
echo {"service": "tts", "phase": "starting", "port": 5004, "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\tts.json"

cd /d "%ROOT_DIR%\service-tts"
if not exist "venv-tts\Scripts\python.exe" (
    echo [ERROR] TTS virtual environment not found. Run setup-tts-env.bat first.
    echo {"service": "tts", "phase": "error", "message": "venv not found", "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\tts.json"
    goto ERROR_EXIT
)

start "TTS Service - Edge-TTS (Port 5004)" cmd /c "venv-tts\Scripts\python.exe app.py"
timeout /t 3 /nobreak >nul

REM Check if TTS service started
curl -s http://127.0.0.1:5004/health >nul 2>&1
if errorlevel 1 (
    echo [WARNING] TTS service health check failed, but continuing...
    echo {"service": "tts", "phase": "warning", "message": "health check failed", "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\tts.json"
) else (
    echo [OK] TTS service started
    echo {"service": "tts", "phase": "ready", "port": 5004, "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\tts.json"
)

REM Wait for services to fully start
echo.
echo Waiting for services to fully initialize...
timeout /t 10 /nobreak >nul

REM 5. Start Backend API Gateway (port 5000)
echo [5/5] Starting Backend API Gateway...
echo {"service": "backend", "phase": "starting", "port": 5000, "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\backend.json"

cd /d "%ROOT_DIR%\backend"
start "Backend API Gateway (Port 5000)" cmd /c "python app.py"
timeout /t 5 /nobreak >nul

REM Check if backend started
curl -s http://127.0.0.1:5000/api/health >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Backend service health check failed
    echo {"service": "backend", "phase": "warning", "message": "health check failed", "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\backend.json"
) else (
    echo [OK] Backend API Gateway started
    echo {"service": "backend", "phase": "ready", "port": 5000, "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\backend.json"
)

REM Complete
echo {"phase": "completed", "status": "running", "services_started": 5, "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\microservices_status.json"

echo.
echo ================================================================================
echo  EdgExpo AI Assistant Microservices Started Successfully
echo ================================================================================
echo.
echo Service Status:
echo   Embedding Service: http://127.0.0.1:11434/health
echo   LLM Service:       http://127.0.0.1:8910/v1/models  
echo   STT Service:       http://127.0.0.1:5003/health
echo   TTS Service:       http://127.0.0.1:5004/health
echo   Backend API:       http://127.0.0.1:5000/api/health
echo.
echo Main Application:    http://127.0.0.1:5000
echo.
echo Status files location: %SERVICE_STATUS_DIR%
echo.
echo Press any key to open service monitor...
pause >nul

REM Open service monitor
call "%SCRIPT_DIR%check-microservices-status.bat"
goto END

:ERROR_EXIT
echo {"phase": "error", "status": "failed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\microservices_status.json"
echo.
echo [ERROR] Failed to start microservices. Check the error messages above.
echo.
pause
exit /b 1

:END
endlocal