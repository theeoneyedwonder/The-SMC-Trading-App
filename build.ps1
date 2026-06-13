# ─────────────────────────────────────────────────────────────
#  The SMC Trading App – Full Build Script  (v2)
#  Run:  .\build.ps1
#  Out:  release\The SMC Trading App Setup 2.0.0.exe
# ─────────────────────────────────────────────────────────────
$ErrorActionPreference = 'Stop'

# ── Find Python ───────────────────────────────────────────────
if ($env:PYTHON -and (Test-Path $env:PYTHON)) {
    $py = $env:PYTHON
} else {
    $candidates = @(
        "$env:LOCALAPPDATA\Python\bin\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
        "C:\Python313\python.exe","C:\Python312\python.exe","C:\Python311\python.exe"
    )
    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd) { $py = $cmd.Source }
    if (-not $py) { foreach ($c in $candidates) { if (Test-Path $c) { $py = $c; break } } }
}
if (-not $py) { Write-Error "Python not found. Set `$env:PYTHON = 'C:\path\to\python.exe'"; exit 1 }
Write-Host "[0] Python: $py" -ForegroundColor Cyan
& $py --version

# ── Step 1: PyInstaller ───────────────────────────────────────
Write-Host "`n[1/3] Building Python backend..." -ForegroundColor Cyan
Push-Location backend
& $py -m pip install --quiet --upgrade pyinstaller
& $py -m PyInstaller backend.spec --clean --noconfirm
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "PyInstaller failed"; exit 1 }
Pop-Location
Write-Host "  Done -> backend\dist\smc-bot-backend\" -ForegroundColor Green

# ── Step 2: Vite build ────────────────────────────────────────
Write-Host "`n[2/3] Building React frontend (v2)..." -ForegroundColor Cyan
Push-Location v2
if (-not (Test-Path "node_modules")) { npm install; if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "npm install failed"; exit 1 } }
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "Vite build failed"; exit 1 }
Pop-Location
Write-Host "  Done -> v2\dist\" -ForegroundColor Green

# ── Step 3: electron-builder ──────────────────────────────────
Write-Host "`n[3/3] Packaging with electron-builder (NSIS)..." -ForegroundColor Cyan
Push-Location v2
npx electron-builder --win
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "electron-builder failed"; exit 1 }
Pop-Location

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "  BUILD COMPLETE" -ForegroundColor Green
Write-Host "  release\The SMC Trading App Setup 1.0.0-beta.1.exe" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
