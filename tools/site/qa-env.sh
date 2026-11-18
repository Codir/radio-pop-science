# Environment for browser checks on this machine. Source it, do not run it:
#
#   source tools/site/qa-env.sh
#   site_serve [port] [dir]   serve a site-profile build under /radio-pop-science/ (default 5391, tools/site/dist);
#                             prints http://127.0.0.1:<port>/radio-pop-science/ once it answers 200
#   site_stop [port]          stop that server; returns once the port is free
#
# It sets: Node 24 (nvm), QA_ALLOW_SOFTWARE=1 (no GPU here), QA_OUT (default ~/.cache/radio-pop-science/qa,
# created), and puts tools/site/shims (ImageMagick stand-ins on Pillow) first on PATH when `montage` is missing.

SITE_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  nvm use 24 >/dev/null
fi
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

export QA_ALLOW_SOFTWARE=1
export QA_OUT="${QA_OUT:-$HOME/.cache/radio-pop-science/qa}"
mkdir -p "$QA_OUT"

command -v montage >/dev/null 2>&1 || export PATH="$SITE_REPO/tools/site/shims:$PATH"

# The server runs detached (setsid nohup), so `$!` is not usable later and `pkill -f` would match the calling
# shell's own command line: both functions find the server by its listening port.
site_serve() {
  local port="${1:-5391}" dir="${2:-$SITE_REPO/tools/site/dist}"
  local url="http://127.0.0.1:$port/radio-pop-science/" log="$QA_OUT/site-$port.log" i
  if [ -n "$(ss -ltnH "sport = :$port")" ]; then
    echo "site_serve: port $port is already taken (site_stop $port frees it if site_serve started it)" >&2
    return 1
  fi
  if [ ! -f "$dir/index.html" ]; then
    echo "site_serve: $dir/index.html is missing (node tools/site/build.mjs builds it)" >&2
    return 1
  fi
  (setsid nohup node "$SITE_REPO/tools/site/smoke.mjs" --dist "$dir" --serve --port "$port" >"$log" 2>&1 </dev/null &)
  for i in $(seq 1 50); do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' "$url")" = 200 ]; then
      echo "$url"
      return 0
    fi
    sleep 0.2
  done
  echo "site_serve: no answer from $url within 10 s; log $log:" >&2
  tail -n 5 "$log" >&2
  return 1
}

site_stop() {
  local port="${1:-5391}" pid args i
  for pid in $(ss -ltnpH "sport = :$port" | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u); do
    args="$(ps -o args= -p "$pid" 2>/dev/null)"
    case "$args" in
      *tools/site/smoke.mjs*--serve*) kill "$pid" 2>/dev/null ;;
      *)
        echo "site_stop: port $port is held by another program (pid $pid: $args); left alone" >&2
        return 1
        ;;
    esac
  done
  for i in $(seq 1 50); do
    [ -z "$(ss -ltnH "sport = :$port")" ] && return 0
    sleep 0.1
  done
  echo "site_stop: port $port is still taken after 5 s" >&2
  return 1
}
