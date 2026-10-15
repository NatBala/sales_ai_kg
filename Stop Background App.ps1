$ErrorActionPreference = 'Stop'
$atlasRecordFile = Join-Path $PSScriptRoot '..\..\work\atlas-server-process.json'
if (-not (Test-Path -LiteralPath $atlasRecordFile)) { Write-Output 'No background app process is recorded.'; exit }
$atlasRecord = Get-Content -LiteralPath $atlasRecordFile -Raw | ConvertFrom-Json
$atlasProcess = Get-Process -Id $atlasRecord.pid -ErrorAction SilentlyContinue
if ($null -eq $atlasProcess) { Write-Output 'The background app is already stopped.'; exit }
if ($atlasProcess.StartTime.ToUniversalTime().Ticks -ne ([datetime]$atlasRecord.startTime).ToUniversalTime().Ticks) { throw 'The process ID has been reused. No process was stopped.' }
Stop-Process -Id $atlasProcess.Id
Write-Output 'Advisor Atlas stopped. Neo4j was left running.'
