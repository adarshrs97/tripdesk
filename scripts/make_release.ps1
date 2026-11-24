<#
.SYNOPSIS
  Starciti Fleet Desk - Production Release Packaging Script
.DESCRIPTION
  Builds the production web assets and tags the production Nginx Docker image.
  Verifies build artifacts, outputs image metadata, and records release info.
.PARAMETER Version
  Optional custom version string. If omitted, read from package.json.
.PARAMETER SkipDocker
  Skip building the Docker image (compile frontend only).
#>
param(
  [string]$Version = "",
  [switch]$SkipDocker = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RootDir = Split-Path -Parent $ScriptDir

Set-Location $RootDir

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " STARCITI FLEET DESK: PRODUCTION RELEASE BUILD" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# 1. Determine Version
if ([string]::IsNullOrWhiteSpace($Version)) {
  $packageJson = Get-Content "$RootDir\package.json" -Raw | ConvertFrom-Json
  $Version = $packageJson.version
}

Write-Host "[1/4] Target Release Version: v$Version" -ForegroundColor Yellow

# 2. Run clean frontend build (tsc & vite build)
Write-Host "[2/4] Compiling frontend (npm run build)..." -ForegroundColor Yellow
& npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "[ERROR] Frontend compilation failed with code $LASTEXITCODE" -ForegroundColor Red
  exit $LASTEXITCODE
}

# Verify dist/index.html
if (-not (Test-Path "$RootDir\dist\index.html")) {
  Write-Host "[ERROR] dist/index.html not found after build!" -ForegroundColor Red
  exit 1
}

$distSize = (Get-ChildItem -Recurse "$RootDir\dist" | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "      Frontend build succeeded. dist/ size: $('{0:N2}' -f $distSize) MB" -ForegroundColor Green

# 3. Create Release Manifest
$manifest = @{
  version = $Version
  buildDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
  app = "Starciti Fleet Desk"
  dockerImage = "starciti-fleet-frontend:v$Version"
  dockerLatest = "starciti-fleet-frontend:latest"
}
$manifestJson = $manifest | ConvertTo-Json -Depth 4
Set-Content -Path "$RootDir\dist\release-manifest.json" -Value $manifestJson
Write-Host "      Release manifest written to dist/release-manifest.json" -ForegroundColor Gray

# 4. Build Docker Production Container
if ($SkipDocker) {
  Write-Host "[3/4] Skipping Docker image build as requested (-SkipDocker)." -ForegroundColor Gray
} else {
  Write-Host "[3/4] Building production Docker container..." -ForegroundColor Yellow
  Write-Host "      Tags: starciti-fleet-frontend:v$Version, starciti-fleet-frontend:latest" -ForegroundColor Gray

  & docker build -t "starciti-fleet-frontend:v$Version" -t "starciti-fleet-frontend:latest" -f "$RootDir\docker\nginx\Dockerfile" "$RootDir"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Docker build failed with code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
  }

  Write-Host "      Docker image built successfully." -ForegroundColor Green
}

# 5. Summary & Verification
Write-Host "[4/4] Release Verification Summary" -ForegroundColor Yellow
if (-not $SkipDocker) {
  $imageInfo = docker images starciti-fleet-frontend:v$Version --format "{{.Repository}}:{{.Tag}} (Size: {{.Size}}, ID: {{.ID}})"
  Write-Host "      $imageInfo" -ForegroundColor Cyan
}

Write-Host "==================================================================" -ForegroundColor Green
Write-Host " RELEASE v$Version PACKAGED SUCCESSFULLY!" -ForegroundColor Green
Write-Host " Ready for deployment via: docker compose up -d frontend" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
exit 0
