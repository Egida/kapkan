# The fifth screenshot: the data plane

`capture-console.sh` photographs four console views on any machine that can run
the engine. The data-plane view is not one of them, and this file records why and
what it would take, so the next attempt does not start from scratch.

**Status: not captured.** The four site screenshots are current; there is no
`console-dataplane.png`, and `ConsoleShowcase.tsx` deliberately has no fifth tab
pointing at a file that does not exist.

## Why it cannot be taken on macOS

XDP is Linux. On any other host the engine reports no data plane at all, and the
console's Settings view renders the card as an admin-only placeholder — the
`if (!dp)` branch in `console/views2.js`. The attack drawer's "installed in
kernel" panel is equally unreachable: it renders only when a ban's method is
`dataplane`, which requires rules actually installed in kernel maps.

So the shot needs a Linux kernel with a data plane attached. Nothing about the
capture side changes: `capture.mjs` takes `--views settings` and files it as
`console-dataplane.png` already.

## What it would take

A container is enough — the block-rate suite and `make dataplane-bench` already
run against generic XDP inside the Docker Desktop VM, so the kernel there loads
and attaches the program.

1. Build a Linux binary: `GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build ./cmd/kapkan`
   (the BPF object is `go:embed`ed and is arch-neutral bytecode).
2. Run it privileged, with a writable bpffs, publishing both ports:
   `docker run --rm --privileged -p 18080:8080 -p 12055:2055/udp …`,
   mounting bpffs first (`mount -t bpf bpf /sys/fs/bpf`) if the image does not
   have it.
3. Config: `configs/dev.yaml` plus a `dataplane:` block with `enabled: true`,
   `interfaces: [eth0]`, `xdp_mode: generic`, and `mitigation: dataplane` so a
   detection installs kernel rules rather than announcing a route.
4. Inject from the host into the published UDP port — `scripts/flowinject`
   needs no changes, it is just a UDP sender.
5. Point `capture.mjs` at `http://127.0.0.1:18080/` with `--views settings`.

Keep `dry_run: true`. In dry-run the program still installs rules and still
counts, it just returns `XDP_PASS` — which is exactly the state worth
photographing, because the card then shows attached interfaces, the attach mode,
rule counts and per-verdict counters **with** the DRY RUN badge. `capture.mjs`
refuses to write anything if the console is not saying dry-run, and a marketing
page implying kapkan is dropping a visitor's real traffic is a claim, not a
picture.

## Unknowns, honestly

None of the above has been executed — it is derived from how the existing
harnesses run BPF in that VM, not from a run that produced an image. The two
places it is most likely to need work:

- whether `eth0` in the container's netns accepts a generic-XDP attach under
  Docker Desktop's LinuxKit kernel without extra capabilities beyond
  `--privileged`;
- whether the published-port hop preserves enough for the engine to see the
  injected flows as arriving on a protected network (the source address the
  container sees is the Docker gateway, which does not matter for `dst`-based
  detection, but has not been confirmed).

Budget an hour, and expect the first attempt to fail at step 2 or 3.
