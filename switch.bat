@echo off
setlocal

if "%1"=="" (
    echo Available branches:
    echo   1. master
    echo   2. cloud-functions
    echo   3. backend-server
    set /p choice=Select branch number:
    
    if "%choice%"=="1" (
        set branch=master
    ) else if "%choice%"=="2" (
        set branch=cloud-functions
    ) else if "%choice%"=="3" (
        set branch=backend-server
    ) else (
        echo Invalid choice
        exit /b 1
    )
) else (
    set branch=%1
)

REM 检查是否有未提交的更改
git diff-index --quiet HEAD --
if %ERRORLEVEL% NEQ 0 (
    echo There are uncommitted changes.
    set /p commit=Would you like to commit them first? [Y/N]:
    if /i "%commit%"=="Y" (
        set /p msg=Enter commit message:
        git add .
        git commit -m "%msg%"
    ) else (
        set /p stash=Would you like to stash them? [Y/N]:
        if /i "%stash%"=="Y" (
            git stash
        ) else (
            echo Aborting switch to keep your changes.
            exit /b 1
        )
    )
)

git checkout %branch%
if %ERRORLEVEL% EQU 0 (
    echo Switched to %branch% branch
) else (
    echo Failed to switch branch
)

endlocal
