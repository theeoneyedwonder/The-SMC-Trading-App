$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host ''
Write-Host '============================================' -ForegroundColor Cyan
Write-Host '  SMC Trading App - Frontend Rebuild' -ForegroundColor Cyan
Write-Host '  (React + Installer only, skips PyInstaller)' -ForegroundColor Cyan
Write-Host '============================================' -ForegroundColor Cyan
Write-Host ''

Write-Host '[1/2] Building React frontend...' -ForegroundColor Cyan
Push-Location v2
if (-not (Test-Path 'node_modules')) {
    Write-Host '  Running npm install...' -ForegroundColor Yellow
    npm.cmd install
    if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error 'npm install failed'; exit 1 }
}
npm.cmd run build
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error 'Vite build failed'; exit 1 }
Pop-Location
Write-Host '  Done -> v2\dist\' -ForegroundColor Green

Write-Host ''
Write-Host '[2/2] Packaging installer...' -ForegroundColor Cyan
Push-Location v2
npx.cmd electron-builder --win
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error 'electron-builder failed'; exit 1 }
Pop-Location

Write-Host ''
Write-Host '============================================' -ForegroundColor Green
Write-Host '  DONE' -ForegroundColor Green
Write-Host ''
Write-Host '  Dev/testing  ->  release\The SMC Trading App 0.1.0-beta.1.exe' -ForegroundColor Yellow
Write-Host '                   (portable - just run it, no install needed)' -ForegroundColor DarkYellow
Write-Host ''
Write-Host '  Distribution ->  release\The SMC Trading App Setup 0.1.0-beta.1.exe' -ForegroundColor Cyan
Write-Host '                   (NSIS installer for end users)' -ForegroundColor DarkCyan
Write-Host '============================================' -ForegroundColor Green
Write-Host ''
