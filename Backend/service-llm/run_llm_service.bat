@REM ---------------------------------------------------------------------
@REM Copyright (c) 2024 Qualcomm Innovation Center, Inc. All rights reserved.
@REM SPDX-License-Identifier: BSD-3-Clause
@REM ---------------------------------------------------------------------

@echo off
cd /d "%~dp0"
set "currentDir=%CD%"

setlocal enabledelayedexpansion
echo Start Genie Service...

:: Start C++ Genie Service
    set "DEFAULT_MODEL_CONFIG=Phi-3.5-mini"

    if "%~1"=="" (
        set "MODEL_CONFIG=%DEFAULT_MODEL_CONFIG%"
    ) else (
        set "MODEL_CONFIG=%~1"
    )

    echo Starting C++ Genie Service...
    echo Please keep this window open. Genie Service is running
    powershell -Command "GenieAPIService.exe -c models\%MODEL_CONFIG%\config.json -l"
    echo Genie API Service Started.

echo Start C++ Genie Service Successfully!
pause