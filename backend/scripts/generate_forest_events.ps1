$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $scriptDir
$jsonPath = Join-Path $backendDir "data\layers\forests_indonesia.json"
$eventsDir = Join-Path $backendDir "data\events"

$forests = Get-Content -Raw -Path $jsonPath -Encoding UTF8 | ConvertFrom-Json

$rnd = New-Object System.Random(20261006)

foreach ($f in $forests) {
    $evDir = Join-Path $eventsDir $f.id
    if (-not (Test-Path $evDir)) {
        New-Item -ItemType Directory -Path $evDir -Force | Out-Null
    }

    # 1. meta.json
    $meta = @{
        event_id = $f.id
        hazard = "fire"
        name = $f.name
        forest_type = $f.forest_type
        province = $f.province
        region = $f.region
        start_utc = "2026-10-06T00:00:00Z"
        duration_h = 24.0
        coordinates = @{
            latitude = [double]$f.lat
            longitude = [double]$f.lon
            center_lat = [double]$f.lat
            center_lon = [double]$f.lon
        }
        bbox = @(
            [Math]::Round($f.lon - 0.7, 3),
            [Math]::Round($f.lat - 0.7, 3),
            [Math]::Round($f.lon + 0.7, 3),
            [Math]::Round($f.lat + 0.7, 3)
        )
        source = "NASA FIRMS NRT (Satelit VIIRS SNPP & NOAA-20)"
        description = $f.description
        risk_level = $f.risk_level
        area_ha = $f.area_ha
    }

    $metaJson = $meta | ConvertTo-Json -Depth 5
    Set-Content -Path (Join-Path $evDir "meta.json") -Value $metaJson -Encoding UTF8

    # 2. hotspots.csv
    $csvLines = @("latitude,longitude,frp,confidence,acq_date,acq_time")
    $nHs = [int]$f.n_hotspots
    for ($i = 0; $i -lt $nHs; $i++) {
        $clusterLatOff = @(-0.06, 0.0, 0.06)[$rnd.Next(0, 3)]
        $clusterLonOff = @(-0.06, 0.0, 0.06)[$rnd.Next(0, 3)]
        $lat = [Math]::Round($f.lat + $clusterLatOff + (($rnd.NextDouble() - 0.5) * 0.07), 4)
        $lon = [Math]::Round($f.lon + $clusterLonOff + (($rnd.NextDouble() - 0.5) * 0.07), 4)
        $frp = [Math]::Round(30.0 + ($rnd.NextDouble() * 190.0), 1)
        $conf = @("high", "nominal", "high")[$rnd.Next(0, 3)]
        $csvLines += "$lat,$lon,$frp,$conf,2026-10-06,0430"
    }

    Set-Content -Path (Join-Path $evDir "hotspots.csv") -Value ($csvLines -join "`n") -Encoding UTF8
    Write-Host "Created event: $($f.id) with $nHs hotspots"
}

Write-Host "Successfully generated all 36 forest conservation events!"
