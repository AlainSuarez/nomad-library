#!/bin/bash
# Downloads the rating and movie-shelf files the site needs (public/ix/ and public/shelf.json) from the live site.
# They're built from IMDb's datasets, whose license is personal and non-commercial, so they aren't kept in this repo.
# Maintainers rebuild them with tools/build_index.py, build_people.py, build_genres.py and build_shelf.py.
set -euo pipefail
cd "$(dirname "$0")/../public"
BASE="${DATA_BASE:-https://library.nomadovernormal.com}"
grep -v '^\s*$' ../tools/data-files.txt | while read -r f; do [ -s "$f" ] || echo "$f"; done |
  xargs -P 16 -I{} sh -c 'mkdir -p "$(dirname "{}")" && curl -fsSL --retry 3 -o "{}" "'"$BASE"'/{}" || { echo "failed: {}" >&2; exit 255; }'
echo "data files ready: $(grep -c . ../tools/data-files.txt)"
