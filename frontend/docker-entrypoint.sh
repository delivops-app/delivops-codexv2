#!/bin/sh
set -eu

if [ "${SKIP_API_WAIT:-0}" != "0" ]; then
  echo "SKIP_API_WAIT set; skipping API availability check."
  exec "$@"
fi

resolve_base_url() {
  if [ -n "${API_HEALTHCHECK_URL:-}" ]; then
    printf '%s' "$API_HEALTHCHECK_URL"
    return
  fi

  if [ -n "${API_PROXY_TARGET:-}" ]; then
    printf '%s' "$API_PROXY_TARGET"
    return
  fi

  if [ -n "${API_BASE_INTERNAL:-}" ]; then
    printf '%s' "$API_BASE_INTERNAL"
    return
  fi

  printf '%s' 'http://api:8000'
}

base_url="$(resolve_base_url)"
path="${API_HEALTHCHECK_PATH:-/healthz}"
interval="${API_HEALTHCHECK_INTERVAL:-2}"
retries="${API_HEALTHCHECK_RETRIES:-30}"

# Ensure the healthcheck URL has a protocol and no trailing slash before appending the path.
case "$base_url" in
  http://*|https://*)
    ;; # already has protocol
  *)
    base_url="http://$base_url"
    ;;
esac

# Remove trailing slash to avoid double slashes when concatenating with the health path.
base_url="${base_url%/}"
health_url="$base_url$path"

attempt=1
while [ "$attempt" -le "$retries" ]; do
  if curl -fsS "$health_url" >/dev/null 2>&1; then
    echo "API is available at $health_url"
    exec "$@"
  fi

  echo "[$attempt/$retries] API not ready at $health_url; retrying in ${interval}s..."
  attempt=$((attempt + 1))
  sleep "$interval"
done

echo "API failed to respond at $health_url after $retries attempts." >&2
exit 1
