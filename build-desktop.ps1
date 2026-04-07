#Requires -Version 5.1
<#
.SYNOPSIS
    Builds the BrewBar POS desktop installer (Electron + .NET API + Angular).
.DESCRIPTION
    1. Publishes the .NET API as self-contained win-x64
    2. Builds Angular admin and POS apps
    3. Copies Angular output into API wwwroot
    4. Packages Electron app
    5. Builds WiX MSI installer
#>
param(
    [switch]$SkipMsi,
    [switch]$SkipElectron,
    [string]$Version
)

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot

# Resolve version: explicit param > package.json > fallback
if (-not $Version) {
    $pkg = Get-Content "$Root\package.json" -Raw | ConvertFrom-Json
    $Version = $pkg.version
}
# MSI requires 4-part version (major.minor.patch.build)
$MsiVersion = if ($Version -match '^\d+\.\d+\.\d+$') { "$Version.0" } else { $Version }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BrewBar POS Desktop Build  v$Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Clean build output
if (Test-Path "$Root\build") { Remove-Item "$Root\build" -Recurse -Force }
New-Item -ItemType Directory -Path "$Root\build" -Force | Out-Null

# ── Step 1: Publish .NET API ──────────────────────────────────────────────────
Write-Host "[1/5] Publishing .NET API (self-contained win-x64)..." -ForegroundColor Yellow
dotnet publish "$Root\server\src\BrewBar.API\BrewBar.API.csproj" `
    -p:PublishProfile=Desktop `
    -c Release
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed" }
Write-Host "  API published to build/api/" -ForegroundColor Green

# ── Step 2: Build Angular apps ────────────────────────────────────────────────
Write-Host "[2/5] Building Angular apps..." -ForegroundColor Yellow
Push-Location "$Root\client"
try {
    npm ci --silent
    npx ng build pos --configuration production
    if ($LASTEXITCODE -ne 0) { throw "ng build pos failed" }
    npx ng build admin --configuration production --base-href /admin/
    if ($LASTEXITCODE -ne 0) { throw "ng build admin failed" }
}
finally { Pop-Location }
Write-Host "  Angular apps built" -ForegroundColor Green

# ── Step 3: Copy Angular into API wwwroot ─────────────────────────────────────
Write-Host "[3/5] Copying Angular output to API wwwroot..." -ForegroundColor Yellow
$wwwroot = "$Root\build\api\wwwroot"
New-Item -ItemType Directory -Path "$wwwroot\admin" -Force | Out-Null

Copy-Item -Path "$Root\client\dist\pos\browser\*" -Destination $wwwroot -Recurse -Force
Copy-Item -Path "$Root\client\dist\admin\browser\*" -Destination "$wwwroot\admin" -Recurse -Force
Write-Host "  POS -> wwwroot/, Admin -> wwwroot/admin/" -ForegroundColor Green

# ── Step 4: Package Electron ──────────────────────────────────────────────────
if (-not $SkipElectron) {
    Write-Host "[4/5] Packaging Electron app..." -ForegroundColor Yellow
    Push-Location "$Root\desktop"
    try {
        npm ci --silent
        npx electron-builder --win --config electron-builder.yml
        if ($LASTEXITCODE -ne 0) { throw "electron-builder failed" }
    }
    finally { Pop-Location }
    Write-Host "  Electron packaged to build/electron/" -ForegroundColor Green
} else {
    Write-Host "[4/5] Skipping Electron packaging (--SkipElectron)" -ForegroundColor DarkGray
}

# ── Step 5: Build WiX MSI ────────────────────────────────────────────────────
if (-not $SkipMsi) {
    Write-Host "[5/5] Building WiX MSI (v$MsiVersion)..." -ForegroundColor Yellow
    dotnet build "$Root\installer\BrewBar.Installer.wixproj" -c Release -p:ProductVersion=$MsiVersion
    if ($LASTEXITCODE -ne 0) { throw "WiX build failed" }
    Write-Host "  MSI built to build/installer/" -ForegroundColor Green
} else {
    Write-Host "[5/5] Skipping MSI build (--SkipMsi)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Build complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

if (-not $SkipElectron) {
    Write-Host "  Electron app: build\electron\win-unpacked\"
}
if (-not $SkipMsi) {
    Write-Host "  MSI installer: build\installer\"
}
Write-Host ""
