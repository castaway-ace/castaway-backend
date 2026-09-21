#!/usr/bin/env bash
# Uploads the audio files in a folder, including disc subfolders, as one album.
#   scripts/upload-album.sh "/path/to/album"
#
# The album goes up as a single request, so run this where the API is reachable
# directly, like on the server with the default URL. Proxies in front of it,
# such as the Cloudflare tunnel, reject request bodies over 100 MB.
set -euo pipefail
source "$(dirname "$0")/common.sh"

if (($# != 1)) || [[ ! -d $1 ]]; then
  echo 'Usage: scripts/upload-album.sh "/path/to/album"' >&2
  exit 2
fi
require_token

# POST /admin/albums takes multipart/form-data with one "files" part per track.
# The API reads each file's format from its contents, so no types are set.
# Sorted so the first file, whose embedded art becomes the cover, is track one.
form=()
tracks=0
while IFS= read -r -d '' track; do
  form+=(-F "files=$(form_file "$track")")
  tracks=$((tracks + 1))
done < <(find "$1" -type f ! -name '.*' \( -iname '*.flac' -o -iname '*.mp3' \
  -o -iname '*.m4a' -o -iname '*.ogg' -o -iname '*.wav' -o -iname '*.aac' \) \
  -print0 | sort -z)

if ((tracks == 0)); then
  echo "No .flac, .mp3, .m4a, .ogg, .wav or .aac files in $1" >&2
  exit 1
fi

post 201 /admin/albums -H @<(bearer "$TOKEN") "${form[@]}" >/dev/null
echo "Album uploaded ($tracks tracks)."
