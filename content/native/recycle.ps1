$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
try {
    $requestText = [Console]::In.ReadToEnd()
    $request = $requestText | ConvertFrom-Json
    Add-Type -Path (Join-Path $PSScriptRoot 'Recycle.cs')
    if ($request.action -eq 'recycle') {
        [CodexZotero.Recycle]::Validate([string]$request.path, [string]$request.root)
        $token = [CodexZotero.Recycle]::Delete([string]$request.path)
        @{ok=$true; recycledPath=$token} | ConvertTo-Json -Compress
    } elseif ($request.action -eq 'permanent') {
        [CodexZotero.Recycle]::Validate([string]$request.path, [string]$request.root)
        [System.IO.File]::Delete([string]$request.path)
        @{ok=$true} | ConvertTo-Json -Compress
    } elseif ($request.action -eq 'restore') {
        [CodexZotero.Recycle]::Restore([string]$request.path, [string]$request.destination)
        @{ok=$true} | ConvertTo-Json -Compress
    } else { throw 'Unsupported operation' }
} catch {
    @{ok=$false; error=$_.Exception.Message} | ConvertTo-Json -Compress
    exit 1
}
