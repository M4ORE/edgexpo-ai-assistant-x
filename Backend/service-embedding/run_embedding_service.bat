@echo off
REM Set UTF-8 encoding for Windows console
chcp 65001 >nul 2>&1

REM Set Python encoding environment variables
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
set PYTHONLEGACYWINDOWSFSENCODING=0

REM Activate virtual environment if it exists
if exist "venv-embedding\Scripts\activate.bat" (
    call venv-embedding\Scripts\activate.bat
)

REM Run the embedding service with proper encoding
echo Starting Embedding Service with UTF-8 encoding...
python -X utf8 app.py %*