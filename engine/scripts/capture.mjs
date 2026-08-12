#!/usr/bin/env node
// Photographs the operator console over the Chrome DevTools Protocol.
//
// Called by capture-console.sh, which is responsible for having a kapkan with
// live data and a headless Chrome with an open debugging port; this script only
// drives them. Kept dependency-free on purpose: Node 25 has a global WebSocket
// and a global fetch, so the harness needs no npm install to run.
//
// Two things about the console shape the capture:
//
//  1. `.app` is `height: 100vh; overflow: hidden` and `.main` scrolls inside it.
//     Scrolling and stitching would therefore photograph a scrollbar mid-flight,
//     so instead the viewport is GROWN by exactly the hidden overflow and the
//     whole thing is taken in one frame.
//  2. The console is dark-only — `:root` carries the dark tokens and there is no
//     prefers-color-scheme rule anywhere in its CSS — so no media emulation is
//     needed to get the dark screenshots the site uses.
//
// Usage:
//   node capture.mjs --url http://127.0.0.1:8080/ --out ../../site/frontend/public/assets/screenshots \
//                    --views overview,attacks,bans,hosts --require-attacks

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

/* ------------------------------------------------------------------ args */
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def;
};
const flag = (name) => argv.includes(`--${name}`);

const URL_ = arg("url", "http://127.0.0.1:8080/");
const OUT = resolve(arg("out", "."));
const PORT = Number(arg("port", "9222"));
const WIDTH = Number(arg("width", "1440"));
const SCALE = Number(arg("scale", "2"));
const SETTLE = Number(arg("settle", "900"));
const BASE_H = Number(arg("height", "900"));
// Taller than any view can plausibly be, used only while measuring.
const MEASURE_H = Number(arg("measure-height", "4000"));
const MIN_H = Number(arg("min-height", "560"));
const MAX_H = Number(arg("max-height", "3000"));
const REQUIRE_ATTACKS = flag("require-attacks");

// data-view id -> output basename. `bans` is filed as console-mitigation.png
// because that is what the site calls the tab; the console calls the view Bans.
const NAMES = { overview: "overview", attacks: "attacks", bans: "mitigation", hosts: "hosts", settings: "dataplane" };
const VIEWS = arg("views", "overview,attacks,bans,hosts").split(",").map((s) => s.trim()).filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------- minimal CDP client */
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.next = 1;
    this.pending = new Map();
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: res, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? null)})`)) : res(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = this.next++;
    return new Promise((res, reject) => {
      this.pending.set(id, { resolve: res, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`${method} timed out`));
      }, 30_000);
    });
  }
  // eval returns the VALUE of an expression, and turns a page-side throw into a
  // real rejection instead of an object nobody looks inside.
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`page threw: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ""}`);
    return r.result.value;
  }
}

async function connect() {
  // A fresh headless Chrome may not have its port up the instant it is spawned,
  // so this retries — but it keeps the LAST failure and reports it. Swallowing
  // these silently turns "the websocket upgrade was refused" into "no page
  // target", which sends you looking in entirely the wrong place.
  let last = "never reached /json";
  for (let i = 0; i < 50; i++) {
    try {
      const targets = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json());
      const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (!page) {
        last = `/json listed ${targets.length} targets but no page: ${targets.map((t) => t.type).join(", ") || "none"}`;
      } else {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((res, rej) => {
          ws.addEventListener("open", res, { once: true });
          ws.addEventListener("error", (e) => rej(new Error(`websocket upgrade failed: ${e.message ?? e.error?.message ?? e.type}`)), { once: true });
          setTimeout(() => rej(new Error("websocket upgrade timed out")), 5000);
        });
        return new CDP(ws);
      }
    } catch (e) {
      last = e.message;
    }
    await sleep(200);
  }
  throw new Error(`could not attach to Chrome on 127.0.0.1:${PORT} after 10s. Last error: ${last}`);
}

/** Poll a page-side predicate until it is true. Returns false on timeout. */
async function waitFor(cdp, expression, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await cdp.eval(`!!(${expression})`)) return true;
    if (Date.now() > deadline) {
      console.error(`  ! timed out waiting for ${label}`);
      return false;
    }
    await sleep(300);
  }
}

/* ------------------------------------------------------------------- main */
const cdp = await connect();
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: WIDTH, height: BASE_H, deviceScaleFactor: SCALE, mobile: false,
});

console.log(`==> ${URL_}`);
await cdp.send("Page.navigate", { url: URL_ });
await waitFor(cdp, `document.querySelectorAll('.nav__item').length > 0`, 30_000, "the console to render its nav");

// The console polls every 3s; one poll must have landed or every panel is empty.
await waitFor(cdp, `document.querySelectorAll('.view:not([hidden]) .card, .view:not([hidden]) table').length > 0`,
  30_000, "the first data refresh");

if (REQUIRE_ATTACKS) {
  const ok = await waitFor(
    cdp,
    `(() => { const c = document.querySelector('.nav__item[data-view="attacks"] .nav__count');
              return c && parseInt(c.textContent, 10) > 0; })()`,
    60_000,
    "at least one active attack",
  );
  if (!ok) {
    console.error("ERROR: no attack is active — the screenshots would show an idle console.");
    console.error("       Is flowinject running, and pointed at this engine's NetFlow port?");
    process.exit(2);
  }
}

// Dry-run must be visible. These screenshots go on a public page, and one that
// implies kapkan is dropping real traffic is a claim, not a picture. The one
// legitimate exception is a lab that is unmistakably a lab — synthetic TEST-NET
// (RFC 5737) victims, so no reader could take it for production — where the whole
// point is to show the data plane enforcing. That requires --allow-live, an
// explicit opt-in per run, so the safe default still protects every ordinary
// capture.
const ALLOW_LIVE = flag("allow-live");
const dryRun = await cdp.eval(`/dry.?run/i.test(document.body.innerText)`);
if (!dryRun && !ALLOW_LIVE) {
  console.error("ERROR: the console does not say DRY RUN anywhere.");
  console.error("       Refusing to publish screenshots that imply live mitigation. Check `dry_run: true`,");
  console.error("       or pass --allow-live for a deliberate lab capture against synthetic targets.");
  process.exit(3);
}
if (!dryRun && ALLOW_LIVE) {
  console.error("NOTE: --allow-live — capturing the console in LIVE (enforcing) mode.");
}

mkdirSync(OUT, { recursive: true });
const written = [];

for (const view of VIEWS) {
  const name = NAMES[view] ?? view;
  const exists = await cdp.eval(`!!document.querySelector('.nav__item[data-view="${view}"]')`);
  if (!exists) {
    console.error(`  ! no nav item for "${view}" — skipping`);
    continue;
  }
  // Measure at a deliberately over-tall viewport. `.app` is 100vh, so a view
  // shorter than the window cannot be measured by growing — `.main` simply
  // reports no overflow and the frame ends up padded with dead space. Laying it
  // out taller than it can possibly need means the content's own bottom edge is
  // the answer, whether the view is short or long.
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: MEASURE_H, deviceScaleFactor: 1, mobile: false });
  await cdp.eval(`document.querySelector('.nav__item[data-view="${view}"]').click()`);
  await sleep(SETTLE);

  const content = await cdp.eval(`(() => {
    const main = document.querySelector('.main');
    const active = document.querySelector('.view:not([hidden])');
    if (!main || !active) return null;
    main.scrollTop = 0;
    const pad = parseFloat(getComputedStyle(main).paddingBottom) || 0;
    return Math.ceil(active.getBoundingClientRect().bottom + pad);
  })()`);
  if (content === null) {
    console.error(`  ! "${view}" rendered no visible .view — skipping`);
    continue;
  }
  // Floor: a nearly-empty view should still look like a window, not a sliver —
  // and the sidebar needs room for its own nav. Ceiling: a runaway measurement
  // must not ask Chrome for a 40000px frame.
  const height = Math.min(Math.max(content, MIN_H), MAX_H);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height, deviceScaleFactor: SCALE, mobile: false });
  await sleep(400); // charts and load bars re-layout at the new height

  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: WIDTH, height, scale: 1 },
  });
  const file = join(OUT, `console-${name}.png`);
  writeFileSync(file, Buffer.from(data, "base64"));
  written.push({ view, file, css: `${WIDTH}x${height}`, px: `${WIDTH * SCALE}x${height * SCALE}` });
  console.log(`    ${view.padEnd(9)} -> console-${name}.png  ${WIDTH}x${height} css (${WIDTH * SCALE}x${height * SCALE} px)`);

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: BASE_H, deviceScaleFactor: SCALE, mobile: false });
}

// The site declares each image's intrinsic size in ConsoleShowcase.tsx; print
// the CSS sizes so a recapture that changes them is impossible to miss.
console.log("\n==> ConsoleShowcase.tsx sizes (w × h, CSS px):");
for (const w of written) console.log(`    ${w.view.padEnd(9)} w: ${w.css.split("x")[0]}, h: ${w.css.split("x")[1]}`);
process.exit(written.length === VIEWS.length ? 0 : 1);
