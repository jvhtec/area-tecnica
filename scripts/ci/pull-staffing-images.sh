#!/usr/bin/env bash
# Registry acquisition only: never retry a provisioning mutation or test.
set -euo pipefail
if [ -n "${GHCR_TOKEN:-}" ]; then
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "${GITHUB_ACTOR:-github-actions}" --password-stdin >/dev/null 2>&1
fi
images=(supabase/postgres:15.8.1.022 supabase/gotrue:v2.186.0 supabase/postgrest:v14.13 supabase/edge-runtime:v1.76.2)
for image in "${images[@]}"; do
  acquired=false
  for attempt in 1 2 3; do
    if docker pull "public.ecr.aws/$image"; then
      acquired=true
      break
    fi
    if docker pull "ghcr.io/$image"; then
      docker tag "ghcr.io/$image" "public.ecr.aws/$image"
      acquired=true
      break
    fi
    if [ "$attempt" -lt 3 ]; then sleep "$((attempt * 5))"; fi
  done
  if [ "$acquired" != true ]; then
    echo "::error::Unable to acquire reviewed image $image from either registry."
    exit 1
  fi
done
docker pull python:3.13-slim
