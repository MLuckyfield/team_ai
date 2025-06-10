@echo off
set DOCTL_PATH=C:\Users\mattc\AppData\Local\Microsoft\WinGet\Packages\DigitalOcean.Doctl_Microsoft.Winget.Source_8wekyb3d8bbwe\doctl.exe

echo Testing doctl...
"%DOCTL_PATH%" version

echo.
echo To authenticate and deploy:
echo 1. Run: "%DOCTL_PATH%" auth init --access-token YOUR_TOKEN_HERE
echo 2. Run: "%DOCTL_PATH%" apps create --spec multi-app-platform.yaml
echo.
echo Replace YOUR_TOKEN_HERE with your actual Digital Ocean API token

pause 