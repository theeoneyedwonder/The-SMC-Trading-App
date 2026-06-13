$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host ''
Write-Host '============================================' -ForegroundColor Cyan
Write-Host '  SMC Trading App - Backend Rebuild' -ForegroundColor Cyan
Write-Host '  (PyInstaller + Installer only, skips Vite)' -ForegroundColor Cyan
Write-Host '============================================' -ForegroundColor Cyan
Write-Host ''

# Find Python
$py = $null
if ($env:PYTHON -and (Test-Path $env:PYTHON)) { $py = $env:PYTHON }
if (-not $py) {
    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd) { $py = $cmd.Source }
}
if (-not $py) {
    $candidates = @(
        "$env:LOCALAPPDATA\Python\bin\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python314\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
    )
    foreach ($c in $candidates) { if (Test-Path $c) { $py = $c; break } }
}
if (-not $py) { Write-Error 'Python not found.'; exit 1 }

Write-Host "[Python] $py" -ForegroundColor Cyan
& $py --version
Write-Host ''

Write-Host '[1/2] Building Python backend...' -ForegroundColor Cyan
Push-Location backend
& $py -m pip install --quiet --upgrade pyinstaller
& $py -m PyInstaller backend.spec --clean --noconfirm
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error 'PyInstaller failed'; exit 1 }
Pop-Location
Write-Host '  Done -> backend\dist\smc-bot-backend\' -ForegroundColor Green

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
Write-Host '  Dev/testing  ->  release\The SMC Trading App 1.0.0-beta.1.exe' -ForegroundColor Yellow
Write-Host '                   (portable - just run it, no install needed)' -ForegroundColor DarkYellow
Write-Host ''
Write-Host '  Distribution ->  release\The SMC Trading App Setup 1.0.0-beta.1.exe' -ForegroundColor Cyan
Write-Host '                   (NSIS installer for end users)' -ForegroundColor DarkCyan
Write-Host '============================================' -ForegroundColor Green
Write-Host ''
