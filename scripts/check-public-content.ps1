$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$tracked = & git -C $repoRoot ls-files
if ($LASTEXITCODE -ne 0) {
    throw "Unable to read tracked Git files."
}

$denyFile = Join-Path $repoRoot ".public-deny-patterns.local"
$patterns = @(
    '[A-Za-z]:\\',
    'BEGIN (RSA|OPENSSH|EC) PRIVATE KEY',
    '(?i)(api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*[^\s<>{}]+'
)

if (Test-Path -LiteralPath $denyFile) {
    $patterns += Get-Content -LiteralPath $denyFile |
        Where-Object { $_.Trim() -and -not $_.Trim().StartsWith('#') }
}

$violations = @()
foreach ($relativePath in $tracked) {
    $path = Join-Path $repoRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { continue }
    $content = Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue
    if ($null -eq $content) { continue }
    foreach ($pattern in $patterns) {
        if ($content -match $pattern) {
            $violations += "$relativePath matches $pattern"
        }
    }
}

if ($violations.Count -gt 0) {
    $violations | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Output "Public content check passed for $($tracked.Count) tracked files."
