
# Compares the running service against openapi.yaml.

set -euo pipefail

BASE="${BASE:-http://localhost:3000/v1}"
SPEC="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/openapi.yaml"

if ! command -v schemathesis >/dev/null 2>&1; then
  echo "schemathesis is not installed. Install it with:" >&2
  echo "    pip install schemathesis" >&2
  exit 127
fi

echo "spec: $SPEC"
echo "base: $BASE"
echo

# --checks all includes negative cases: 
schemathesis run "$SPEC" \
  --url "$BASE" \
  --checks all \
  --header 'Content-Type: application/json'
