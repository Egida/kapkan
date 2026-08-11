// Copy for the dedicated in-kernel / XDP landing at /[lang]/xdp. Kept separate
// from landing-i18n.ts because this is a feature page, not the home page, and
// the two evolve independently. Technical terms (XDP, BGP, RTBH, FlowSpec, eBPF,
// bpffs, pps, Gbps, CAP_BPF) stay untranslated, as on the main landing.
//
// Embargo (engine/docs/dataplane-implementation-plan.md §9): capability language
// only. No "the only tool that detects and drops" — that waits for the scrub
// role (M4). No fleet/multi-node language. Every number here is from the
// committed pcap block-rate suite or the CI kernel matrix, nothing measured on a
// NIC, and the page says so.

import type { Locale } from "@/lib/i18n";

export type XdpDict = {
  meta: { title: string; description: string };
  nav: { docs: string; home: string; backToSite: string };
  hero: {
    eyebrow: string;
    h1a: string;
    h1b: string;
    sub: string;
    ctaDocs: string;
    ctaConfig: string;
    trust: string[];
    shotAlt: string;
    shotCaption: string;
  };
  // The "announce vs drop" contrast.
  contrast: {
    heading: string;
    sub: string;
    announce: { title: string; body: string; points: string[] };
    drop: { title: string; body: string; points: string[] };
  };
  how: {
    heading: string;
    sub: string;
    steps: { title: string; body: string }[];
    // Labels inside the inline-SVG pipeline diagram.
    diagram: { detect: string; compile: string; maps: string; verdict: string; pass: string; drop: string; caption: string };
  };
  ratelimit: { heading: string; body: string; aside: string };
  safety: {
    heading: string;
    sub: string;
    cards: { title: string; body: string }[];
  };
  measured: {
    heading: string;
    sub: string;
    stats: { value: string; label: string }[];
    caveat: string;
  };
  limits: {
    heading: string;
    sub: string;
    items: { title: string; body: string }[];
  };
  requirements: { heading: string; sub: string; items: string[] };
  showcaseCaption: string;
  cta: { heading: string; sub: string; primary: string; secondary: string };
};

const en: XdpDict = {
  meta: {
    title: "In-kernel XDP mitigation — Kapkan",
    description:
      "Kapkan compiles a detection into Linux kernel maps and drops the attack with an XDP program, before the packets reach the network stack — on hardware you already run. Per-source rate limiting, dry-run by default, and every rule expires inside the kernel.",
  },
  nav: { docs: "Data-plane docs", home: "Home", backToSite: "kapkan.io" },
  hero: {
    eyebrow: "In-kernel data plane",
    h1a: "Drop the attack",
    h1b: "in the kernel.",
    sub: "Every other way Kapkan stops an attack announces a route and asks a router to act on it. The data plane skips the ask. The same detection that would become a FlowSpec rule compiles into Linux kernel maps, and an XDP program drops the attack on the wire — before it reaches the network stack, on a box you already run.",
    ctaDocs: "Read the data-plane docs",
    ctaConfig: "Build a config",
    trust: ["Linux 5.15+", "Nothing to compile on the box", "Dry-run by default", "Rules expire in the kernel"],
    shotAlt: "Kapkan console: three active attacks, each mitigated by In-kernel drop (XDP)",
    shotCaption: "Three live detections, each dropped in the kernel — not announced to a router.",
  },
  contrast: {
    heading: "Announce, or drop.",
    sub: "Kapkan has always turned a detection into a BGP announcement — a blackhole route, or a surgical FlowSpec rule — and left the dropping to your routers. The data plane adds a second answer: do it yourself.",
    announce: {
      title: "Announce (RTBH / FlowSpec)",
      body: "Kapkan tells a router what to drop. The router does the work, wherever it sits in your network.",
      points: [
        "Reaches every prefix your routers carry, far upstream of any one box.",
        "Needs a router that speaks the protocol, and a session it trusts.",
        "FlowSpec matches headers; it cannot rate-limit each source separately.",
      ],
    },
    drop: {
      title: "Drop (in-kernel XDP)",
      body: "Kapkan drops the packet itself, in the kernel of the box running it, before the network stack sees it.",
      points: [
        "No router, no session, no protocol — the rule is a kernel map entry.",
        "Runs at the earliest point software can touch a packet: the driver's receive path.",
        "Gives each attacking source its own budget, which FlowSpec cannot express.",
      ],
    },
  },
  how: {
    heading: "From detection to dropped packet.",
    sub: "The data plane sits below the same seam every other mitigation uses, so a detection reaches it having already passed every safety check. What changes is the last step: instead of an announcement, the rules become kernel map entries.",
    steps: [
      {
        title: "The detector fires",
        body: "The same sampling-corrected thresholds, learned baselines and classifier as always. Nothing about detection changes because the mitigation does.",
      },
      {
        title: "Rules are generated",
        body: "The detection produces the very rules it would have announced as FlowSpec — victim-anchored, at most a handful per attack — through a second encoder instead of a BGP one.",
      },
      {
        title: "Maps are written",
        body: "The encoded rules are written into the XDP program's kernel maps, double-buffered so a reload swaps a whole generation atomically, with no window where traffic is unmatched.",
      },
      {
        title: "The kernel decides",
        body: "For every packet the program walks a fixed order — allow-list, static rules, victim match, per-source budget — and returns pass or drop. The default verdict is always pass.",
      },
    ],
    diagram: {
      detect: "Detection",
      compile: "Rule encoder",
      maps: "Kernel maps",
      verdict: "XDP program",
      pass: "PASS (default)",
      drop: "DROP (matched)",
      caption: "Every packet on the interface takes this path. Anything the rules do not match is passed, untouched.",
    },
  },
  ratelimit: {
    heading: "Per-source rate limiting — the thing FlowSpec cannot express.",
    body: "A FlowSpec rule matches a flow and drops it, or polices it to a single shared rate. It has no way to say “hold every individual source to N”. The data plane does: each attacking source gets its own token bucket in a kernel map. A limit of N holds each source to N, instead of letting a thousand sources and your legitimate clients fight over one aggregate ceiling.",
    aside: "This is the one capability that is not a faster version of something the announcer already did — it is something the announcer structurally could not do at all.",
  },
  safety: {
    heading: "Safe by construction.",
    sub: "The data plane inherits every safety property Kapkan already had, because it sits below the same seam — and adds one the kernel enforces on its own.",
    cards: [
      {
        title: "Dry-run is still the default",
        body: "Without flipping it live, the program attaches, matches and counts exactly as it would in production — but every drop verdict is rewritten to a pass. You see what it would do before it does anything.",
      },
      {
        title: "Rules expire inside the kernel",
        body: "Every generated rule carries its own deadline, and the program treats an expired rule as absent. A Kapkan that is killed, hung or restarted cannot leave a victim's traffic dropped: the kernel forgets on schedule, with no daemon in the loop.",
      },
      {
        title: "The whitelist is enforced in the kernel",
        body: "Your protected whitelist is matched in the program itself, on both the source and destination axes — so a protected host inside a carpet-banned prefix keeps receiving traffic, without a round-trip to userspace.",
      },
      {
        title: "The default verdict is pass",
        body: "Anything the rules do not explicitly match is forwarded. There is no default-deny hiding in a parser: even the one packet shape the program cannot fully inspect is passed and counted, not dropped.",
      },
    ],
  },
  measured: {
    heading: "Measured, not asserted.",
    sub: "Eighteen attack captures run end to end on every change — synthetic telemetry into the real detector, its generated rules compiled into real kernel maps, then the captured frames replayed through the program, with legitimate traffic interleaved throughout.",
    stats: [
      { value: "18", label: "attack captures, every build" },
      { value: "100%", label: "attack traffic dropped on 17 of 18 (98.5% on the per-source rate-limit capture)" },
      { value: "0", label: "legitimate frames dropped · 0 allow-listed frames dropped" },
      { value: "5.15–6.12", label: "kernels the full suite runs on in CI (5.15, 6.1, 6.6, 6.12)" },
    ],
    caveat:
      "These are block rates, not throughput. A block rate says what fraction of an attack the rules catch; it says nothing about how many packets a given box can absorb, which depends on your NIC, driver, CPU and whether the program attached in native or generic mode. Size a deployment on your own hardware.",
  },
  limits: {
    heading: "The honest limits.",
    sub: "Two things worth knowing before you deploy it, stated here rather than discovered later.",
    items: [
      {
        title: "One IPv6 packet shape is passed uninspected",
        body: "An IPv6 packet carrying more than eight extension headers is forwarded without a rule being evaluated — walking a longer chain would cost the program a kernel budget it does not have. This is deliberate: a parse limit that dropped packets would be a default-deny hiding in a parser. No legitimate traffic chains eight, so it is counted and surfaced — the CLI and console flag any movement on that counter — rather than buried.",
      },
      {
        title: "Native and generic attach differ in capacity",
        body: "On a driver with native XDP support the program runs in the driver's receive path, before an skb is built. Without it, the kernel falls back to generic mode, which is correct but does far less per core. Kapkan reports which mode each interface got; plan capacity around native, and treat generic as a working fallback, not the target.",
      },
    ],
  },
  requirements: {
    heading: "What it needs.",
    sub: "No agent, no sidecar, no compiler on the box. The program ships as verified bytecode inside the binary.",
    items: [
      "Linux 5.15 or newer, with BTF (CONFIG_DEBUG_INFO_BTF=y — every mainstream distro kernel has it).",
      "CAP_BPF and CAP_NET_ADMIN, and a writable bpffs at /sys/fs/bpf.",
      "An interface to attach to. Native XDP if the driver supports it; generic otherwise.",
      "Nothing to build. The XDP object is compiled ahead of time and embedded in the Kapkan binary.",
    ],
  },
  showcaseCaption:
    "The data-plane card in the console, live: the program attached to eth0, three detections installed as three kernel rules, and the map memory it reserved up front.",
  cta: {
    heading: "Drop it yourself.",
    sub: "Add a dataplane block, leave dry-run on, and watch what it would drop before it drops anything.",
    primary: "Read the data-plane docs",
    secondary: "Build a config",
  },
};

// Locale table. ru/de/fr/es are filled by the fan-out; until then they fall back
// to English so the routes never 404 (dynamicParams is false).
export const xdp: Record<Locale, XdpDict> = {
  en,
  ru: en,
  de: en,
  fr: en,
  es: en,
};
