#!/bin/bash
set -euo pipefail

repo="${GITHUB_REPOSITORY:-Sarmay/bob-plugin-deeplx}"
input_ref="${1:-${GITHUB_REF:-v1.0.10}}"

case "$input_ref" in
  refs/tags/v*) version="${input_ref#refs/tags/v}" ;;
  v*) version="${input_ref#v}" ;;
  *) version="$input_ref" ;;
esac

package_name="bob-plugin-deeplx-${version}.bobplugin"

zip -r -j "$package_name" src/*

sha256_deeplx=$(sha256sum "$package_name" | awk '{print $1}')
echo "$sha256_deeplx"

download_link="https://github.com/${repo}/releases/download/v${version}/${package_name}"
new_version=$(jq -n \
  --arg version "$version" \
  --arg sha256 "$sha256_deeplx" \
  --arg url "$download_link" \
  '{
    version: $version,
    desc: "Support Linux.do API key mode",
    sha256: $sha256,
    url: $url,
    minBobVersion: "0.5.0"
  }')

appcast_json=$(cat appcast.json)
updated_json=$(echo "$appcast_json" | jq --argjson new_version "$new_version" '.versions += [$new_version]')
echo "$updated_json" > appcast.json

mkdir -p dist
mv "$package_name" dist/
