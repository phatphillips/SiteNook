#!/bin/sh
# Wait until Compose DNS can resolve upstreams, then start nginx.
# Combined with variable-based proxy_pass in nginx.conf, this avoids
# "host not found in upstream" crashes on cold starts.

set -eu

wait_for_host() {
  host="$1"
  attempts="${2:-90}"
  i=1
  while [ "$i" -le "$attempts" ]; do
    if getent hosts "$host" >/dev/null 2>&1; then
      echo "nginx-entrypoint: resolved ${host}"
      return 0
    fi
    echo "nginx-entrypoint: waiting for ${host} (${i}/${attempts})"
    i=$((i + 1))
    sleep 2
  done
  echo "nginx-entrypoint: timed out waiting for ${host}" >&2
  return 1
}

wait_for_host web 90
wait_for_host pocketbase 90

exec nginx -g 'daemon off;'
