@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

REM Get simple timestamp
set "timestamp=%time:~0,5%"

echo Stopping EdgExpo AI Assistant Microservices...
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
echo {"phase": "stopping", "status": "running", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\microservices_status.json"

echo Stopping all microservices...

REM 1. Stop Backend API Gateway (port 5000)
echo [1/5] Stopping Backend API Gateway...
taskkill /f /im python.exe /fi "WINDOWTITLE eq Backend API Gateway*" >nul 2>&1
echo {"service": "backend", "phase": "stopped", "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\backend.json"

REM 2. Stop TTS Service (port 5004)
echo [2/5] Stopping TTS Service...
taskkill /f /im python.exe /fi "WINDOWTITLE eq TTS Service*" >nul 2>&1
echo {"service": "tts", "phase": "stopped", "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\tts.json"

REM 3. Stop STT Service (port 5003)
echo [3/5] Stopping STT Service...
taskkill /f /im python.exe /fi "WINDOWTITLE eq STT Service*" >nul 2>&1
echo {"service": "stt", "phase": "stopped", "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\stt.json"

REM 4. Stop LLM Service (port 8910)
echo [4/5] Stopping LLM Service (Genie)...
taskkill /f /im GenieAPIService.exe >nul 2>&1
taskkill /f /im GenieAPIClient.exe >nul 2>&1
echo {"service": "llm", "phase": "stopped", "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\llm.json"

REM 5. Stop Embedding Service (port 11434)
echo [5/5] Stopping Embedding Service...
taskkill /f /im python.exe /fi "WINDOWTITLE eq Embedding Service*" >nul 2>&1
echo {"service": "embedding", "phase": "stopped", "timestamp": "%timestamp%"} > "%SERVICE_STATUS_DIR%\embedding.json"

REM Additional cleanup - stop any remaining Python processes that might be related
echo.
echo Performing additional cleanup...

REM Stop any remaining Python processes from the service directories (be careful not to kill unrelated processes)
for /f "tokens=2" %%p in ('tasklist /fi "imagename eq python.exe" /fo csv ^| findstr /v "PID"') do (
    set pid=%%p
    set pid=!pid:"=!
    
    REM Get the command line to check if it's from our services
    for /f "tokens=*" %%c in ('wmic process where "processid=!pid!" get commandline /format:list ^| findstr "CommandLine"') do (
        set cmdline=%%c
        echo !cmdline! | findstr /i "service-" >nul
        if not errorlevel 1 (
            echo Stopping service-related Python process !pid!...
            taskkill /f /pid !pid! >nul 2>&1
        )
        
        echo !cmdline! | findstr /i "whisper_api_server\|start_service\|app.py" >nul
        if not errorlevel 1 (
            echo Stopping microservice Python process !pid!...
            taskkill /f /pid !pid! >nul 2>&1
        )
    )
)

REM Wait a moment for processes to fully terminate
timeout /t 3 /nobreak >nul

REM Verify services are stopped
echo.
echo Verifying services are stopped...

set stopped_count=0

curl -s -m 5 http://127.0.0.1:11434/health >nul 2>&1
if errorlevel 1 (
    echo   ✅ Embedding Service (11434) - STOPPED
    set /a stopped_count+=1
) else (
    echo   ❌ Embedding Service (11434) - STILL RUNNING
)

curl -s -m 5 http://127.0.0.1:8910/v1/models >nul 2>&1
if errorlevel 1 (
    echo   ✅ LLM Service (8910) - STOPPED
    set /a stopped_count+=1
) else (
    echo   ❌ LLM Service (8910) - STILL RUNNING
)

curl -s -m 5 http://127.0.0.1:5003/health >nul 2>&1
if errorlevel 1 (
    echo   ✅ STT Service (5003) - STOPPED
    set /a stopped_count+=1
) else (
    echo   ❌ STT Service (5003) - STILL RUNNING
)

curl -s -m 5 http://127.0.0.1:5004/health >nul 2>&1
if errorlevel 1 (
    echo   ✅ TTS Service (5004) - STOPPED
    set /a stopped_count+=1
) else (
    echo   ❌ TTS Service (5004) - STILL RUNNING
)

curl -s -m 5 http://127.0.0.1:5000/api/health >nul 2>&1
if errorlevel 1 (
    echo   ✅ Backend API (5000) - STOPPED
    set /a stopped_count+=1
) else (
    echo   ❌ Backend API (5000) - STILL RUNNING
)

REM Write final status
echo {"phase": "stopped", "status": "completed", "services_stopped": !stopped_count!, "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\microservices_status.json"

echo.
echo ================================================================================
echo  Microservices Stop Summary
echo ================================================================================
echo   Services stopped: !stopped_count!/5
if !stopped_count! equ 5 (
    echo   Status: All services stopped successfully
    echo.
    echo   All EdgExpo AI Assistant microservices have been stopped.
) else (
    echo   Status: Some services may still be running
    echo.
    echo   Some services may still be running. You may need to:
    echo   1. Check for any remaining processes in Task Manager
    echo   2. Restart your computer if services are stuck
    echo   3. Check firewall settings if ports are still in use
)

echo.
echo Status files location: %SERVICE_STATUS_DIR%
echo.

REM Ask if user wants to restart services
set /p restart_choice="Would you like to restart all services? (y/n): "
if /i "%restart_choice%"=="y" (
    echo.
    echo Restarting all services...
    call "%SCRIPT_DIR%start-all-microservices.bat"
) else (
    echo.
    echo Services remain stopped. Run 'start-all-microservices.bat' to restart them.
    pause
)

endlocal