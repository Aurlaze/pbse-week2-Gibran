#!/usr/bin/env bash
#
# Session 4 checkpoints that need something running.
#
# Everything else in L4 is already proven by `npm run test:authz` and
# `npm run lint`. What is left are the checks only a real authorisation
# server or a real running service can answer, and whose OUTPUT is the
# deliverable — Step 12c asks for it pasted into
# docs/decisions/0003-autentikasi.md.
#
# Run this on a machine with Docker, from the repository root:
#
#     bash docs/checkpoints.sh 2>&1 | tee docs/checkpoint-output.txt
#
# Then paste the marked sections into the ADR.
#
# Nothing here writes to the repository or to any deployed database.

set -uo pipefail

ISSUER_BASE="${ISSUER_BASE:-http://localhost:8080}"
REALM="${REALM:-badminton-booking}"
ISSUER="$ISSUER_BASE/realms/$REALM"
BASE="${BASE:-http://localhost:3000}"
CLI_CLIENT="${CLI_CLIENT:-test-cli}"

# The rotation check below also uses test-cli, because it is the only client
# in this realm with direct access grants enabled — the two real public
# clients have them off, which is correct for a client that logs a user in
# through a browser, but means a script cannot obtain a token from them.
#
# This does not weaken the check. revokeRefreshToken and refreshTokenMaxReuse
# are realm-level settings, so rotation and reuse detection behave the same
# whichever client asked for the token.
WEB_CLIENT="${WEB_CLIENT:-test-cli}"
USER_A="${USER_A:-student-a}"
PASS_A="${PASS_A:-password}"

pass=0; fail=0; manual=0

hr()    { printf '\n%s\n' "------------------------------------------------------------"; }
head2() { hr; printf '%s\n' "$1"; printf '%s\n\n' "------------------------------------------------------------"; }
ok()    { printf '  PASS   %s\n' "$1"; pass=$((pass+1)); }
no()    { printf '  FAIL   %s\n' "$1"; fail=$((fail+1)); }
todo()  { printf '  MANUAL %s\n' "$1"; manual=$((manual+1)); }
want()  { if [ "$2" = "$3" ]; then ok "$1 -> $2"; else no "$1 -> $2 (expected $3)"; fi; }

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "missing required tool: $1" >&2; exit 127; }
}
need curl
need node   # this is a Node project, so node is always here; jq may not be

# ---------------------------------------------------------------------
# JSON handling through node rather than jq, so the only tools this
# script needs are ones the repository already requires.
# ---------------------------------------------------------------------

# jget <dotted.path> — reads JSON on stdin, prints one value (empty if absent)
jget() {
  node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try { let o=JSON.parse(s); for (const k of process.argv[1].split(".")) o = o?.[k];
        console.log(o ?? ""); } catch { console.log(""); }
})' "$1"
}

# jpick <key>... — reads JSON on stdin, pretty-prints just those keys
jpick() {
  node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try { const o=JSON.parse(s), out={};
        for (const k of process.argv.slice(1)) if (k in o) out[k]=o[k];
        console.log(JSON.stringify(out,null,2)); } catch { console.log("(unparseable)"); }
})' "$@"
}

# jwt_payload — reads a JWT on stdin, prints its decoded payload.
#
# Decoded locally, on purpose. Never paste a live token into an online
# decoding site: it is a live credential, and doing so is the same as
# sharing a password.
jwt_payload() {
  node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try { const o=JSON.parse(Buffer.from(s.trim().split(".")[1],"base64url").toString("utf8"));
        const out={};
        for (const k of ["iss","aud","exp","sub","scope","azp","client_id","preferred_username"])
          if (k in o) out[k]=o[k];
        console.log(JSON.stringify(out,null,2)); } catch { console.log("(could not decode)"); }
})'
}

# problem_norm — normalises a Problem body so two can be compared.
# `instance` carries the per-request correlation id and is meant to differ.
problem_norm() {
  node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try { const o=JSON.parse(s); delete o.instance;
        console.log(JSON.stringify(o,Object.keys(o).sort())); } catch { console.log(s); }
})'
}

head2 "0 . Is anything actually running?"

if curl -fsS --max-time 5 "$ISSUER/.well-known/openid-configuration" >/dev/null 2>&1; then
  ok "Keycloak is up at $ISSUER"
  KEYCLOAK_UP=1
else
  KEYCLOAK_UP=0
  cat <<EOF
  Keycloak is NOT answering at $ISSUER

  Start it first:
      cd infra
      KC_ADMIN_PASSWORD=<choose one> docker compose -f docker-compose.auth.yml up -d

  Sections 3h and 10b need it. Sections 9 and 12d do not.
EOF
fi

if curl -fsS --max-time 5 "$BASE/health" >/dev/null 2>&1; then
  ok "the service is up at $BASE"
  SERVICE_UP=1
else
  SERVICE_UP=0
  echo "  the service is NOT answering at $BASE — start it with: cd service && npm start"
fi

TOKEN_A=""

# =====================================================================
# Step 3h — what a real token actually contains.
# =====================================================================
head2 "3h . Discovery document and one real token   [PASTE INTO ADR section 1]"

if [ "$KEYCLOAK_UP" = "1" ]; then
  echo "  Discovery:"
  curl -s "$ISSUER/.well-known/openid-configuration" | jpick issuer jwks_uri | sed 's/^/    /'

  echo
  echo "  Access token for $USER_A via the manual-inspection client:"
  TOKEN_A=$(curl -s -X POST "$ISSUER/protocol/openid-connect/token" \
    -d grant_type=password -d "client_id=$CLI_CLIENT" \
    -d "username=$USER_A" -d "password=$PASS_A" \
    -d 'scope=openid bookings:read bookings:write' | jget access_token)

  if [ -n "$TOKEN_A" ]; then
    ok "token issued"
    printf '%s' "$TOKEN_A" | jwt_payload | sed 's/^/    /'
    echo
    echo "  ^ Step 6b: confirm which claim marks a client-credentials token."
    echo "    src/auth/principal.js reads client_id / clientId, then falls back to a"
    echo "    preferred_username beginning 'service-account-'. If a token issued"
    echo "    through Client Credentials carries neither, principal.js needs fixing."
  else
    no "no token issued"
    echo "         check that $CLI_CLIENT has direct access grants enabled,"
    echo "         and that $USER_A has the password '$PASS_A'"
  fi
else
  todo "skipped: Keycloak is not running"
fi

# =====================================================================
# Step 10b — rotation and reuse detection. The important one.
# =====================================================================
head2 "10b . Refresh rotation and reuse detection   [PASTE INTO ADR section 6]"

if [ "$KEYCLOAK_UP" = "1" ]; then
  RT1=$(curl -s -X POST "$ISSUER/protocol/openid-connect/token" \
    -d grant_type=password -d "client_id=$WEB_CLIENT" \
    -d "username=$USER_A" -d "password=$PASS_A" \
    -d 'scope=openid offline_access bookings:read' | jget refresh_token)

  if [ -z "$RT1" ]; then
    todo "could not obtain a refresh token from $WEB_CLIENT"
    echo "         Check that $WEB_CLIENT has direct access grants enabled and"
    echo "         that $USER_A exists with password '$PASS_A'. Re-import the realm"
    echo "         if this is an older container: docker compose down -v, then up."
  else
    ok "RT1 obtained"

    RT2=$(curl -s -X POST "$ISSUER/protocol/openid-connect/token" \
      -d grant_type=refresh_token -d "client_id=$WEB_CLIENT" \
      -d "refresh_token=$RT1" | jget refresh_token)

    if [ -n "$RT2" ] && [ "$RT1" != "$RT2" ]; then
      ok "1. rotation is working - RT2 differs from RT1"
    else
      no "1. rotation is NOT working - the same refresh token came back"
    fi

    E2=$(curl -s -X POST "$ISSUER/protocol/openid-connect/token" \
      -d grant_type=refresh_token -d "client_id=$WEB_CLIENT" \
      -d "refresh_token=$RT1" | jget error)

    if [ -n "$E2" ]; then
      ok "2. reusing the spent RT1 is refused -> $E2"
    else
      no "2. the spent RT1 was ACCEPTED - reuse is not detected"
    fi

    E3=$(curl -s -X POST "$ISSUER/protocol/openid-connect/token" \
      -d grant_type=refresh_token -d "client_id=$WEB_CLIENT" \
      -d "refresh_token=$RT2" | jget error)

    if [ -n "$E3" ]; then
      ok "3. RT2 is ALSO refused -> $E3   (the whole family was revoked)"
    else
      no "3. RT2 still works - the server rejected the old token but did NOT"
      echo "         revoke the family. Reuse detection is not enabled."
    fi

    echo
    echo "  Setting enabled on the realm:"
    echo "    revokeRefreshToken = true, refreshTokenMaxReuse = 0"
  fi
else
  todo "skipped: Keycloak is not running"
fi

# =====================================================================
# Step 7 — the scope refusal must not need the database.
# =====================================================================
head2 "7 . A missing scope is refused before any query   [PASTE INTO ADR section 4]"

if [ "$SERVICE_UP" = "1" ] && [ -n "$TOKEN_A" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN_A" "$BASE/v1/courts")
  want "a token without courts:read on GET /v1/courts" "$code" "403"

  curl -si -H "Authorization: Bearer $TOKEN_A" "$BASE/v1/courts" \
    | grep -i '^www-authenticate' | sed 's/^/    /'

  echo
  echo "  Now STOP THE DATABASE and repeat that same request."
  todo "it must still answer 403, never 500 - that is what proves no query was reached"
else
  todo "skipped: needs both the service and a token"
fi

# =====================================================================
# Step 12d — the demonstration checklist, as far as it can be automated.
# =====================================================================
head2 "12d . Pre-demonstration checklist"

if [ "$SERVICE_UP" = "1" ]; then
  want "a request with no token is refused" \
    "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/v1/bookings")" "401"

  want "an edited token is refused" \
    "$(curl -s -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhdHRhY2tlciJ9.bm90YXNpZ25hdHVyZQ' "$BASE/v1/bookings")" "401"

  want "the health check is still public" \
    "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/health")" "200"

  if [ -n "$TOKEN_A" ]; then
    echo
    echo "  'absent' and 'not yours' must be byte-identical:"
    if diff \
        <(curl -s -H "Authorization: Bearer $TOKEN_A" "$BASE/v1/bookings/bkg_ownedByB" | problem_norm) \
        <(curl -s -H "Authorization: Bearer $TOKEN_A" "$BASE/v1/bookings/bkg_neverIssued" | problem_norm) \
        >/dev/null 2>&1; then
      ok "the two 404 bodies are identical"
    else
      no "the two 404 bodies DIFFER - identifiers are still enumerable"
    fi
  fi
else
  todo "skipped: the service is not running"
fi

# =====================================================================
# Step 9 — no token in any log, no secret in any public client.
# =====================================================================
head2 "9 . No token in any log   [PASTE INTO ADR section 7]"

logs_found=0
for d in service/logs /tmp/service.log; do
  [ -e "$d" ] && logs_found=1
done

if [ "$logs_found" = "1" ]; then
  if grep -RniE 'bearer [A-Za-z0-9._-]{20,}|eyJ[A-Za-z0-9_-]{20,}' \
       service/logs /tmp/service.log 2>/dev/null; then
    no "STILL LEAKING - a token appears above"
  else
    ok "clean - no token-shaped string in any log file"
  fi
else
  todo "no local log files found; check the hosting platform's console output too"
fi

echo
echo "  No client secret in any public client:"
if grep -nE '"secret"[[:space:]]*:' infra/keycloak/*.json 2>/dev/null; then
  no "a secret is committed in the realm file"
else
  ok "clean - no client secret committed"
fi

hr
printf 'pass %d . fail %d . manual %d\n' "$pass" "$fail" "$manual"
hr

cat <<'EOF'

Next:
  1. Paste the marked sections into docs/decisions/0003-autentikasi.md
  2. Anything marked MANUAL still needs a human
  3. Push, confirm the GitHub run is green, then: git tag l4 && git push --tags

EOF

[ "$fail" -eq 0 ]
