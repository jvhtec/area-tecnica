#!/usr/bin/env bash
# Starts the local Supabase stack for the CI database jobs.
#
# supabase/setup-cli exports SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io, so
# `supabase start` pulls its images from GitHub's container registry. When
# ghcr.io is rate limiting ("toomanyrequests") the job dies before any
# migration or test runs, and logging in with the job's GITHUB_TOKEN does not
# lift that limit. The same images are published to AWS ECR Public, the CLI's
# own default registry, so a rate-limited start falls back to it.
#
# Later steps (`supabase db reset`, `supabase test db`) resolve image names
# from the same variable, so the registry that worked is exported through
# GITHUB_ENV for the rest of the job.
#
# Only a registry rate limit is retried. Any other failure (including a
# migration error, which `supabase start` applies) fails immediately so it is
# never masked.
set -euo pipefail

FALLBACK_REGISTRY="public.ecr.aws"

if [ -n "${GHCR_TOKEN:-}" ]; then
  if echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GITHUB_ACTOR:-github-actions}" --password-stdin >/dev/null 2>&1; then
    echo "Authenticated to ghcr.io for image pulls."
  else
    echo "::warning::docker login ghcr.io failed; pulling anonymously."
  fi
fi

use_registry() {
  export SUPABASE_INTERNAL_IMAGE_REGISTRY="$1"
  if [ -n "${GITHUB_ENV:-}" ]; then
    echo "SUPABASE_INTERNAL_IMAGE_REGISTRY=$1" >> "$GITHUB_ENV"
  fi
}

log_file="$(mktemp)"
max_attempts=4
for attempt in $(seq 1 "$max_attempts"); do
  echo "Starting Supabase (attempt ${attempt}/${max_attempts}, registry ${SUPABASE_INTERNAL_IMAGE_REGISTRY:-cli default})."
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
  supabase stop --no-backup >/dev/null 2>&1 || true
  if [ "${SUPABASE_INTERNAL_IMAGE_REGISTRY:-}" != "$FALLBACK_REGISTRY" ]; then
    echo "::warning::${SUPABASE_INTERNAL_IMAGE_REGISTRY:-the registry} rate limited the image pull; switching to ${FALLBACK_REGISTRY}."
    use_registry "$FALLBACK_REGISTRY"
    continue
  fi
  delay=$((attempt * ${SUPABASE_START_RETRY_BASE_DELAY:-30}))
  echo "::warning::${FALLBACK_REGISTRY} rate limited the image pull too; retrying in ${delay}s."
  sleep "$delay"
done

echo "::error::The image registries kept rate limiting the pull after ${max_attempts} attempts."
exit 1
