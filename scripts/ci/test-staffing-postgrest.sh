#!/usr/bin/env bash
# Real transaction/concurrent-click tests on the disposable CI Supabase DB.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != 'true' ]]; then
  echo 'This script mutates the ephemeral GitHub Actions database; refusing a local stack.' >&2
  exit 1
fi
container=supabase_db_syldobdcdsgfgjtbuwxm
rest=phase2a-staffing-test-rest
cleanup() { docker rm -f "$rest" >/dev/null 2>&1 || true; }
trap cleanup EXIT
if docker container inspect "$rest" >/dev/null 2>&1; then
  echo 'Test REST container already exists; refusing to replace it.' >&2
  trap - EXIT
  exit 1
fi
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/assignments/fixtures/staffing-postgrest.sql
docker run --detach --name "$rest" --network supabase_network_syldobdcdsgfgjtbuwxm \
  -p 127.0.0.1:18089:3000 \
  -e PGRST_DB_URI="postgres://authenticator:postgres@$container:5432/postgres" \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=service_role \
  -e PGRST_SERVER_PORT=3000 public.ecr.aws/supabase/postgrest:v14.13
for attempt in {1..30}; do
  if curl --fail --silent http://127.0.0.1:18089/ >/dev/null; then break; fi
  sleep 1
done
curl --fail --silent http://127.0.0.1:18089/ >/dev/null
STAFFING_TEST_REST_URL=http://127.0.0.1:18089 STAFFING_TEST_DB_CONTAINER="$container" \
  npx vitest run tests/assignments/staffing-postgrest.integration.test.ts tests/assignments/staffing-removal-locks.integration.test.ts \
  tests/assignments/direct-assignment-commands.integration.test.ts \
  tests/assignments/flex-reconciliation.integration.test.ts --maxWorkers=1
