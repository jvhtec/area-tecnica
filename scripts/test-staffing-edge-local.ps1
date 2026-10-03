param([Parameter(Mandatory=$true)][string]$CredentialsPath, [string[]]$TestFile = @(
  'tests/assignments/staffing-campaigns.edge.integration.test.ts',
  'tests/assignments/staffing-cancellation.local.integration.test.tsx',
  'tests/assignments/matrix-dialog.local.integration.test.tsx',
  'tests/assignments/runtime-fence.local.integration.test.ts'
))
$ErrorActionPreference = 'Stop'
$repoPath = Split-Path -Parent $PSScriptRoot
$taskEnvironmentNames = @('STAFFING_EDGE_TEST_URL','STAFFING_EDGE_TEST_ANON_KEY','STAFFING_EDGE_TEST_SERVICE_KEY')
$savedTaskEnvironment = @{}
foreach ($name in $taskEnvironmentNames) { $savedTaskEnvironment[$name] = [Environment]::GetEnvironmentVariable($name,'Process') }
try {
  # Read the private local CLI status output; never write keys into Git or logs.
  $credentialText = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $CredentialsPath))
  $localKeys = @{}
  foreach ($match in [regex]::Matches($credentialText,'(?m)^([A-Z_]+)="([^"]*)"')) { $localKeys[$match.Groups[1].Value] = $match.Groups[2].Value }
  $env:STAFFING_EDGE_TEST_URL = 'http://127.0.0.1:54441'
  $env:STAFFING_EDGE_TEST_ANON_KEY = $localKeys['ANON_KEY']
  $env:STAFFING_EDGE_TEST_SERVICE_KEY = $localKeys['SERVICE_ROLE_KEY']
  Push-Location -LiteralPath $repoPath
  try {
    foreach ($file in $TestFile) {
      & npx vitest run $file --maxWorkers=1
      if ($LASTEXITCODE -ne 0) { throw "Local staffing suite failed: $file; retain uncertain fixtures and stop subsequent suites" }
    }
  } finally { Pop-Location }
} finally {
  foreach ($name in $taskEnvironmentNames) { [Environment]::SetEnvironmentVariable($name,$savedTaskEnvironment[$name],'Process') }
}
