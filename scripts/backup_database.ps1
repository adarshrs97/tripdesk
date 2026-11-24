<#
==============================================================================
Starciti Fleet & Billing Desk - Automated Daily Database Backup (PowerShell)
Target: PostgreSQL / Supabase
==============================================================================
#>

param(
    [string]$BackupDir = ".\backups",
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $BackupDir "starciti_backup_$timestamp.sql"

Write-Host "[$((Get-Date).ToString())] Starting Starciti database backup..."

if ($env:DATABASE_URL) {
    & pg_dump $env:DATABASE_URL --clean --if-exists --no-owner --no-privileges -f $backupFile
} elseif ($env:SUPABASE_DB_URL) {
    & pg_dump $env:SUPABASE_DB_URL --clean --if-exists --no-owner --no-privileges -f $backupFile
} else {
    # Local Docker container fallback
    docker exec -i starciti_postgres pg_dump -U postgres -d starciti --clean --if-exists --no-owner --no-privileges > $backupFile
}

$fileInfo = Get-Item $backupFile
Write-Host "[$((Get-Date).ToString())] Backup completed successfully: $($fileInfo.FullName) ($([math]::Round($fileInfo.Length / 1KB, 2)) KB)"

# Prune old backup files
$cutoffDate = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter "starciti_backup_*.sql" | Where-Object { $_.CreationTime -lt $cutoffDate } | Remove-Item -Force
Write-Host "[$((Get-Date).ToString())] Pruned backups older than $RetentionDays days."
