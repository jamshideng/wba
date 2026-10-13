# ---------------------------------------------------------------
#  WBA tizimini bitta buyruq bilan ishga tushiradi:   npm run ishga
#
#  Shu kungacha qo'lda qilingan hamma qadam, tartib bilan:
#    1. Docker Desktop ishlayaptimi - yo'q bo'lsa ko'taradi
#       (kompyuter uxlaganda yoki xotira yetmaganda o'zi to'xtaydi)
#    2. Lokal Supabase (baza + kirish) - yo'q bo'lsa ko'taradi
#    3. 3000-portni band qilib qolgan eski serverni o'chiradi
#       (Windows'da ota jarayon o'lsa ham "node" bolasi tirik qoladi)
#    4. Kod o'zgargan bo'lsa qayta yig'adi (next build)
#    5. Serverni ALOHIDA oynada ishga tushiradi - terminal yopilsa ham
#       yoki Claude Code xotira tejash uchun o'z jarayonlarini
#       tozalasa ham sayt ishlab turadi
#
#  Nega "next dev" emas: u har sahifani joyida yig'ib 1 GB+ xotira
#  oladi va kompyuterda xotira kam bo'lganda tizim uni o'ldiradi.
#  "next start" bir marta yig'ilgan versiyani ancha kam xotira bilan yuritadi.
#
#  Parametr:  -Qurish   kod o'zgarmagan bo'lsa ham qayta yig'ish
# ---------------------------------------------------------------
param([switch]$Qurish)

$ErrorActionPreference = 'Stop'
$loyiha = Split-Path -Parent $PSScriptRoot
Set-Location $loyiha

function Qadam($matn) { Write-Host "`n> $matn" -ForegroundColor Cyan }
function Ok($matn)    { Write-Host "  + $matn" -ForegroundColor Green }

# 1. Docker ------------------------------------------------------
Qadam 'Docker'
$docker = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
if (-not (Test-Path $docker)) { $docker = 'docker' }

# PowerShell 5.1 da 'Stop' rejimida native dasturning stderr'i (2>$null
# bilan ham) to'xtatuvchi xatoga aylanadi. Docker o'chiq bo'lsa aynan
# stderr'ga yozadi — skript Docker'ni ko'tarish o'rniga yiqilardi.
# Shuning uchun docker chaqiruvlari cmd orqali, stderr cmd ichida yutiladi.
function DockerTirikmi {
  cmd /c "`"$docker`" version --format {{.Server.Version}} >nul 2>nul"
  return ($LASTEXITCODE -eq 0)
}
if (-not (DockerTirikmi)) {
  Write-Host "  Docker to'xtagan - ko'tarilmoqda (1-3 daqiqa)..."
  cmd /c "`"$docker`" desktop start --timeout 300 >nul 2>nul"
  if (-not (DockerTirikmi)) { throw "Docker ko'tarilmadi. Docker Desktop oynasini ochib tekshiring." }
}
Ok 'Docker ishlayapti'

# 2. Supabase ----------------------------------------------------
Qadam 'Baza (Supabase)'
$ishlayapti = ((cmd /c "`"$docker`" ps --format {{.Names}} 2>nul") | Select-String 'supabase_db_wba').Count -gt 0
if (-not $ishlayapti) {
  npx --yes supabase@latest start -x realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor,mailpit | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Supabase ko'tarilmadi: npx supabase start ni qo'lda yuriting." }
}
Ok 'Baza ishlayapti (Studio: http://127.0.0.1:56323)'

# 3. Eski server -------------------------------------------------
Qadam '3000-port'
$eski = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique
foreach ($p in $eski) {
  Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
  Write-Host "  eski server to'xtatildi (PID $p)"
}
Ok "port bo'sh"

# 4. Yig'ish -----------------------------------------------------
Qadam "Yig'ish"
$buildId = Join-Path $loyiha '.next\BUILD_ID'
$kerak = $Qurish -or -not (Test-Path $buildId)
if (-not $kerak) {
  $vaqt = (Get-Item $buildId).LastWriteTime
  $yangi = Get-ChildItem -Path (Join-Path $loyiha 'src') -Recurse -File |
    Where-Object { $_.LastWriteTime -gt $vaqt } | Select-Object -First 1
  $kerak = [bool]$yangi -or ((Get-Item (Join-Path $loyiha '.env.local')).LastWriteTime -gt $vaqt)
}
if ($kerak) {
  $env:NODE_OPTIONS = '--max-old-space-size=3072'
  npx next build
  if ($LASTEXITCODE -ne 0) { throw "Yig'ishda xato - yuqoridagi xabarni o'qing." }
  Ok "yangi versiya yig'ildi"
} else {
  Ok "kod o'zgarmagan - oldingi yig'ish ishlatiladi"
}

# 5. Server ------------------------------------------------------
Qadam 'Server'
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'title WBA server & npx next start -p 3000' `
  -WorkingDirectory $loyiha -WindowStyle Minimized
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  try {
    $j = Invoke-WebRequest -Uri 'http://localhost:3000/kirish' -UseBasicParsing -TimeoutSec 3
    if ($j.StatusCode -eq 200) { break }
  } catch { }
}

# Internetga chiqadigan (default gateway'li) tarmoq — Docker/WSL virtual tarmog'i emas
$ip = (Get-NetIPConfiguration -ErrorAction SilentlyContinue |
  Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
  Select-Object -First 1).IPv4Address.IPAddress

Write-Host ''
Write-Host '  WBA ishlayapti' -ForegroundColor Green
Write-Host '    kompyuterda:  http://localhost:3000'
if ($ip) { Write-Host "    telefonda:    http://${ip}:3000   (bir Wi-Fi'da)" }
Write-Host "    to'xtatish:   npm run toxta"
