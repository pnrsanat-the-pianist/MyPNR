$envFile = "$PSScriptRoot\..\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^(?<key>[^=]+)=(?<value>.*)$') {
            [Environment]::SetEnvironmentVariable($Matches['key'], $Matches['value'])
        }
    }
}

$url = $env:VITE_SUPABASE_URL
$key = $env:VITE_SUPABASE_ANON_KEY

Write-Host "Testing connection to: $url"

# 1. Basic Reachability (HEAD request)
Write-Host "`n1. Testing Basic Reachability (HEAD)..."
try {
    $response = curl.exe -I "$url" --connect-timeout 10
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Reachability Check Passed"
        Write-Host $response
    } else {
        Write-Host "❌ Reachability Check Failed"
    }
} catch {
    Write-Host "❌ Error executing curl"
    Write-Host $_
}

# 2. REST API Check
Write-Host "`n2. Testing REST API (GET /rest/v1/)..."
# We expect 401 or 404 or 200, but NOT a timeout
try {
    # Using a nonexistent table to allow lightweight check. Supabase usually returns 404 for nonexistent table or 401 if key invalid.
    # We use curl.exe explicitly because PowerShell's curl alias is Invoke-WebRequest
    $cmd = "curl.exe -v '$url/rest/v1/' -H 'apikey: $key' -H 'Authorization: Bearer $key' --connect-timeout 10"
    Write-Host "Executing REST check..."
    Invoke-Expression $cmd
} catch {
    Write-Host "❌ REST API Check Failed"
    Write-Host $_
}
