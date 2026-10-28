$ErrorActionPreference = 'Stop'
try {
    $assistantNode = (Get-Command node -ErrorAction Stop).Source
    $assistantLauncher = Join-Path $PSScriptRoot 'launch.cjs'
    # Hide the Node console only. launch.cjs creates the interactive Electron GUI normally.
    Start-Process -FilePath $assistantNode -ArgumentList ('"{0}"' -f $assistantLauncher) -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
} catch {
    # Keep this script ASCII-compatible with Windows PowerShell 5.1.
    Write-Host "Could not start the assistant: $($_.Exception.Message)"
    exit 1
}
