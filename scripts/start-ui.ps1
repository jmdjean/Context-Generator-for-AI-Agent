#Requires -Version 5.1
<#
.SYNOPSIS
  Starts the AI Project Docs Web UI and opens the browser.
#>
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

$url = 'http://127.0.0.1:3847/'
Write-Host "Starting AI Project Docs Web UI at $url"
Start-Process $url | Out-Null
npm run ui
