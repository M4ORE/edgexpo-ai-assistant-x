@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

REM Get simple timestamp
set "timestamp=%time:~0,5%"

echo Checking EdgExpo AI Assistant Microservices Status...
echo.

REM Set paths
set SCRIPT_DIR=%~dp0
set ROOT_DIR=%SCRIPT_DIR%..
set USER_DATA_DIR=%APPDATA%\EdgExpo-AI-Assistant-X
set SERVICE_STATUS_DIR=%USER_DATA_DIR%\services

REM Define services and their health endpoints
set SERVICES=embedding llm stt tts backend
set embedding_url=http://127.0.0.1:11434/health
set llm_url=http://127.0.0.1:8910/v1/models
set stt_url=http://127.0.0.1:5003/health
set tts_url=http://127.0.0.1:5004/health
set backend_url=http://127.0.0.1:5000/api/health

set embedding_port=11434
set llm_port=8910
set stt_port=5003
set tts_port=5004
set backend_port=5000

echo ================================================================================
echo  Service Status Check - %date% %time:~0,8%
echo ================================================================================
echo.

set healthy_count=0
set total_count=5

REM Check each service
for %%s in (%SERVICES%) do (
    call :CHECK_SERVICE %%s
)

echo.
echo ================================================================================
echo  Summary: !healthy_count!/!total_count! services are healthy
echo ================================================================================

REM Write summary status
if !healthy_count! equ !total_count! (
    echo {"overall_status": "healthy", "healthy_count": !healthy_count!, "total_count": !total_count!, "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\overall_status.json"
    echo [OK] All services are healthy!
) else (
    echo {"overall_status": "partial", "healthy_count": !healthy_count!, "total_count": !total_count!, "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\overall_status.json"
    echo [WARNING] Some services are not healthy. Check individual service logs.
)

echo.
echo Service logs and status files:
echo   Status files: %SERVICE_STATUS_DIR%
echo   Overall status: %USER_DATA_DIR%\overall_status.json
echo.

REM Ask for action
:MENU
echo What would you like to do?
echo   1. Refresh status check
echo   2. View detailed service logs
echo   3. Restart failed services
echo   4. Stop all services
echo   5. Exit
echo.
set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" goto :eof
if "%choice%"=="2" call :VIEW_LOGS
if "%choice%"=="3" call :RESTART_FAILED
if "%choice%"=="4" call :STOP_ALL
if "%choice%"=="5" goto :eof

goto MENU

:CHECK_SERVICE
set service_name=%1
set url_var=%service_name%_url
set port_var=%service_name%_port

call set url=%%%url_var%%%
call set port=%%%port_var%%%

echo Checking %service_name% service (port !port!)...

REM Use curl to check service health
curl -s -m 10 "!url!" >nul 2>&1
if errorlevel 1 (
    echo   [FAILED] %service_name% - NOT HEALTHY
    echo {"service": "%service_name%", "status": "unhealthy", "port": !port!, "url": "!url!", "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\%service_name%.json"
) else (
    echo   [OK] %service_name% - HEALTHY
    echo {"service": "%service_name%", "status": "healthy", "port": !port!, "url": "!url!", "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\%service_name%.json"
    set /a healthy_count+=1
)
goto :eof

:VIEW_LOGS
echo.
echo Opening service status files...
if exist "%SERVICE_STATUS_DIR%" (
    explorer "%SERVICE_STATUS_DIR%"
) else (
    echo No status files found. Services may not have been started yet.
)
echo.
goto :eof

:RESTART_FAILED
echo.
echo Checking for failed services to restart...

REM Check each service and restart if unhealthy
for %%s in (%SERVICES%) do (
    if exist "%SERVICE_STATUS_DIR%\%%s.json" (
        findstr /c:"unhealthy" "%SERVICE_STATUS_DIR%\%%s.json" >nul
        if not errorlevel 1 (
            echo Restarting %%s service...
            call :RESTART_SERVICE %%s
        )
    )
)

echo.
echo Restart attempts completed. Rechecking status in 10 seconds...
timeout /t 10 /nobreak >nul
goto :eof

:RESTART_SERVICE
set service_name=%1

echo Attempting to restart %service_name% service...

REM Kill existing processes (basic approach)
if "%service_name%"=="embedding" (
    cd /d "%ROOT_DIR%\service-embedding"
    taskkill /f /im python.exe /fi "WINDOWTITLE eq Embedding*" >nul 2>&1
    timeout /t 2 /nobreak >nul
    start "Embedding Service (Port 11434)" cmd /c "venv-embedding\Scripts\python.exe start_service.py --host 127.0.0.1 --port 11434"
)

if "%service_name%"=="llm" (
    cd /d "%ROOT_DIR%\service-llm"
    taskkill /f /im GenieAPIService.exe >nul 2>&1
    timeout /t 2 /nobreak >nul
    start "LLM Service - Genie (Port 8910)" cmd /c "start.bat"
)

if "%service_name%"=="stt" (
    cd /d "%ROOT_DIR%\service-stt"
    taskkill /f /im python.exe /fi "WINDOWTITLE eq STT*" >nul 2>&1
    timeout /t 2 /nobreak >nul
    start "STT Service - Whisper (Port 5003)" cmd /c "venv-stt\Scripts\python.exe whisper_api_server.py"
)

if "%service_name%"=="tts" (
    cd /d "%ROOT_DIR%\service-tts"
    taskkill /f /im python.exe /fi "WINDOWTITLE eq TTS*" >nul 2>&1
    timeout /t 2 /nobreak >nul
    start "TTS Service - Edge-TTS (Port 5004)" cmd /c "venv-tts\Scripts\python.exe app.py"
)

if "%service_name%"=="backend" (
    cd /d "%ROOT_DIR%\backend"
    taskkill /f /im python.exe /fi "WINDOWTITLE eq Backend*" >nul 2>&1
    timeout /t 2 /nobreak >nul
    start "Backend API Gateway (Port 5000)" cmd /c "python app.py"
)

echo %service_name% restart initiated.
goto :eof

:STOP_ALL
echo.
echo Stopping all microservices...

echo Stopping Python-based services...
taskkill /f /im python.exe /fi "WINDOWTITLE eq *Service*" >nul 2>&1
taskkill /f /im python.exe /fi "WINDOWTITLE eq Backend*" >nul 2>&1

echo Stopping Genie LLM service...
taskkill /f /im GenieAPIService.exe >nul 2>&1

echo All services stopped.
echo {"phase": "stopped", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\microservices_status.json"
echo.
goto :eof

endlocal