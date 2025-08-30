@echo off
chcp 65001 >nul 2>&1
echo Testing individual microservices...
echo.

REM Test each service individually
echo [1] Testing TTS Service (Port 5004)...
curl -s -m 5 http://127.0.0.1:5004/health
if errorlevel 1 (
    echo [FAILED] TTS Service not responding
) else (
    echo [OK] TTS Service healthy
)
echo.

echo [2] Testing LLM Service (Port 8910)...
curl -s -m 5 http://127.0.0.1:8910/v1/models
if errorlevel 1 (
    echo [FAILED] LLM Service not responding
) else (
    echo [OK] LLM Service healthy
)
echo.

echo [3] Testing STT Service (Port 5003)...
curl -s -m 5 http://127.0.0.1:5003/health
if errorlevel 1 (
    echo [FAILED] STT Service not responding
) else (
    echo [OK] STT Service healthy
)
echo.

echo [4] Testing Embedding Service (Port 11434)...
curl -s -m 5 http://127.0.0.1:11434/health
if errorlevel 1 (
    echo [FAILED] Embedding Service not responding
) else (
    echo [OK] Embedding Service healthy
)
echo.

echo [5] Testing Backend API (Port 5000)...
curl -s -m 5 http://127.0.0.1:5000/api/health
if errorlevel 1 (
    echo [FAILED] Backend API not responding
) else (
    echo [OK] Backend API healthy
)
echo.

echo Testing completed. Check individual services above.
pause