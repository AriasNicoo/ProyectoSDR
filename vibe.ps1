# vibe.ps1 — Auto-Push Script para SDR Tracker
# Ejecutar desde la raiz del repositorio: .\vibe.ps1

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$mensaje   = "Vibe Update: $timestamp"

Set-Location $PSScriptRoot

git add .
git commit -m $mensaje
git push origin main

Write-Host ""
Write-Host "Sync completado -> AriasNicoo/ProyectoSeguimientoTGP" -ForegroundColor Green
Write-Host "Commit: $mensaje" -ForegroundColor Cyan
