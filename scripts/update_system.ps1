<#
.SYNOPSIS
  Starciti Fleet Desk - Production System Update & Migration Script (Windows PowerShell)
.DESCRIPTION
  Performs safe updates:
  1. Takes pre-update database backup into backups/pre_update_<timestamp>.sql
  2. Applies pending schema migrations from supabase/migrations/
  3. Rebuilds and restarts frontend service container
  4. Runs health check against /health endpoint and database
  5. Automatically triggers ROLLBACK if any step fails
.PARAMETER SkipBackup
  Skip pre-update backup step (not recommended for production).
.PARAMETER SkipBuild
  Skip rebuilding the frontend container.
.PARAMETER DryRun
  Simulate update without applying changes.
#>
param(
  [switch]$SkipBackup = $false,
  [switch]$SkipBuild = $false,
  [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RootDir = Split-Path -Parent $ScriptDir

Set-Location $RootDir

$nodeArgs = @("$RootDir\scripts\update_production.cjs")
if ($SkipBackup) { $nodeArgs += "--skip-backup" }
if ($SkipBuild) { $nodeArgs += "--skip-build" }
if ($DryRun) { $nodeArgs += "--dry-run" }

& node $nodeArgs
exit $LASTEXITCODE
