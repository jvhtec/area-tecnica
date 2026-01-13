#!/usr/bin/env bash
set -euo pipefail

blocked_files=()

while IFS= read -r -d '' file; do
  case "$file" in
    .env.example) ;;
    .env|.env.*|*/.env|*/.env.*) blocked_files+=("$file") ;;
    .envrc|*/.envrc|.envrc.*|*/.envrc.*) blocked_files+=("$file") ;;
  esac
done < <(git diff --cached --name-only -z)

if ((${#blocked_files[@]} > 0)); then
  {
    echo "ERROR: dotenv/direnv files are staged (these often contain secrets):"
    printf ' - %s\n' "${blocked_files[@]}"
    echo
    echo "Keep secrets in untracked files (e.g. .env.local / .env.<mode>.local) and unstage these files:"
    echo "  git restore --staged -- <file>"
  } >&2
  exit 1
fi

if command -v rg >/dev/null 2>&1; then
  secret_hits="$(
    git diff --cached -U0 \
      | rg -n --color=never \
          -e '^\\+.*sb_publishable_[A-Za-z0-9_-]{16,}' \
          -e '^\\+.*sb_secret_[A-Za-z0-9_-]{16,}' \
          -e '^\\+.*eyJhbGci[A-Za-z0-9_-]*\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+' \
          -e '^\\+.*-----BEGIN (RSA |EC |)?PRIVATE KEY-----' \
      || true
  )"
else
  secret_hits="$(
    git diff --cached -U0 \
      | grep -nE \
          '^\+.*(sb_publishable_|sb_secret_|eyJhbGci|-----BEGIN (RSA |EC |)?PRIVATE KEY-----)' \
      || true
  )"
fi

if [ -n "$secret_hits" ]; then
  {
    echo "ERROR: potential secret material detected in staged changes:"
    echo "$secret_hits"
    echo
    echo "If any of these are real keys, remove them before committing and rotate compromised credentials."
  } >&2
  exit 1
fi

echo "OK: no staged dotenv files and no obvious secrets detected."
