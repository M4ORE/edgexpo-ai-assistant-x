@echo off
chcp 65001 >nul 2>&1
echo.
echo ================================================================================
echo  EdgExpo AI Assistant - Setup Guide
echo ================================================================================
echo.
echo This guide will help you set up the microservices architecture step by step.
echo.
echo IMPORTANT: Follow these steps in order for best results.
echo.
echo ================================================================================
echo STEP 1: Environment Check
echo ================================================================================
echo.
echo This will check if Python 3.12 x64 is installed and guide you to install it
echo if needed from Microsoft Store.
echo.
set /p continue1="Press Enter to run environment check, or 'S' to skip: "
if /i "%continue1%"=="s" goto STEP2

call check-dependencies.bat
if errorlevel 1 (
    echo.
    echo [ERROR] Environment check failed. Please fix the issues above before continuing.
    pause
    exit /b 1
)

:STEP2
echo.
echo ================================================================================
echo STEP 2: Service Environment Setup 
echo ================================================================================
echo.
echo Choose which services to set up:
echo   1. All services (recommended for first-time setup)
echo   2. Individual services (for troubleshooting specific services)
echo   3. Skip to testing existing services
echo.
set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" goto SETUP_ALL
if "%choice%"=="2" goto SETUP_INDIVIDUAL  
if "%choice%"=="3" goto STEP3
goto STEP2

:SETUP_ALL
echo.
echo Setting up all microservice environments...
echo This may take several minutes depending on your internet connection.
echo.

echo [1/5] Setting up main backend environment...
call setup-microservice-env.bat
if errorlevel 1 (
    echo [ERROR] Main backend setup failed
    pause
    exit /b 1
)

echo.
echo [2/5] Setting up TTS service...
call setup-tts-env.bat
if errorlevel 1 (
    echo [ERROR] TTS service setup failed
    pause
    exit /b 1
)

echo.
echo [3/5] Setting up STT service...
call setup-stt-env.bat
if errorlevel 1 (
    echo [ERROR] STT service setup failed
    pause
    exit /b 1
)

echo.
echo [4/5] Setting up Embedding service...
call setup-embedding-env.bat
if errorlevel 1 (
    echo [ERROR] Embedding service setup failed
    pause
    exit /b 1
)

echo.
echo [5/5] All service environments setup completed!
goto STEP3

:SETUP_INDIVIDUAL
echo.
echo Individual Service Setup:
echo   1. Main Backend
echo   2. TTS Service (Text-to-Speech)
echo   3. STT Service (Speech-to-Text) 
echo   4. Embedding Service
echo   5. Back to main menu
echo.
set /p svc_choice="Select service to setup (1-5): "

if "%svc_choice%"=="1" (
    call setup-microservice-env.bat
) else if "%svc_choice%"=="2" (
    call setup-tts-env.bat
) else if "%svc_choice%"=="3" (
    call setup-stt-env.bat
) else if "%svc_choice%"=="4" (
    call setup-embedding-env.bat
) else if "%svc_choice%"=="5" (
    goto STEP2
) else (
    echo Invalid choice. Please try again.
    goto SETUP_INDIVIDUAL
)

echo.
set /p more="Setup another service? (y/n): "
if /i "%more%"=="y" goto SETUP_INDIVIDUAL

:STEP3
echo.
echo ================================================================================
echo STEP 3: Test Services
echo ================================================================================
echo.
echo Now let's test the services to see which ones are working.
echo.
set /p continue3="Press Enter to test services, or 'S' to skip: "
if /i "%continue3%"=="s" goto STEP4

call test-services.bat
echo.
echo Review the test results above.

:STEP4
echo.
echo ================================================================================
echo STEP 4: Start All Services 
echo ================================================================================
echo.
echo This will start all microservices in the correct order.
echo.
echo Services that will be started:
echo   - Embedding Service (Port 11434)
echo   - LLM Service (Port 8910)
echo   - STT Service (Port 5003)
echo   - TTS Service (Port 5004)  
echo   - Backend API Gateway (Port 5000)
echo.
set /p continue4="Press Enter to start all services, or 'S' to skip: "
if /i "%continue4%"=="s" goto STEP5

call start-all-microservices.bat

:STEP5
echo.
echo ================================================================================
echo STEP 5: Monitor Services
echo ================================================================================
echo.
echo You can now monitor your services using:
echo   - check-microservices-status.bat - Check service health
echo   - test-services.bat - Quick service testing
echo   - stop-all-microservices.bat - Stop all services
echo.
echo Web interfaces:
echo   - Main Application: http://127.0.0.1:5000
echo   - Backend API: http://127.0.0.1:5000/api/health
echo   - Individual service health endpoints are shown in service status
echo.
echo ================================================================================
echo Setup Complete!
echo ================================================================================
echo.
pause