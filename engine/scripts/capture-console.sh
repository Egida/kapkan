#!/usr/bin/env bash
#
# Recapture the operator-console screenshots the kapkan.io landing uses.
#
# The console is the real SPA embedded in the engine — there is no mock mode and
# no fixture data — so the only way to photograph it is to run a kapkan, feed it
# an attack, and drive a browser. This script does all three and leaves nothing
# behind.
#
#   ./scripts/capture-console.sh                 # the four site screenshots
#   ./scripts/capture-console.sh --keep-running  # leave engine+injector up
#   VIEWS=overview ./scripts/capture-console.sh  # just one
#
# What it does:
#   1. builds the engine (the console is go:embed'd into the binary)
#   2. runs it on a copy of configs/dev.yaml with the API moved to a free port
#   3. injects NetFlow v9 until the thresholds trip (scripts/flowinject)
#   4. drives headless Chrome over CDP (scripts/capture.mjs)
#   5. writes site/frontend/public/assets/screenshots/console-*.png
#
# Two hard refusals live in capture.mjs, not here, because they are properties of
# what is on screen: it will not write anything if no attack is active, or if the
# console is not saying DRY RUN. These images go on a public marketing page; one
# that implies kapkan is dropping real traffic is a claim, not a picture.
#
# The data-plane screenshot is NOT taken here. XDP needs Linux, and on macOS the
# console renders the data-plane card as an admin-only placeholder because the
# API reports no data plane at all. See scripts/capture-dataplane.md.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."   # engine/

API_PORT=${API_PORT:-18080}
NETFLOW_PORT=${NETFLOW_PORT:-12055}
VIEWS=${VIEWS:-overview,attacks,bans,hosts}
WIDTH=${WIDTH:-1440}
SCALE=${SCALE:-2}
# How long to let the attack build before photographing. The engine needs a
# couple of sliding-window ticks to cross a threshold and open a ban.
WARMUP=${WARMUP:-12}
OUT=${OUT:-$PWD/../site/frontend/public/assets/screenshots}
KEEP=0
[ "${1:-}" = "--keep-running" ] && KEEP=1

CHROME=${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
[ -x "$CHROME" ] || CHROME=$(command -v google-chrome || command -v chromium || true)
[ -n "$CHROME" ] && [ -x "$CHROME" ] || { echo "ERROR: no Chrome found. Set CHROME=/path/to/chrome" >&2; exit 1; }
command -v node >/dev/null || { echo "ERROR: node is required (global WebSocket ⇒ Node 22+)" >&2; exit 1; }

WORK=$(mktemp -d)
PIDS=()
cleanup() {
	if [ "$KEEP" = "1" ]; then
		echo "==> --keep-running: engine on http://127.0.0.1:$API_PORT/ (pids: ${PIDS[*]:-none})"
		echo "    kill them with: kill ${PIDS[*]:-}"
		return
	fi
	for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done
	rm -rf "$WORK"
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------- 1. build
echo "==> building the engine"
make build >/dev/null

# ---------------------------------------------------------------- 2. config
# dev.yaml binds the API on 127.0.0.1:8080 and NetFlow on :2055. Both are
# common: Docker Desktop happily binds *:8080, and then `localhost` resolving to
# ::1 first reaches the wrong listener. Move both and the ambiguity is gone.
CFG="$WORK/screenshots.yaml"
sed -e "s|^  listen: \"127.0.0.1:8080\"|  listen: \"127.0.0.1:$API_PORT\"|" \
    -e "s|^  netflow: \":2055\"|  netflow: \":$NETFLOW_PORT\"|" \
    configs/dev.yaml > "$CFG"
grep -q "127.0.0.1:$API_PORT" "$CFG" || { echo "ERROR: could not rewrite api.listen — has configs/dev.yaml changed shape?" >&2; exit 1; }
grep -q ":$NETFLOW_PORT" "$CFG"      || { echo "ERROR: could not rewrite listen.netflow — has configs/dev.yaml changed shape?" >&2; exit 1; }
grep -q '^dry_run: true' "$CFG"      || { echo "ERROR: configs/dev.yaml is not dry_run: true. Refusing." >&2; exit 1; }

# ---------------------------------------------------------------- 3. engine
echo "==> starting kapkan (dry-run) on 127.0.0.1:$API_PORT"
./kapkan -config "$CFG" >"$WORK/engine.log" 2>&1 &
PIDS+=($!)
for i in $(seq 1 50); do
	curl -sf "http://127.0.0.1:$API_PORT/healthz" >/dev/null 2>&1 && break
	sleep 0.2
	[ "$i" = 50 ] && { echo "ERROR: engine did not become healthy:" >&2; tail -20 "$WORK/engine.log" >&2; exit 1; }
done

# ---------------------------------------------------------------- 4. traffic
echo "==> injecting the attack scene into :$NETFLOW_PORT"
# BUILT, not `go run`. `go run` compiles and then EXECS the binary as a child, so
# the pid this script would record is the wrapper's — killing it orphans the
# injector, which keeps blasting the port forever. Twelve of them accumulated
# that way while this harness was being written, and the strays polluted a
# capture with phantom attacks on hosts that were supposed to be quiet.
go build -o "$WORK/flowinject" ./scripts/flowinject
"$WORK/flowinject" -target "127.0.0.1:$NETFLOW_PORT" >"$WORK/inject.log" 2>&1 &
PIDS+=($!)
echo "    warming up for ${WARMUP}s so thresholds trip and bans open"
sleep "$WARMUP"

# Assert the scene, do not hope for it. The engine reports whatever it was sent,
# so a stray sender, a retuned scene or a changed dev.yaml threshold all surface
# here — and a screenshot of the wrong scene is worse than none, because it looks
# fine. The minimums are 75% of what scripts/flowinject/main.go documents having
# measured; below that the engine is losing datagrams to CPU contention, which is
# transient, so this retries rather than failing at the first look.
#
# They were raised fivefold with no change to the scene when /api/v1/attacks
# stopped serving the rate frozen at detection and started serving the engine's
# live one. The floors are what makes this an assertion: left at a fifth of what
# the scene now produces, the whole scene could collapse to a fifth of itself and
# still pass.
EXPECT=${EXPECT:-"203.0.113.45:97 203.0.113.10:45 203.0.113.77:15"}
SCENE_DEADLINE=$((SECONDS + ${SCENE_WAIT:-90}))
while :; do
	SCENE=$(curl -sf "http://127.0.0.1:$API_PORT/api/v1/attacks" || echo '{}')
	if printf '%s' "$SCENE" | python3 -c '
import json, sys
want = dict(p.split(":") for p in sys.argv[1].split())
act = json.load(sys.stdin).get("active", [])
by = {a["target"]: a for a in act}
problems = []
for target, floor in want.items():
    a = by.get(target)
    if a is None:
        problems.append(f"{target} is not under attack")
        continue
    ratio = a["rate"] / a["threshold"]
    if ratio < float(floor):
        problems.append(f"{target} only {ratio:.1f}x threshold, want >= {floor}x")
for extra in set(by) - set(want):
    problems.append(f"unexpected attacker {extra} — a stray injector from an earlier run? (ps ax | grep flowinject)")
for a in sorted(act, key=lambda x: -x["rate"]):
    t, m, ratio = a["target"], a["metric"], a["rate"] / a["threshold"]
    print(f"    {t:14} {m:8} {ratio:5.1f}x threshold")
for p in problems:
    print(f"  ! {p}", file=sys.stderr)
sys.exit(1 if problems else 0)
' "$EXPECT"; then
		break
	fi
	if [ "$SECONDS" -ge "$SCENE_DEADLINE" ]; then
		echo "ERROR: the scene never reached what the screenshots are supposed to show." >&2
		tail -5 "$WORK/inject.log" >&2 || true
		exit 1
	fi
	echo "    scene not there yet, waiting…"
	sleep 5
done

# ---------------------------------------------------------------- 5. chrome
echo "==> launching headless Chrome"
"$CHROME" --headless=new --remote-debugging-port=9222 --hide-scrollbars \
	--no-first-run --no-default-browser-check --disable-gpu \
	--user-data-dir="$WORK/chrome" about:blank >"$WORK/chrome.log" 2>&1 &
PIDS+=($!)
# Gate on the DevTools port here rather than letting capture.mjs discover it is
# missing: a failure at this step is Chrome's, and Chrome's own log is the only
# thing that explains it.
for i in $(seq 1 80); do
	curl -sf "http://127.0.0.1:9222/json/version" >/dev/null 2>&1 && break
	sleep 0.25
	if [ "$i" = 80 ]; then
		echo "ERROR: Chrome never opened its debugging port on 9222." >&2
		echo "       Something else may already hold the port: $(lsof -ti tcp:9222 2>/dev/null | tr '\n' ' ')" >&2
		echo "--- chrome.log ---" >&2
		tail -20 "$WORK/chrome.log" >&2
		exit 1
	fi
done

# ---------------------------------------------------------------- 6. capture
echo "==> capturing $VIEWS"
node scripts/capture.mjs \
	--url "http://127.0.0.1:$API_PORT/" \
	--out "$OUT" --views "$VIEWS" \
	--width "$WIDTH" --scale "$SCALE" \
	--require-attacks

echo "==> done: $OUT"
