# Shared by the Castaway scripts. Source it after `set -euo pipefail`.

API=${CASTAWAY_API_URL:-http://localhost:3000}
# A trailing slash would turn paths into //auth/login, which the API 404s.
API=${API%/}

require_token() {
  : "${TOKEN:?Log in first: export TOKEN=\$(scripts/login.sh)}"
}

# An Authorization header for `curl -H @<(bearer "$TOKEN")`. Read from a file
# descriptor, the token doesn't show up in `ps`.
bearer() {
  printf 'Authorization: Bearer %s\n' "$1"
}

# form_file <path> [content type]: a curl -F value that uploads the file. The
# path is quoted so commas and semicolons in it aren't read as curl options.
form_file() {
  local path=${1//\\/\\\\}
  path=${path//\"/\\\"}
  printf '@"%s"%s' "$path" "${2:+;type=$2}"
}

# post <expected status> <path> [curl args...]: POSTs to the API and prints the
# response body. Any other status is an error, including a redirect, which
# curl doesn't follow for a POST and --fail wouldn't catch.
post() {
  local expected=$1 path=$2 response status redirect
  shift 2
  response=$(curl -sS -w '\n%{redirect_url}\n%{http_code}' "$@" "$API$path") || exit 1
  status=${response##*$'\n'}
  response=${response%$'\n'*}
  redirect=${response##*$'\n'}
  response=${response%$'\n'*}

  if [[ $status != "$expected" ]]; then
    echo "POST $path: expected HTTP $expected, got $status." >&2
    case $status in
      3??) echo "The API redirects to $redirect; set CASTAWAY_API_URL to that address." >&2 ;;
      413) echo 'A proxy in front of the API rejected the request as too large (Cloudflare allows 100 MB on Free and Pro plans). Run this on the server, where the default URL reaches the API directly.' >&2 ;;
    esac
    [[ -z $response ]] || echo "$response" >&2
    exit 1
  fi
  printf '%s' "$response"
}
