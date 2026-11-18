# Environment for browser checks on this machine. Source it, do not run it:
#
#   source tools/site/qa-env.sh
#   site_serve [port] [dir]   serve a site-profile build under /radio-pop-science/ (default 5391, tools/site/dist);
#                             prints http://127.0.0.1:<port>/radio-pop-science/ once it answers 200
#   site_stop [port]          stop whoever of this repository listens on the port (site_serve, `pnpm preview`,
#                             `pnpm dev` from app/); returns once the port is free
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

# A process belongs to this repository when its working directory or one of its arguments lies inside the
# repository or one of its git worktrees. That covers site_serve (absolute path to smoke.mjs) and
# `pnpm preview` / `pnpm dev` started from app/ (working directory), and leaves alone servers of other
# projects and servers run from scratch directories.
_site_owned() {
  local pid="$1" cwd root item
  local -a args=()
  cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null)"
  [ -r "/proc/$pid/cmdline" ] && mapfile -d '' args <"/proc/$pid/cmdline"
  while IFS= read -r root; do
    [ -n "$root" ] || continue
    for item in "$cwd" "${args[@]}"; do
      case "$item" in "$root" | "$root"/*) return 0 ;; esac
    done
  done < <(
    printf '%s\n' "$SITE_REPO"
    readlink -f "$SITE_REPO"
    git -C "$SITE_REPO" worktree list --porcelain 2>/dev/null | sed -n 's/^worktree //p'
  )
  return 1
}

site_stop() {
  local port="${1:-5391}" pid i foreign=0
  for pid in $(ss -ltnpH "sport = :$port" | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u); do
    if _site_owned "$pid"; then
      kill "$pid" 2>/dev/null
    else
      echo "site_stop: port $port is held by a program outside this repository" \
        "(pid $pid: $(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null)); left alone" >&2
      foreign=1
    fi
  done
  [ "$foreign" = 0 ] || return 1
  for i in $(seq 1 50); do
    [ -z "$(ss -ltnH "sport = :$port")" ] && return 0
    sleep 0.1
  done
  echo "site_stop: port $port is still taken after 5 s" >&2
  return 1
}
