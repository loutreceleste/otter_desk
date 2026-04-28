# OtterDesk — Sync WSL → Windows + Build .exe
# Double-cliquer pour lancer

$WSL_PATH  = "\\wsl$\Ubuntu\home\loutreceleste\Desktop\mes-projets-git\otter_desk"
$WIN_PATH  = "C:\Projects\otter_desk"

Write-Host ""
Write-Host "  OtterDesk — Build" -ForegroundColor Cyan
Write-Host "  ──────────────────────────────" -ForegroundColor DarkGray

# 1. Sync
Write-Host ""
Write-Host "  [1/3] Synchronisation WSL → Windows..." -ForegroundColor Yellow
robocopy $WSL_PATH $WIN_PATH /E /MIR /XD node_modules out release .git /XF "*.db" /NFL /NDL /NJH /NJS | Out-Null
Write-Host "        OK" -ForegroundColor Green

# 2. npm install (si package.json a changé)
Write-Host "  [2/3] Vérification des dépendances..." -ForegroundColor Yellow
Set-Location $WIN_PATH
npm install --silent
Write-Host "        OK" -ForegroundColor Green

# 3. Build
Write-Host "  [3/3] Build du .exe..." -ForegroundColor Yellow
npm run dist

# Résultat
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "  Build terminé !" -ForegroundColor Green
    Write-Host "  Le .exe est dans : $WIN_PATH\release\" -ForegroundColor Cyan
    Start-Process explorer.exe "$WIN_PATH\release"
} else {
    Write-Host ""
    Write-Host "  Erreur pendant le build." -ForegroundColor Red
}

Write-Host ""
Read-Host "  Appuie sur Entrée pour fermer"
