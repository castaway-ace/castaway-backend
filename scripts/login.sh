#!/usr/bin/env bash
# Logs in to the Castaway API and prints an access token (valid for 15 minutes).
#   bash/zsh: export TOKEN=$(scripts/login.sh)
#   fish:     set -x TOKEN (scripts/login.sh)
set -euo pipefail
source "$(dirname "$0")/common.sh"

: "${CASTAWAY_EMAIL:?Set CASTAWAY_EMAIL}"
: "${CASTAWAY_PASSWORD:?Set CASTAWAY_PASSWORD}"

# POST /auth/login with the LoginDto body from Swagger. jq reads the
# credentials from the environment and curl reads the body from stdin, so the
# password never appears in `ps`.
tokens=$(jq -n '{
  email: env.CASTAWAY_EMAIL,
  password: env.CASTAWAY_PASSWORD,
  deviceInfo: {clientId: "baf0bcd2-8826-4f28-ac9b-9f458c046bb6"}
}' | post 200 /auth/login -H 'Content-Type: application/json' --data-binary @-)

access_token=$(jq -er .accessToken <<<"$tokens") ||
  { echo 'The login response has no access token.' >&2; exit 1; }
refresh_token=$(jq -er .refreshToken <<<"$tokens") ||
  { echo 'The login response has no refresh token.' >&2; exit 1; }

# Only the access token is used, so revoke the refresh token now rather than
# leave a session open for 30 days. The access token works until it expires.
REFRESH_TOKEN=$refresh_token jq -n '{refreshToken: env.REFRESH_TOKEN}' |
  post 204 /auth/logout -H @<(bearer "$access_token") \
    -H 'Content-Type: application/json' --data-binary @- >/dev/null ||
  echo 'Warning: could not revoke the refresh token.' >&2

printf '%s\n' "$access_token"
