# Screenshotting the data plane

`capture-console.sh` photographs the four ordinary console views on any machine
that can run the engine. The data-plane views need a Linux kernel with XDP, so
they are captured separately, by the recipe below. It has been run — the shots on
the `/xdp` landing came out of it — so this is a record of what works, not a
sketch.

## Why not on macOS

XDP is Linux. On any other host the engine reports no data plane, and the
console's Settings card renders the admin-only placeholder (`if (!dp)` in
`console/views2.js`). The "In-kernel drop (XDP)" method chip in the Attacks view,
and the "installed in kernel" panel in the attack drawer, only appear when a
ban's method is actually `dataplane`. So the shot needs a real attach.

## The recipe (Docker Desktop, verified 2026-08-11)

The Docker Desktop VM (LinuxKit, 6.12 at time of writing) loads and attaches the
program in generic mode under `--privileged`; the block-rate suite and
`make dataplane-bench` already rely on that.

1. **Build a Linux binary.** The console is `go:embed`ed, so sync it first:
   ```
   rm -rf internal/api/static && mkdir -p internal/api/static
   cp -R ../console/. internal/api/static/
   GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -o /tmp/kapkan-linux ./cmd/kapkan
   ```
   (`arm64` on Apple silicon; the BPF object is arch-neutral bytecode either way.)

2. **Config.** Start from `configs/dev.yaml`, bind the API on `0.0.0.0:8080` (so
   the published port reaches it), and append:
   ```yaml
   mitigation: dataplane
   dataplane:
     enabled: true
     interfaces: [eth0]
     xdp_mode: generic
   ```

3. **Entrypoint** mounts bpffs, which the stock `ubuntu:24.04` image lacks:
   ```sh
   #!/bin/sh
   mountpoint -q /sys/fs/bpf || mount -t bpf bpf /sys/fs/bpf
   exec /kapkan -config /config.yaml
   ```

4. **Run** privileged, publishing the API and NetFlow ports, mounting the binary,
   config and entrypoint read-only:
   ```
   docker run -d --name kapkan-dp --privileged -p 18090:8080 -p 12070:2055/udp \
     -v /tmp/kapkan-linux:/kapkan:ro -v /tmp/dp.yaml:/config.yaml:ro \
     -v /tmp/entry.sh:/entry.sh:ro ubuntu:24.04 /entry.sh
   ```
   `docker logs` should show `data plane attached ... mode generic` and
   `XDP data plane up`.

5. **Inject** from the host — `scripts/flowinject` is just a UDP sender, no
   changes needed:
   ```
   go build -o /tmp/flowinject ./scripts/flowinject
   /tmp/flowinject -target 127.0.0.1:12070 &
   ```

6. **Capture** with headless Chrome on a spare debug port, pointing `capture.mjs`
   at the container's API:
   ```
   node scripts/capture.mjs --url http://127.0.0.1:18090/ --port 9224 \
     --out ../site/frontend/public/assets/screenshots/xdp \
     --views settings,attacks --require-attacks [--allow-live]
   ```

## dry-run vs live — and why the drop counters stay at zero

Two things the run taught, both worth knowing before you read the shots:

- **In dry-run, no rules are installed.** The mitigator's dataplane path is below
  the announcer seam, so with `dry_run: true` a detection logs
  "DRY-RUN: would announce mitigation (not sent)" and installs nothing — the
  Settings card shows the plane attached and healthy but `Rules 0 + 0`,
  generation 0. That is the honest "safe by default" picture. To show rules in
  the kernel (`0 + 3`, method chips reading "In-kernel drop (XDP)"), set
  `dry_run: false` and pass `--allow-live`. That flag is a deliberate opt-in;
  without it `capture.mjs` refuses to shoot a non-dry-run console, because the
  ordinary site screenshots must never imply production drops. It is safe here
  only because the victims are RFC 5737 TEST-NET addresses — unmistakably a lab.

- **The drop counters do not climb from `flowinject` alone.** The injector sends
  NetFlow *telemetry describing* an attack; the data plane drops *actual packets*.
  In this lab no real packets to `203.0.113.x` traverse `eth0` — only the
  telemetry about them — so every verdict is `pass_default`. Installed-rule count
  and the method chips are the honest mechanism evidence; the block-rate numbers
  come from the committed pcap suite (`make dataplane-...`), which replays real
  frames through the program, not from a screenshot. Getting counters to move
  would need a packet-level flood into the container's RX path (a second sender
  crafting frames with dst `203.0.113.45` onto `eth0`), which was judged not
  worth building for a screenshot.

## Teardown

`docker rm -f kapkan-dp` and `pkill -f 'flowinject -target'`. The injector is a
plain background process here (not `go run`, which would orphan a child); kill it
by name.
