#!/usr/bin/env bash
#
# Compares the running service against openapi.yaml. The base URL is the only
# thing that changes between the mock and the service.
#
#   ./tests/contract/run.sh
#   BASE=https://your-deployment/v1 ./tests/contract/run.sh

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="${BASE:-http://localhost:3000/v1}"
SPEC="$(cd "$HERE/../.." && pwd)/openapi.yaml"

if ! command -v schemathesis >/dev/null 2>&1; then
  echo "schemathesis is not installed. Install it with:" >&2
  echo "    pip install schemathesis" >&2
  exit 127
fi

echo "spec: $SPEC"
echo "base: $BASE"

# Every /v1 operation requires a token since Session 4. The contract did not
# change to accommodate that; this runner did. Export TOKEN before calling
# this script:
#
#   TOKEN=$(cat /tmp/contract-token.txt) ./tests/contract/run.sh
#
# Without one, every request is answered 401 and nothing below is exercised.
AUTH_HEADER=()

if [ -n "${TOKEN:-}" ]; then
  AUTH_HEADER=(--header "Authorization: Bearer $TOKEN")
  echo "auth: bearer token supplied"
else
  echo "auth: no TOKEN set — every protected operation will answer 401" >&2
fi

echo

# schemathesis.toml is discovered by searching upwards from the working
# directory, so run from the directory holding it.
cd "$HERE"

# unsupported_method is excluded because 405 is not documented on any
# operation, so returning it would fail the undocumented-status check instead.
schemathesis run "$SPEC" \
  --url "$BASE" \
  --checks all \
  --exclude-checks unsupported_method \
  --header 'Content-Type: application/json' \
  "${AUTH_HEADER[@]}"
