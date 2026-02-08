param(
  [string]$BesuBin = "besu",
  [string]$GenDir = (Resolve-Path (Join-Path $PSScriptRoot "..\\besu-network-gen-4")).Path,
  [int]$BaseP2PPort = 30303,
  [switch]$SkipVal1,
  [switch]$JustVal1
)

$ErrorActionPreference = "Stop"

$genesis = Join-Path $GenDir "genesis.json"
$keysDir = Join-Path $GenDir "keys"
$staticNodes = Join-Path $PSScriptRoot "static-nodes.json"

if (-not (Test-Path $genesis)) {
  throw "Genesis file not found: $genesis"
}
if (-not (Test-Path $keysDir)) {
  throw "Keys directory not found: $keysDir"
}
if (-not (Test-Path $staticNodes)) {
  throw "static-nodes.json not found: $staticNodes"
}

$staticContent = Get-Content $staticNodes -Raw
if ($staticContent -notmatch "enode://") {
  throw "static-nodes.json does not contain an enode URL. Update it with validator #1 enode."
}

$keyDirs = Get-ChildItem $keysDir -Directory | Sort-Object Name
if ($keyDirs.Count -lt 4) {
  throw "Need at least 4 validator keys in $keysDir. Found $($keyDirs.Count)."
}

function Start-Validator {
  param(
    [int]$Index,
    [string]$KeyDir,
    [int]$P2PPort,
    [bool]$UseStaticNodes
  )

  $dataPath = Join-Path $GenDir ("data\\val{0}" -f $Index)
  $keyPath = Join-Path $KeyDir "key"

  $args = @(
    "--data-path=`"$dataPath`"",
    "--genesis-file=`"$genesis`"",
    "--node-private-key-file=`"$keyPath`"",
    "--p2p-port=$P2PPort",
    "--rpc-http-enabled=false",
    "--min-gas-price=0"
  )

  if ($UseStaticNodes) {
    $args += "--static-nodes-file=`"$staticNodes`""
  }

  Write-Host ("Starting validator #{0} on p2p port {1} (key {2})" -f $Index, $P2PPort, (Split-Path $KeyDir -Leaf))
  Start-Process -FilePath $BesuBin -ArgumentList ($args -join ' ')
}

if ($JustVal1) {
  Start-Validator -Index 1 -KeyDir $keyDirs[0].FullName -P2PPort $BaseP2PPort -UseStaticNodes:$false
  Write-Host "Started only validator #1 as requested."
  exit 0
}

if (-not $SkipVal1) {
  Start-Validator -Index 1 -KeyDir $keyDirs[0].FullName -P2PPort $BaseP2PPort -UseStaticNodes:$false
}
Start-Validator -Index 2 -KeyDir $keyDirs[1].FullName -P2PPort ($BaseP2PPort + 1) -UseStaticNodes:$true
Start-Validator -Index 3 -KeyDir $keyDirs[2].FullName -P2PPort ($BaseP2PPort + 2) -UseStaticNodes:$true
Start-Validator -Index 4 -KeyDir $keyDirs[3].FullName -P2PPort ($BaseP2PPort + 3) -UseStaticNodes:$true

Write-Host "Validators started. Make sure validator #1 enode is in static-nodes.json."
