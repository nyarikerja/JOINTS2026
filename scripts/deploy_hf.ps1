param(
    [string]$HfToken = $env:HF_TOKEN,
    [string]$SpaceName = "helaloka",
    [switch]$Private = $false
)

if (-not $HfToken) {
    Write-Error "HF_TOKEN tidak ditemukan. Berikan parameter -HfToken 'hf_xxx' atau set environment variable HF_TOKEN."
    exit 1
}

$headers = @{
    Authorization = "Bearer $HfToken"
}

Write-Host "==> 1. Verifikasi akun Hugging Face..." -ForegroundColor Cyan
try {
    $whoami = Invoke-RestMethod -Uri "https://huggingface.co/api/whoami-v2" -Headers $headers
    $username = $whoami.name
    Write-Host "    Login sebagai: $username" -ForegroundColor Green
} catch {
    Write-Error "Gagal menghubungi Hugging Face API: $($_.Exception.Message)"
    exit 1
}

$repoId = "$username/$SpaceName"
Write-Host "==> 2. Memeriksa keberadaan Space: $repoId..." -ForegroundColor Cyan
$spaceExists = $false
try {
    $spaceInfo = Invoke-RestMethod -Uri "https://huggingface.co/api/spaces/$repoId" -Headers $headers
    $spaceExists = $true
    Write-Host "    Space $repoId sudah ada." -ForegroundColor Yellow
} catch {
    Write-Host "    Space $repoId belum ada. Membuat Space baru..." -ForegroundColor Cyan
    $createBody = @{
        type = "space"
        name = $SpaceName
        sdk = "docker"
        private = [bool]$Private
    } | ConvertTo-Json

    try {
        $createResp = Invoke-RestMethod -Uri "https://huggingface.co/api/repos/create" -Method Post -Headers (@{ Authorization = "Bearer $HfToken"; "Content-Type" = "application/json" }) -Body $createBody
        Write-Host "    Space $repoId berhasil dibuat!" -ForegroundColor Green
        $spaceExists = $true
    } catch {
        Write-Error "Gagal membuat Space: $($_.Exception.Message)"
        Write-Host "Pastikan HF Token memiliki role 'Write' (buat di https://huggingface.co/settings/tokens)." -ForegroundColor Red
        exit 1
    }
}

Write-Host "==> 3. Mengunggah Secrets dari backend/.env ke Hugging Face Space..." -ForegroundColor Cyan
$envPath = Join-Path $PSScriptRoot "..\backend\.env"
if (Test-Path $envPath) {
    $envLines = Get-Content $envPath
    $keysToUpload = @("GEMINI_API_KEY", "FEATHERLESS_API_KEY", "FEATHERLESS_BASE_URL", "FIRMS_MAP_KEY", "OPENAQ_API_KEY", "UDARASIAGA_OFFLINE")
    foreach ($line in $envLines) {
        $trimmed = $line.Trim()
        if ($trimmed -and -not $trimmed.StartsWith("#") -and $trimmed.Contains("=")) {
            $parts = $trimmed.Split("=", 2)
            $k = $parts[0].Trim()
            $v = $parts[1].Trim()
            if ($keysToUpload -contains $k -and $v) {
                Write-Host "    Menyimpan secret: $k..." -ForegroundColor Gray
                $secBody = @{ key = $k; value = $v } | ConvertTo-Json
                try {
                    $null = Invoke-RestMethod -Uri "https://huggingface.co/api/spaces/$repoId/secrets" -Method Post -Headers (@{ Authorization = "Bearer $HfToken"; "Content-Type" = "application/json" }) -Body $secBody
                } catch {
                    Write-Warning "    Gagal menyimpan secret ${k}: $($_.Exception.Message)"
                }
            }
        }
    }
    # Tambahkan ALLOWED_ORIGINS=* untuk memastikan CORS lancar di iframe HF Space
    $secBody = @{ key = "ALLOWED_ORIGINS"; value = "*" } | ConvertTo-Json
    try {
        $null = Invoke-RestMethod -Uri "https://huggingface.co/api/spaces/$repoId/secrets" -Method Post -Headers (@{ Authorization = "Bearer $HfToken"; "Content-Type" = "application/json" }) -Body $secBody
        Write-Host "    Menyimpan config: ALLOWED_ORIGINS=*..." -ForegroundColor Gray
    } catch {}
    Write-Host "    Semua secrets berhasil disiapkan!" -ForegroundColor Green
}

Write-Host "==> 4. Mengunggah kode ke git repository Space..." -ForegroundColor Cyan
$remoteUrl = "https://$username`:$HfToken@huggingface.co/spaces/$repoId"
$existingRemote = git remote | Where-Object { $_ -eq "hf" }
if ($existingRemote) {
    git remote set-url hf $remoteUrl
} else {
    git remote add hf $remoteUrl
}

$currentBranch = (git branch --show-current).Trim()
Write-Host "    Pushing branch $currentBranch ke $repoId main..." -ForegroundColor Cyan
git push hf "$currentBranch`:main" --force
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " Deploy Berhasil Dijalankan! " -ForegroundColor Green
    Write-Host " URL Space  : https://huggingface.co/spaces/$repoId" -ForegroundColor Cyan
    Write-Host " Direct App : https://$($username.ToLower())-$($SpaceName.ToLower()).hf.space" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Green
} else {
    Write-Error "Gagal melakukan git push ke Hugging Face Space."
}
