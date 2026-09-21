#!/usr/bin/env bash
# Creates an artist, optionally with a JPEG, PNG or WebP image.
#   scripts/upload-artist.sh "Artist Name" [path/to/image.jpg]
set -euo pipefail
source "$(dirname "$0")/common.sh"

if (($# < 1 || $# > 2)); then
  echo 'Usage: scripts/upload-artist.sh "Artist Name" [path/to/image.jpg]' >&2
  exit 2
fi
require_token
name=$1
image=${2:-}

# POST /admin/artists takes multipart/form-data: a "name" field and an optional "file".
form=(--form-string "name=$name")
if [[ -n $image ]]; then
  [[ -f $image ]] || { echo "No such file: $image" >&2; exit 1; }
  # The API only accepts image/* types, and curl sends types it doesn't know,
  # such as WebP, as application/octet-stream.
  shopt -s nocasematch
  case $image in
    *.jpg | *.jpeg) type=image/jpeg ;;
    *.png) type=image/png ;;
    *.webp) type=image/webp ;;
    *) echo "Unsupported image type: $image (use .jpg, .png or .webp)" >&2; exit 1 ;;
  esac
  form+=(-F "file=$(form_file "$image" "$type")")
fi

post 201 /admin/artists -H @<(bearer "$TOKEN") "${form[@]}"
echo
