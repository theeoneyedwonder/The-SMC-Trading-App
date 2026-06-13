$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host '============================================' -ForegroundColor Cyan
Write-Host '  The SMC Trading App - Beta Build' -ForegroundColor Cyan
Write-Host '============================================' -ForegroundColor Cyan
Write-Host ''

if ($env:PYTHON -and (Test-Path $env:PYTHON)) {
    $py = $env:PYTHON
} else {
    $candidates = @(
        "$env:LOCALAPPDATA\Python\bin\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python314\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
        "C:\Python314\python.exe",
        "C:\Python313\python.exe",
        "C:\Python312\python.exe",
        "C:\Python311\python.exe"
    )
    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd) { $py = $cmd.Source }
    if (-not $py) {
        foreach ($candidate in $candidates) {
            if (Test-Path $candidate) {
                $py = $candidate
                break
            }
        }
    }
}

if (-not $py) {
    Write-Error "Python not found. Set `$env:PYTHON = 'C:\path\to\python.exe' and run this again."
    exit 1
}

Write-Host "[0] Python: $py" -ForegroundColor Cyan
& $py --version

Write-Host ''
Write-Host '[1/3] Building Python backend...' -ForegroundColor Cyan
Push-Location backend
& $py -m pip install --quiet --upgrade pyinstaller
& $py -m PyInstaller backend.spec --clean --noconfirm
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Error 'PyInstaller failed'
    exit 1
}
Pop-Location
Write-Host '  Done -> backend\dist\smc-bot-backend\' -ForegroundColor Green

Write-Host ''
Write-Host '[2/3] Building React frontend...' -ForegroundColor Cyan
Push-Location v2
if (-not (Test-Path 'node_modules')) {
    npm.cmd install
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Write-Error 'npm install failed'
        exit 1
    }
}
npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Error 'Vite build failed'
    exit 1
}
Pop-Location
Write-Host '  Done -> v2\dist\' -ForegroundColor Green

Write-Host ''
Write-Host '[3/3] Packaging installer...' -ForegroundColor Cyan
Push-Location v2
npx.cmd electron-builder --win
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Error 'electron-builder failed'
    exit 1
}
Pop-Location

Write-Host ''
Write-Host '============================================' -ForegroundColor Green
Write-Host '  BUILD COMPLETE' -ForegroundColor Green
Write-Host ''
Write-Host '  Dev/testing  ->  release\The SMC Trading App 0.1.0-beta.1.exe' -ForegroundColor Yellow
Write-Host '                   (portable - just run it, no install needed)' -ForegroundColor DarkYellow
Write-Host ''
Write-Host '  Distribution ->  release\The SMC Trading App Setup 0.1.0-beta.1.exe' -ForegroundColor Cyan
Write-Host '                   (NSIS installer for end users)' -ForegroundColor DarkCyan
Write-Host '============================================' -ForegroundColor Green
