$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dist = Join-Path $root "dist"
$manifest = Get-Content -LiteralPath (Join-Path $root "manifest.json") -Raw | ConvertFrom-Json
$xpi = Join-Path $dist ("codex-for-zotero-" + $manifest.version + ".xpi")

if (-not (Test-Path -LiteralPath $dist)) {
    New-Item -ItemType Directory -Path $dist | Out-Null
}
if (Test-Path -LiteralPath $xpi) {
    Remove-Item -LiteralPath $xpi -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$files = @(
    Get-Item -LiteralPath (Join-Path $root "manifest.json"), (Join-Path $root "bootstrap.js")
    foreach ($folder in @("content", "icons", "locale")) {
        Get-ChildItem -LiteralPath (Join-Path $root $folder) -File -Recurse
    }
)
$archive = [System.IO.Compression.ZipFile]::Open(
    $xpi,
    [System.IO.Compression.ZipArchiveMode]::Create
)
try {
    foreach ($file in $files) {
        $relative = [System.IO.Path]::GetRelativePath($root, $file.FullName).Replace(
            [System.IO.Path]::DirectorySeparatorChar,
            [System.IO.Path]::AltDirectorySeparatorChar
        )
        if ($relative -match '(^|/)codex-zotero-[^/]*(/|$)') { continue }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive,
            $file.FullName,
            $relative,
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
}
finally {
    $archive.Dispose()
}
Write-Output $xpi
