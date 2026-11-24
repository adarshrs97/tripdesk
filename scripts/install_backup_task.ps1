# ==============================================================================
# scripts/install_backup_task.ps1
#
# Registers a Windows Scheduled Task for Starciti Fleet Desk:
# - Task Name: Starciti_Nightly_Production_Backup
# - Frequency: Daily at 02:00 AM (Deep Night)
# - Action: Runs node scripts/backup_production.cjs
# - Settings: Wakes computer if sleeping, restarts on failure
# ==============================================================================

$taskName = "Starciti_Nightly_Production_Backup"
$workingDir = "E:\projects\starcity"
$nodePath = (Get-Command node).Source
$scriptPath = Join-Path $workingDir "scripts\backup_production.cjs"

Write-Host "=================================================================="
Write-Host "STARCITI FLEET DESK: WINDOWS SCHEDULED TASK INSTALLER"
Write-Host "=================================================================="

if (-not (Test-Path $scriptPath)) {
    Write-Error "Could not find backup script at: $scriptPath"
    exit 1
}

Write-Host "Configuring task: $taskName"
Write-Host "Action: $nodePath $scriptPath"

# Action
$action = New-ScheduledTaskAction -Execute $nodePath -Argument "scripts\backup_production.cjs" -WorkingDirectory $workingDir

# Trigger: 02:00 AM every night
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM

# Settings: Wake to run, restart on error
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -WakeToRun -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 15)

# Register or update task
try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Nightly automated PostgreSQL dump and AES-256 encrypted backup for Starciti Fleet Desk" -Force
    Write-Host "[PASS] Scheduled Task successfully registered in Windows Task Scheduler!" -ForegroundColor Green
    Write-Host "Next run scheduled for: $(Get-Date -Hour 2 -Minute 0 -Second 0).AddDays(1)"
} catch {
    Write-Warning "Could not register task automatically. If running without Administrator privileges, run PowerShell as Administrator and retry, or create manually in taskschd.msc."
}

Write-Host "=================================================================="
