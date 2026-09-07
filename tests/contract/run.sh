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
echo

# unsupported_method is excluded because 405 is not documented on any
# operation, so returning it would fail the undocumented-status check instead.
schemathesis run "$SPEC"   --url "$BASE"   --checks all   --exclude-checks unsupported_method   --config-file "$HERE/schemathesis.toml"   --header 'Content-Type: application/json'
