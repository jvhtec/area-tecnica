param(
  [Parameter(Mandatory=$true)][string]$CredentialsPath,
  [Parameter(Mandatory=$true)][string]$ManifestPath,
  [string[]]$TestFile = @(
    'tests/assignments/matrix-failure.disposable.integration.test.tsx',
    'tests/assignments/staffing-public-methods.disposable.integration.test.ts',
    'tests/assignments/staffing-completion.disposable.integration.test.ts'
  )
)
$ErrorActionPreference = 'Stop'
$repoPath = Split-Path -Parent $PSScriptRoot
$taskEnvironmentNames = @('STAFFING_EDGE_TEST_URL','STAFFING_EDGE_TEST_ANON_KEY','STAFFING_EDGE_TEST_SERVICE_KEY','STAFFING_DISPOSABLE_MANIFEST')
$savedTaskEnvironment = @{}
foreach ($name in $taskEnvironmentNames) { $savedTaskEnvironment[$name] = [Environment]::GetEnvironmentVariable($name,'Process') }
try {
  $credentialText = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $CredentialsPath))
  $localKeys = @{}
  foreach ($match in [regex]::Matches($credentialText,'(?m)^([A-Z_]+)="([^"]*)"')) { $localKeys[$match.Groups[1].Value] = $match.Groups[2].Value }
  $resolvedManifest = (Resolve-Path -LiteralPath $ManifestPath).Path
  $manifest = [System.IO.File]::ReadAllText($resolvedManifest) | ConvertFrom-Json
  # The test entry point validates identity, loopback ports, live ownership,
  # internal routing, fresh volumes and source parity before any fixture.
  $env:STAFFING_EDGE_TEST_URL = $manifest.url
  $env:STAFFING_EDGE_TEST_ANON_KEY = $localKeys['ANON_KEY']
  $env:STAFFING_EDGE_TEST_SERVICE_KEY = $localKeys['SERVICE_ROLE_KEY']
  $env:STAFFING_DISPOSABLE_MANIFEST = $resolvedManifest
  Push-Location -LiteralPath $repoPath
  try {
    foreach ($file in $TestFile) {
      & npx vitest run $file --maxWorkers=1
      if ($LASTEXITCODE -ne 0) { throw "Disposable staffing suite failed: $file; retain uncertain fixtures and stop subsequent suites" }
    }
  } finally { Pop-Location }
} finally {
  foreach ($name in $taskEnvironmentNames) { [Environment]::SetEnvironmentVariable($name,$savedTaskEnvironment[$name],'Process') }
}
