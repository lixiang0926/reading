@echo off
setlocal

REM 获取当前分支名
for /f "tokens=* USEBACKQ" %%F in (`git rev-parse --abbrev-ref HEAD`) do set branch=%%F

echo Current branch: %branch%
echo.
echo Files to be committed:
git status --short
echo.

REM 提示用户确认
set /p confirm=Continue with commit? [Y/N]:
if /i not "%confirm%"=="Y" (
    echo Commit cancelled.
    exit /b 1
)

git add .
git commit -m "%*"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Commit successful!
    
    REM 如果是主要分支之一，询问是否推送
    if "%branch%"=="cloud-functions" (
        set /p push=Push to cloud-functions branch? [Y/N]:
        if /i "%push%"=="Y" (
            git push origin cloud-functions
        )
    ) else if "%branch%"=="backend-server" (
        set /p push=Push to backend-server branch? [Y/N]:
        if /i "%push%"=="Y" (
            git push origin backend-server
        )
    ) else if "%branch%"=="master" (
        set /p push=Push to master branch? [Y/N]:
        if /i "%push%"=="Y" (
            git push origin master
        )
    )
) else (
    echo Commit failed!
    exit /b 1
)

endlocal
