$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
& 'C:\Users\nbalasubramanian1\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --use-system-ca server.mjs
