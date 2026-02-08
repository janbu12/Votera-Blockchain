param(
  [string]$Network = "besuLocal",
  [switch]$SkipContracts,
  [switch]$SkipBuild,
  [switch]$DevMode,
  [switch]$SetupOnly,
  [switch]$JustDeployContracts
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

function Invoke-Step {
  param(
    [string]$Name,
    [string]$Path,
    [string]$Command
  )
  Write-Host "==> $Name" -ForegroundColor Cyan
  Push-Location $Path
  try {
    Invoke-Expression $Command
  }
  finally {
    Pop-Location
  }
}

function Start-ServiceWindow {
  param(
    [string]$Title,
    [string]$Path,
    [string]$Command
  )
  $psCommand = "Set-Location -Path '$Path'; $Command"
  Start-Process powershell -ArgumentList @("-NoExit", "-Command", $psCommand) -WindowStyle Normal | Out-Null
  Write-Host "Started $Title" -ForegroundColor Green
}

$contractsDir = Join-Path $RootDir "contracts"
$backendDir = Join-Path $RootDir "backend"
$campusDir = Join-Path $RootDir "campus-service"
$faceDir = Join-Path $RootDir "face-service"
$frontendDir = Join-Path $RootDir "frontend"

if ($JustDeployContracts) {
  Invoke-Step -Name "Contracts: npm install" -Path $contractsDir -Command "npm install"
  Invoke-Step -Name "Contracts: compile" -Path $contractsDir -Command "npx hardhat compile"
  Invoke-Step -Name "Contracts: deploy multi election ($Network)" -Path $contractsDir -Command "npx hardhat run scripts/deploy-multi.ts --network
  $Network"
  Write-Host "Deployed contracts only as requested." -ForegroundColor Green
  exit 0
}

if (-not $SkipContracts) {
  Invoke-Step -Name "Contracts: npm install" -Path $contractsDir -Command "npm install"
  Invoke-Step -Name "Contracts: compile" -Path $contractsDir -Command "npx hardhat compile"
  Invoke-Step -Name "Contracts: deploy multi election ($Network)" -Path $contractsDir -Command "npx hardhat run scripts/deploy-multi.ts --network $Network"
} else {
  Write-Host "Skipping contracts setup." -ForegroundColor Yellow
}

Invoke-Step -Name "Backend: npm install" -Path $backendDir -Command "npm install"
if (-not $SkipBuild) {
  Invoke-Step -Name "Backend: build" -Path $backendDir -Command "npm run build"
} else {
  Write-Host "Skipping backend build." -ForegroundColor Yellow
}

Invoke-Step -Name "Campus Service: npm install" -Path $campusDir -Command "npm install"

$faceVenvPython = Join-Path $faceDir ".venv\Scripts\python.exe"
if (Test-Path $faceVenvPython) {
  Invoke-Step -Name "Face Service: install requirements (.venv)" -Path $faceDir -Command ".\.venv\Scripts\python.exe -m pip install -r requirements.txt"
} else {
  Write-Host "Face Service: .venv not found, skipping pip install. Use system python at runtime." -ForegroundColor Yellow
}

Invoke-Step -Name "Frontend: npm install" -Path $frontendDir -Command "npm install"
if (-not $SkipBuild) {
  Invoke-Step -Name "Frontend: build" -Path $frontendDir -Command "npm run build"
} else {
  Write-Host "Skipping frontend build." -ForegroundColor Yellow
}

if ($SetupOnly) {
  Write-Host "Setup completed. No services were started because -SetupOnly is set." -ForegroundColor Green
  exit 0
}

$backendStart = if ($DevMode) { "npm run dev" } else { "npm run start" }
$frontendStart = if ($DevMode) { "npm run dev" } else { "npm run start" }
$campusStart = "npm run dev"
$faceStart = if (Test-Path $faceVenvPython) { ".\.venv\Scripts\python.exe src/run.py" } else { "python src/run.py" }

Start-ServiceWindow -Title "Campus Service" -Path $campusDir -Command $campusStart
Start-ServiceWindow -Title "Face Service" -Path $faceDir -Command $faceStart
Start-ServiceWindow -Title "Backend" -Path $backendDir -Command $backendStart
Start-ServiceWindow -Title "Frontend" -Path $frontendDir -Command $frontendStart

Write-Host ""
Write-Host "All services launched in separate PowerShell windows." -ForegroundColor Green
Write-Host "Campus:   http://localhost:4100/health"
Write-Host "Face:     http://localhost:4200/health"
Write-Host "Backend:  http://localhost:4000/health"
Write-Host "Frontend: http://localhost:3000"
