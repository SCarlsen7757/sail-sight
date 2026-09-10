$ErrorActionPreference = 'Stop'
$repoPath = Split-Path $PSScriptRoot -Parent
$testPassword = ((Get-Content -LiteralPath "$repoPath/.security-test.env" | Where-Object { $_.StartsWith('POSTGRES_PASSWORD=') }) -split '=', 2)[1]
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:LocalProfile = 'true'
$env:ASPNETCORE_URLS = 'http://127.0.0.1:18080'
$env:ConnectionStrings__Default = "Host=127.0.0.1;Port=15432;Database=sailsight_security;Username=sailsight;Password=$testPassword"
$env:Auth__Admin__Email = 'security-admin@test.local'
$env:Auth__Admin__Password = $testPassword
$env:Web__PublicBaseUrl = 'http://localhost:18081'
$env:TrustedProxies__0 = '127.0.0.1'
$env:SKIP_DB_MIGRATION = 'false'
$apiProcess = Start-Process dotnet -ArgumentList 'bin/Debug/net10.0/SailSight.Api.dll' -WorkingDirectory "$repoPath/SailSight.Api" -WindowStyle Hidden -PassThru -RedirectStandardOutput "$repoPath/api-runtime.txt" -RedirectStandardError "$repoPath/api-runtime-error.txt"
$apiProcess.Id | Set-Content -LiteralPath "$repoPath/.security-api.pid"
$env:NODE_ENV = 'production'
$env:API_BASE_URL = 'http://127.0.0.1:18080'
$env:APP_ORIGIN = 'http://localhost:18081'
$env:PORT = '18081'
$env:HOSTNAME = '127.0.0.1'
$webProcess = Start-Process node -ArgumentList 'entry-server.mjs' -WorkingDirectory "$repoPath/SailSight.Web" -WindowStyle Hidden -PassThru -RedirectStandardOutput "$repoPath/web-runtime.txt" -RedirectStandardError "$repoPath/web-runtime-error.txt"
$webProcess.Id | Set-Content -LiteralPath "$repoPath/.security-web.pid"
