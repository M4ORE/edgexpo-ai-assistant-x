@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

REM Get simple timestamp
set "timestamp=%time:~0,5%"

echo Checking Python service dependencies...
echo.

REM Set paths
set SCRIPT_DIR=%~dp0
set ROOT_DIR=%SCRIPT_DIR%..
set USER_DATA_DIR=%APPDATA%\EdgExpo-AI-Assistant-X
set LIBS_DIR=%USER_DATA_DIR%\python-libs

REM Create necessary directories
if not exist "%USER_DATA_DIR%" mkdir "%USER_DATA_DIR%"

REM Write initial status
echo {"phase": "checking", "status": "running", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"

REM Check for Python installations
echo Scanning Python installations on system...
echo.

REM Create temporary file to store Python options
set TEMP_PYTHONS=%TEMP%\python_options.txt
if exist "%TEMP_PYTHONS%" del "%TEMP_PYTHONS%"

set OPTION_COUNT=0

REM Check python3.12 command
python3.12 --version >nul 2>&1
if not errorlevel 1 (
    set /a OPTION_COUNT+=1
    for /f "tokens=2" %%v in ('python3.12 --version 2^>^&1') do (
        python3.12 -c "import sys; arch='x64' if sys.maxsize > 2**32 else 'x86'; print('%%v (' + arch + ')')" 2>nul | findstr "3\.12.*x64" >nul
        if not errorlevel 1 (
            echo !OPTION_COUNT!. python3.12 - Python %%v (x64) [RECOMMENDED]
            echo python3.12>> "%TEMP_PYTHONS%"
        ) else (
            echo !OPTION_COUNT!. python3.12 - Python %%v (not suitable - wrong version/architecture)
            echo INVALID>> "%TEMP_PYTHONS%"
        )
    )
)

REM Check all python installations using where command
for /f "tokens=*" %%i in ('where python 2^>nul') do (
    "%%i" --version >nul 2>&1
    if not errorlevel 1 (
        set /a OPTION_COUNT+=1
        for /f "tokens=2" %%v in ('"%%i" --version 2^>^&1') do (
            "%%i" -c "import sys; arch='x64' if sys.maxsize > 2**32 else 'x86'; print('%%v (' + arch + ')')" 2>nul | findstr "3\.12.*x64" >nul
            if not errorlevel 1 (
                echo !OPTION_COUNT!. %%i - Python %%v (x64) [SUITABLE]
                echo "%%i">> "%TEMP_PYTHONS%"
            ) else (
                echo !OPTION_COUNT!. %%i - Python %%v (not suitable - wrong version/architecture)
                echo INVALID>> "%TEMP_PYTHONS%"
            )
        )
    )
)

REM Check python3 command if different from above
python3 --version >nul 2>&1
if not errorlevel 1 (
    where python3 2>nul | findstr /v "where python 2" >nul
    if not errorlevel 1 (
        set /a OPTION_COUNT+=1
        for /f "tokens=2" %%v in ('python3 --version 2^>^&1') do (
            python3 -c "import sys; arch='x64' if sys.maxsize > 2**32 else 'x86'; print('%%v (' + arch + ')')" 2>nul | findstr "3\.12.*x64" >nul
            if not errorlevel 1 (
                echo !OPTION_COUNT!. python3 - Python %%v (x64) [SUITABLE]
                echo python3>> "%TEMP_PYTHONS%"
            ) else (
                echo !OPTION_COUNT!. python3 - Python %%v (not suitable - wrong version/architecture)
                echo INVALID>> "%TEMP_PYTHONS%"
            )
        )
    )
)

if %OPTION_COUNT%==0 (
    echo No Python installations found.
    goto :python_not_found
)

echo.
goto :choice_prompt

:custom_path
echo.
echo Enter the full path to your Python 3.12 x64 executable:
echo (Example: C:\Python312\python.exe)
set /p CUSTOM_PYTHON=Python path: 

if not exist "%CUSTOM_PYTHON%" (
    echo [ERROR] File does not exist: %CUSTOM_PYTHON%
    goto :custom_path
)

set PYTHON_CMD="%CUSTOM_PYTHON%"
goto :validate_selection

:invalid_choice
echo [ERROR] Invalid choice. Please try again.
echo.
goto :choice_prompt

:choice_prompt
echo Please select which Python to use (enter number 1-%OPTION_COUNT%, or 0 to enter custom path):
set /p CHOICE=Your choice: 

if "%CHOICE%"=="0" goto :custom_path

if %CHOICE% LSS 1 goto :invalid_choice
if %CHOICE% GTR %OPTION_COUNT% goto :invalid_choice

REM Get selected Python command
set LINE_NUM=0
for /f "delims=" %%i in (%TEMP_PYTHONS%) do (
    set /a LINE_NUM+=1
    if !LINE_NUM!==%CHOICE% (
        if "%%i"=="INVALID" goto :invalid_choice
        set PYTHON_CMD=%%i
        goto :validate_selection
    )
)

:validate_selection
REM Validate the selected Python
%PYTHON_CMD% --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Selected Python is not working properly.
    goto :choice_prompt
)

goto :check_version

:python_not_found
REM Python 3.12 not found - guide user to install
echo {"phase": "error", "status": "python_missing", "message": "Python 3.12 x64 not found", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"
echo.
echo [ERROR] Python 3.12 x64 not found on your system
echo.
echo Please install Python 3.12 from the Microsoft Store:
echo 1. Press Win + S to open search
echo 2. Type "Microsoft Store" and open it
echo 3. Search for "Python 3.12"
echo 4. Install "Python 3.12" by Python Software Foundation
echo.
echo Alternative: Download from https://python.org (make sure to select x64 version)
echo.
echo After installation, restart this script.
pause
exit /b 1

:check_version
REM Test Python and verify architecture
echo Testing Python environment and architecture...
%PYTHON_CMD% -c "import sys; print('Python', sys.version); print('Architecture:', sys.maxsize > 2**32 and 'x64' or 'x86')" 2>&1 | findstr /C:"Architecture: x64" >nul
if errorlevel 1 (
    echo {"phase": "error", "status": "wrong_architecture", "message": "Python is not x64 version", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"
    echo [ERROR] Python installation is not x64 version
    echo Please install Python 3.12 x64 from Microsoft Store or python.org
    pause
    exit /b 1
)

REM Test pip availability
echo Testing pip availability...
%PYTHON_CMD% -m pip --version >nul 2>&1
if errorlevel 1 (
    echo {"phase": "error", "status": "pip_missing", "message": "pip not available", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"
    echo [ERROR] pip not available
    echo Please ensure pip is installed with Python
    pause
    exit /b 1
)

echo [OK] Python 3.12 x64 environment check passed
echo Using Python command: %PYTHON_CMD%

REM Store Python command and path for other scripts
echo %PYTHON_CMD%> "%USER_DATA_DIR%\python_cmd.txt"

REM Get and store the full Python path for system recognition
for /f "delims=" %%i in ('%PYTHON_CMD% -c "import sys; print(sys.executable)"') do set PYTHON_PATH=%%i
echo %PYTHON_PATH%> "%USER_DATA_DIR%\python_path.txt"

REM Get Python installation directory
for %%i in ("%PYTHON_PATH%") do set PYTHON_DIR=%%~dpi
echo %PYTHON_DIR%> "%USER_DATA_DIR%\python_dir.txt"

echo [INFO] Python details saved:
echo   Command: %PYTHON_CMD%
echo   Path: %PYTHON_PATH%
echo   Directory: %PYTHON_DIR%
echo.


REM Check Main Backend dependencies
echo Checking Main Backend environment...
call "%SCRIPT_DIR%setup-microservice-env.bat"
if errorlevel 1 (
    echo {"phase": "error", "status": "failed", "message": "Main Backend setup failed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"
    echo [ERROR] Main Backend environment setup failed
    pause
    exit /b 1
)

REM Check TTS dependencies  
echo Checking TTS service dependencies...
call "%SCRIPT_DIR%setup-tts-env.bat"
if errorlevel 1 (
    echo {"phase": "error", "status": "failed", "message": "TTS setup failed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"
    echo [ERROR] TTS environment setup failed
    pause
    exit /b 1
)

REM Check STT dependencies
echo Checking STT service dependencies...
call "%SCRIPT_DIR%setup-stt-env.bat"
if errorlevel 1 (
    echo {"phase": "error", "status": "failed", "message": "STT setup failed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"
    echo [ERROR] STT environment setup failed
    pause
    exit /b 1
)

REM Check Embedding dependencies
echo Checking Embedding service dependencies...
call "%SCRIPT_DIR%setup-embedding-env.bat"
if errorlevel 1 (
    echo {"phase": "error", "status": "failed", "message": "Embedding setup failed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"
    echo [ERROR] Embedding environment setup failed
    pause
    exit /b 1
)

REM Check LLM service (Genie) - just verify files exist
echo Checking LLM service (Genie)...
if not exist "%ROOT_DIR%\service-llm\GenieAPIService.exe" (
    echo {"phase": "error", "status": "failed", "message": "LLM service executable not found", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"
    echo [ERROR] GenieAPIService.exe not found in service-llm directory
    pause
    exit /b 1
)
echo [OK] LLM service (Genie) files found

REM Complete
echo {"phase": "ready", "status": "completed", "timestamp": "%timestamp%"} > "%USER_DATA_DIR%\status.json"
echo.
echo [OK] All dependency checks completed
echo Status file: %USER_DATA_DIR%\status.json
echo.