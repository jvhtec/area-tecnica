#!/usr/bin/env bash
# Starts the local Supabase stack for the CI database jobs.
#
# supabase/setup-cli exports SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io, so
# `supabase start` pulls its images from GitHub's container registry. Anonymous
# pulls from shared runners share one quota and fail with "toomanyrequests"
# when it is exhausted, before any migration or test runs. The CLI pulls with
# the credentials in the Docker config file, so logging in with the job's
# GITHUB_TOKEN (packages: read) makes the pulls authenticated.
#
# A start that still fails on the registry quota is retried with backoff. Any
# other failure (including a migration error, which `supabase start` applies)
# fails immediately so it is never masked.
set -euo pipefail

if [ -n "${GHCR_TOKEN:-}" ]; then
  if echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GITHUB_ACTOR:-github-actions}" --password-stdin >/dev/null 2>&1; then
    echo "Authenticated to ghcr.io for image pulls."
  else
    echo "::warning::docker login ghcr.io failed; pulling anonymously."
  fi
fi

log_file="$(mktemp)"
max_attempts=4
for attempt in $(seq 1 "$max_attempts"); do
  if supabase start -x "$SUPABASE_START_EXCLUDES" 2>&1 | tee "$log_file"; then
    exit 0
  fi
  if ! grep -q "toomanyrequests" "$log_file"; then
    echo "::error::supabase start failed for a reason other than registry rate limiting."
    exit 1
  fi
  if [ "$attempt" -eq "$max_attempts" ]; then
    break
  fi
  delay=$((attempt * ${SUPABASE_START_RETRY_BASE_DELAY:-30}))
  echo "::warning::ghcr.io rate limited the image pull (attempt ${attempt}/${max_attempts}); retrying in ${delay}s."
  supabase stop --no-backup >/dev/null 2>&1 || true
  sleep "$delay"
done

echo "::error::ghcr.io kept rate limiting the image pull after ${max_attempts} attempts."
exit 1
