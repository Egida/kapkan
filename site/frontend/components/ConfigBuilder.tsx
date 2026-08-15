"use client";

// Config builder v2: one sectioned page instead of a stepper. The generated
// YAML is always on screen (sticky right pane) with just-changed lines
// highlighted, and the wasm engine verdict is a permanent strip — not a
// last-step reveal. Sections follow the operator pipeline (telemetry →
// networks → detection → mitigation → bans → notify → api); each field shows
// a human label with the raw YAML key beside it, and rarely-needed fields sit
// in one collapsed "Advanced" group per section.
//
// Coverage: every top-level subsystem of the engine config is editable here.
// Per-hostgroup DEEP overrides (group-level bgp/baseline/flowspec/scrubbing/
// escalation/outgoing thresholds) are deliberately YAML-only — the group card
// covers the core (name, networks, calculation, ban, tenant, mitigation,
// thresholds); the engine accepts hand-added keys the form does not render.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import {
  wizardChrome,
  wizardHelp,
  wizardLabels,
  type SectionId,
  type WizardChrome,
} from "@/lib/wizard/strings";
import {
  emitConfig,
  emptyThresholds,
  initialState,
  THRESHOLD_KEYS,
  type ThresholdKey,
  type ThresholdSet,
  type WizardState,
} from "@/lib/wizard/emit";
import { fieldMeta, fieldNode } from "@/lib/wizard/schema";
import { validateNumber, validateString } from "@/lib/wizard/validate";
import { loadEngineValidator, type EngineResult, type EngineValidator } from "@/lib/wizard/wasm";
import {
  applyDiff,
  buildDiff,
  clearLocal,
  decodeShare,
  encodeDiff,
  loadLocal,
  saveLocal,
  type StateDiff,
} from "@/lib/wizard/share";
import { docToState, leafPaths } from "@/lib/wizard/import";

const inputCls =
  "w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent";
const cellCls =
  "w-full min-w-0 rounded-md border bg-background px-2 py-1.5 font-mono text-xs outline-none transition-colors focus:border-accent";
const miniBtnCls =
  "rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted";

// ---------------------------------------------------------------------------
// Field registry: one declaration drives both rendering and per-section error
// status. Order inside a section is render order; `advanced` fields collapse
// into the section's Advanced group; `showIf` gates fields behind a toggle.

type FieldKind =
  | "text"
  | "number"
  | "bool"
  | "select"
  | "list"
  | "csv"
  | "matrix"
  | "neighbors"
  | "method"
  | "boundary"
  | "escalation"
  | "hostgroups"
  | "scrubnodes"
  | "rlprofiles"
  | "staticrules"
  | "apitokens";

type SubheadKey = keyof WizardChrome["subheads"];

type FieldDef = {
  kind: FieldKind;
  key?: keyof WizardState;
  path: string;
  matrix?: "thr" | "thrOut" | "carpetThr";
  itemPath?: string; // csv: schema path used to validate each token
  required?: boolean;
  mono?: boolean;
  advanced?: boolean;
  subhead?: SubheadKey; // rendered before this field
  emptyOption?: boolean; // select: allow "" = engine default
  numericCsv?: boolean; // csv: tokens must be integers
  showIf?: (s: WizardState) => boolean;
};

const SECTION_IDS: SectionId[] = [
  "telemetry",
  "networks",
  "detection",
  "mitigation",
  "bans",
  "notify",
  "api",
];

const FIELDS: Record<SectionId, FieldDef[]> = {
  telemetry: [
    { kind: "text", key: "sflow", path: "listen.sflow", mono: true },
    { kind: "text", key: "netflow", path: "listen.netflow", mono: true },
    { kind: "number", key: "default_rate", path: "sampling.default_rate", required: true },
    { kind: "bool", key: "boundary_debug", path: "sampling.boundary_debug", advanced: true },
    { kind: "boundary", key: "boundary", path: "sampling.boundary", advanced: true },
    { kind: "list", key: "flow_sources", path: "flow_sources", advanced: true },
  ],
  networks: [
    { kind: "list", key: "networks", path: "networks" },
    { kind: "list", key: "whitelist", path: "protected_whitelist" },
    { kind: "hostgroups", key: "hostgroups", path: "hostgroups" },
    { kind: "text", key: "tenant", path: "tenant", advanced: true },
  ],
  detection: [
    { kind: "matrix", matrix: "thr", path: "thresholds", required: true },
    { kind: "matrix", matrix: "thrOut", path: "thresholds_outgoing", advanced: true },
    { kind: "bool", key: "baseline_on", path: "baseline.enabled", advanced: true, subhead: "baseline" },
    { kind: "number", key: "baseline_factor", path: "baseline.factor", advanced: true, showIf: (s) => s.baseline_on },
    { kind: "number", key: "baseline_half_life", path: "baseline.half_life_seconds", advanced: true, showIf: (s) => s.baseline_on },
    { kind: "number", key: "baseline_warmup", path: "baseline.warmup_seconds", advanced: true, showIf: (s) => s.baseline_on },
    { kind: "number", key: "baseline_floor_pps", path: "baseline.floor.pps", advanced: true, showIf: (s) => s.baseline_on },
    { kind: "number", key: "baseline_floor_mbps", path: "baseline.floor.mbps", advanced: true, showIf: (s) => s.baseline_on },
    { kind: "number", key: "baseline_floor_fps", path: "baseline.floor.flows_per_sec", advanced: true, showIf: (s) => s.baseline_on },
    { kind: "bool", key: "carpet_on", path: "carpet", advanced: true, subhead: "carpet" },
    { kind: "number", key: "carpet_v4", path: "carpet.aggregation_prefix_v4", advanced: true, showIf: (s) => s.carpet_on },
    { kind: "number", key: "carpet_v6", path: "carpet.aggregation_prefix_v6", advanced: true, showIf: (s) => s.carpet_on },
    { kind: "number", key: "carpet_min_hosts", path: "carpet.min_hosts", advanced: true, showIf: (s) => s.carpet_on },
    { kind: "matrix", matrix: "carpetThr", path: "carpet.thresholds", advanced: true, showIf: (s) => s.carpet_on },
    { kind: "select", key: "carpet_mitigation", path: "carpet.mitigation", advanced: true, emptyOption: true, showIf: (s) => s.carpet_on },
    { kind: "number", key: "carpet_max_bans", path: "carpet.max_active_prefix_bans", advanced: true, showIf: (s) => s.carpet_on },
    { kind: "bool", key: "samples_on", path: "samples", advanced: true, subhead: "samples" },
    { kind: "number", key: "samples_buffer", path: "samples.buffer_flows", advanced: true, showIf: (s) => s.samples_on },
    { kind: "number", key: "samples_per_attack", path: "samples.flows_per_attack", advanced: true, showIf: (s) => s.samples_on },
  ],
  mitigation: [
    { kind: "method", key: "mitigation", path: "mitigation", subhead: "method" },
    // (method-specific groups are rendered between `method` and the BGP core —
    // see METHOD_FIELDS below)
    { kind: "number", key: "local_asn", path: "bgp.local_asn", required: true, subhead: "bgp" },
    { kind: "text", key: "router_id", path: "bgp.router_id", required: true, mono: true },
    { kind: "text", key: "next_hop", path: "bgp.next_hop", required: true, mono: true },
    { kind: "text", key: "next_hop6", path: "bgp.next_hop6", mono: true },
    { kind: "text", key: "community", path: "bgp.community", required: true, mono: true },
    { kind: "neighbors", key: "neighbors", path: "bgp.neighbors" },
    { kind: "csv", key: "bgp_communities", path: "bgp.communities", itemPath: "bgp.communities", mono: true, advanced: true },
    { kind: "number", key: "bgp_listen_port", path: "bgp.listen_port", advanced: true },
    { kind: "number", key: "bgp_local_pref", path: "bgp.local_pref", advanced: true },
    { kind: "bool", key: "gr_enabled", path: "bgp.graceful_restart.enabled", advanced: true },
    { kind: "number", key: "gr_restart_seconds", path: "bgp.graceful_restart.restart_seconds", advanced: true },
    { kind: "bool", key: "gr_long_lived", path: "bgp.graceful_restart.long_lived", advanced: true },
    { kind: "number", key: "gr_long_lived_stale", path: "bgp.graceful_restart.long_lived_stale_seconds", advanced: true },
    { kind: "escalation", key: "escalation", path: "escalation", advanced: true, subhead: "escalation" },
  ],
  bans: [
    { kind: "number", key: "ttl_seconds", path: "ban.ttl_seconds", required: true },
    { kind: "number", key: "unban_hysteresis_seconds", path: "ban.unban_hysteresis_seconds", required: true },
    { kind: "number", key: "max_active_bans", path: "ban.max_active_bans", required: true },
    { kind: "select", key: "ban_fallback", path: "ban.fallback", advanced: true, emptyOption: true },
    { kind: "number", key: "ban_max_fraction", path: "ban.max_banned_fraction", advanced: true },
    { kind: "number", key: "ban_max_per_window", path: "ban.max_bans_per_window", advanced: true },
    { kind: "number", key: "ban_window_seconds", path: "ban.ban_window_seconds", advanced: true },
    { kind: "text", key: "state_file", path: "ban.state_file", mono: true, advanced: true },
  ],
  notify: [
    { kind: "text", key: "tg_token_env", path: "notify.telegram.token_env", mono: true, subhead: "telegram" },
    { kind: "text", key: "tg_chat_id", path: "notify.telegram.chat_id", mono: true },
    { kind: "text", key: "wh_url", path: "notify.webhook.url", mono: true },
    { kind: "text", key: "slack_url", path: "notify.slack.webhook_url", mono: true },
    { kind: "text", key: "email_smtp", path: "notify.email.smtp_host", mono: true, advanced: true, subhead: "email" },
    { kind: "text", key: "email_from", path: "notify.email.from", advanced: true },
    { kind: "csv", key: "email_to", path: "notify.email.to", advanced: true },
    { kind: "text", key: "email_user_env", path: "notify.email.username_env", mono: true, advanced: true },
    { kind: "text", key: "email_pass_env", path: "notify.email.password_env", mono: true, advanced: true },
    { kind: "bool", key: "email_tls", path: "notify.email.require_tls", advanced: true },
    { kind: "text", key: "exec_command", path: "notify.exec.command", mono: true, advanced: true, subhead: "exec" },
    { kind: "select", key: "exec_format", path: "notify.exec.format", advanced: true, emptyOption: true },
    { kind: "number", key: "exec_timeout", path: "notify.exec.timeout_seconds", advanced: true },
    { kind: "bool", key: "uc_enabled", path: "update_check.enabled", advanced: true, subhead: "updates" },
    { kind: "number", key: "uc_interval", path: "update_check.interval_seconds", advanced: true, showIf: (s) => s.uc_enabled },
    { kind: "select", key: "uc_channel", path: "update_check.channel", advanced: true, showIf: (s) => s.uc_enabled },
    { kind: "text", key: "uc_url", path: "update_check.url", mono: true, advanced: true, showIf: (s) => s.uc_enabled },
    { kind: "bool", key: "uc_notify", path: "update_check.notify", advanced: true, showIf: (s) => s.uc_enabled },
  ],
  api: [
    { kind: "text", key: "api_listen", path: "api.listen", required: true, mono: true },
    { kind: "bool", key: "api_dashboard", path: "api.dashboard" },
    { kind: "text", key: "api_token_env", path: "api.token_env", mono: true },
    { kind: "apitokens", key: "api_tokens", path: "api.tokens" },
    { kind: "text", key: "ch_url", path: "storage.clickhouse.url", mono: true, advanced: true, subhead: "storage" },
    { kind: "text", key: "ch_database", path: "storage.clickhouse.database", advanced: true, showIf: (s) => s.ch_url.trim() !== "" },
    { kind: "text", key: "ch_user_env", path: "storage.clickhouse.username_env", mono: true, advanced: true, showIf: (s) => s.ch_url.trim() !== "" },
    { kind: "text", key: "ch_pass_env", path: "storage.clickhouse.password_env", mono: true, advanced: true, showIf: (s) => s.ch_url.trim() !== "" },
    { kind: "number", key: "ch_ttl_days", path: "storage.clickhouse.ttl_days", advanced: true, showIf: (s) => s.ch_url.trim() !== "" },
    { kind: "number", key: "ch_flush", path: "storage.clickhouse.flush_interval_seconds", advanced: true, showIf: (s) => s.ch_url.trim() !== "" },
    { kind: "number", key: "ch_batch", path: "storage.clickhouse.batch_size", advanced: true, showIf: (s) => s.ch_url.trim() !== "" },
    { kind: "number", key: "ch_queue", path: "storage.clickhouse.queue_size", advanced: true, showIf: (s) => s.ch_url.trim() !== "" },
    { kind: "number", key: "ch_traffic", path: "storage.clickhouse.traffic_interval_seconds", advanced: true, showIf: (s) => s.ch_url.trim() !== "" },
    { kind: "bool", key: "geo_enabled", path: "geoip.enabled", advanced: true, subhead: "geoip" },
    { kind: "text", key: "geo_asn_db", path: "geoip.asn_database", mono: true, advanced: true, showIf: (s) => s.geo_enabled },
    { kind: "text", key: "geo_country_db", path: "geoip.country_database", mono: true, advanced: true, showIf: (s) => s.geo_enabled },
  ],
};

// Method-specific groups, rendered as auto-opening panels right under the
// method selector. Their errors count toward the mitigation section.
const METHOD_FIELDS: Record<"flowspec" | "scrubbing" | "dataplane", FieldDef[]> = {
  flowspec: [
    { kind: "select", key: "flowspec_action", path: "flowspec.action", emptyOption: true },
    { kind: "number", key: "flowspec_rate", path: "flowspec.rate_mbps" },
    { kind: "bool", key: "flowspec_anchored", path: "flowspec.source_anchored" },
    { kind: "number", key: "flowspec_minconc", path: "flowspec.min_source_concentration" },
  ],
  scrubbing: [
    { kind: "text", key: "scrub_next_hop", path: "scrubbing.next_hop", mono: true },
    { kind: "text", key: "scrub_next_hop6", path: "scrubbing.next_hop6", mono: true },
    { kind: "text", key: "scrub_community", path: "scrubbing.community", mono: true },
    { kind: "number", key: "scrub_local_pref", path: "scrubbing.local_pref" },
    { kind: "scrubnodes", key: "scrub_nodes", path: "scrubbing.nodes" },
    { kind: "select", key: "scrub_selection", path: "scrubbing.node_selection", emptyOption: true },
    { kind: "select", key: "scrub_on_lost", path: "scrubbing.on_all_nodes_lost", emptyOption: true },
    { kind: "number", key: "scrub_stale", path: "scrubbing.stale_after_seconds" },
  ],
  dataplane: [
    { kind: "bool", key: "dp_enabled", path: "dataplane.enabled" },
    { kind: "csv", key: "dp_interfaces", path: "dataplane.interfaces", mono: true },
    { kind: "select", key: "dp_xdp_mode", path: "dataplane.xdp_mode", emptyOption: true },
    { kind: "text", key: "dp_pin_path", path: "dataplane.pin_path", mono: true },
    { kind: "select", key: "dp_on_exit", path: "dataplane.on_exit", emptyOption: true },
    { kind: "bool", key: "dp_drop_malformed", path: "dataplane.drop_malformed" },
    { kind: "list", key: "dp_allowlist", path: "dataplane.allowlist" },
    { kind: "rlprofiles", key: "dp_profiles", path: "dataplane.ratelimit_profiles" },
    { kind: "staticrules", key: "dp_rules", path: "dataplane.static_rules" },
    { kind: "number", key: "dp_max_dynamic", path: "dataplane.limits.max_dynamic_rules" },
    { kind: "number", key: "dp_max_static", path: "dataplane.limits.max_static_rules" },
    { kind: "number", key: "dp_max_sources", path: "dataplane.limits.max_ratelimit_sources" },
  ],
};

// Best-effort map from an engine error's leading YAML path to the section that
// owns it, so the red verdict strip can jump to the right place.
const ERROR_SECTION: Array<[RegExp, SectionId]> = [
  [/^(listen|sampling|flow_sources)/, "telemetry"],
  [/^(networks|protected_whitelist|hostgroups|tenant)/, "networks"],
  [/^(thresholds|baseline|carpet|samples)/, "detection"],
  [/^(bgp|mitigation|flowspec|scrubbing|dataplane|escalation)/, "mitigation"],
  [/^ban\b|^ban[.:]/, "bans"],
  [/^(notify|update_check)/, "notify"],
  [/^(api|storage|geoip)/, "api"],
];

function guessErrorSection(err: string | undefined): SectionId | null {
  if (!err) return null;
  const head = err.trim();
  for (const [re, sec] of ERROR_SECTION) if (re.test(head)) return sec;
  return null;
}

const splitCsv = (v: string) => v.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);

// Applicability-named presets, stored as diffs over initialState (which IS the
// recommended hosting-edge baseline). Every preset must pass the engine check.
const PRESETS: Array<{ id: "edge" | "single" | "carrier"; diff: StateDiff }> = [
  { id: "edge", diff: {} },
  {
    id: "single",
    diff: {
      thr: { ...emptyThresholds(), pps: "20000", mbps: "500", flows_per_sec: "10000", udp_pps: "10000" },
      ttl_seconds: "300",
      max_active_bans: "10",
    },
  },
  {
    id: "carrier",
    diff: {
      thr: { ...emptyThresholds(), pps: "200000", mbps: "5000", flows_per_sec: "80000" },
      carpet_on: true,
      carpet_min_hosts: "10",
      carpetThr: { ...emptyThresholds(), pps: "2000000", mbps: "20000" },
      samples_on: true,
    },
  },
];

// Flat def list with owning section/panel — drives search and the modified count.
type SearchEntry = { f: FieldDef; section: SectionId; group?: "flowspec" | "scrubbing" | "dataplane" };
const ALL_DEFS: SearchEntry[] = [
  ...SECTION_IDS.flatMap((id) => FIELDS[id].map((f) => ({ f, section: id }))),
  ...(Object.keys(METHOD_FIELDS) as Array<keyof typeof METHOD_FIELDS>).flatMap((g) =>
    METHOD_FIELDS[g].map((f) => ({ f, section: "mitigation" as SectionId, group: g })),
  ),
];

// Module-level on purpose: defining this inside ConfigBuilder would give it a
// new component identity every render, remounting the subtree and dropping
// input focus on each keystroke.
function FieldShell({
  f,
  label,
  help,
  gloss,
  error,
  modified,
  onReset,
  resetTitle,
  children,
}: {
  f: FieldDef;
  label: string;
  help?: string;
  gloss?: string | null;
  error: string | null;
  modified?: boolean;
  onReset?: () => void;
  resetTitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`-ml-3 border-l-2 pl-3 ${modified ? "border-accent/60" : "border-transparent"}`}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <label htmlFor={`f-${f.path}`} className="text-sm font-medium">
          {label}
        </label>
        <span className="flex shrink-0 items-baseline gap-2">
          {modified && onReset && (
            <button
              type="button"
              title={resetTitle}
              aria-label={resetTitle}
              onClick={onReset}
              className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
            >
              ↺
            </button>
          )}
          <code className="font-mono text-[11px] text-muted-foreground/80">{f.path}</code>
        </span>
      </div>
      {children}
      <div className="mt-1 flex items-baseline justify-between gap-3">
        {error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{help}</p>
        )}
        {gloss && <span className="shrink-0 text-xs font-medium text-muted-foreground">{gloss}</span>}
      </div>
    </div>
  );
}

export function ConfigBuilder({ lang }: { lang: Locale }) {
  const t = wizardChrome[lang];
  const vmsg = t.validation;
  const labelOf = (path: string): string =>
    wizardLabels[lang]?.[path] ?? wizardLabels.en[path] ?? path;
  const helpOf = (path?: string): string | undefined =>
    path ? (wizardHelp[lang]?.[path] ?? fieldMeta(path).description) : undefined;

  const [s, setS] = useState<WizardState>(initialState);
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState<SectionId>("telemetry");
  // per-method-group manual open override; null = follow the active method
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean | null>>({
    flowspec: null,
    scrubbing: null,
    dataplane: null,
  });
  // stage-3 service layer
  const [filterModified, setFilterModified] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importDiag, setImportDiag] = useState<{ lost: string[]; error?: string } | null>(null);
  const [shared, setShared] = useState(false);
  const [flashPath, setFlashPath] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const restoredRef = useRef(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore once: a share link wins over the local autosave.
  useEffect(() => {
    try {
      const m = window.location.hash.match(/^#s=(.+)$/);
      const diff = m ? decodeShare(m[1]) : loadLocal();
      if (diff && Object.keys(diff).length > 0) {
        // One-time mount restore of saved/shared work.
        setS(applyDiff(diff));
      }
    } finally {
      restoredRef.current = true;
    }
  }, []);

  // Autosave + keep the URL shareable: both store the diff vs defaults.
  useEffect(() => {
    if (!restoredRef.current) return;
    const id = setTimeout(() => {
      const diff = buildDiff(s);
      saveLocal(diff);
      const hash = Object.keys(diff).length > 0 ? "#s=" + encodeDiff(diff) : "";
      window.history.replaceState(null, "", window.location.pathname + window.location.search + hash);
    }, 500);
    return () => clearTimeout(id);
  }, [s]);

  const yaml = useMemo(() => emitConfig(s), [s]);
  const yamlLines = useMemo(() => yaml.split("\n"), [yaml]);

  // --- just-changed line highlighting: compare against the previous emit as a
  // multiset, so unchanged-but-shifted lines don't flash.
  const prevLinesRef = useRef<string[] | null>(null);
  const [hotLines, setHotLines] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    const prev = prevLinesRef.current;
    prevLinesRef.current = yamlLines;
    if (!prev) return;
    const pool = new Map<string, number>();
    for (const l of prev) pool.set(l, (pool.get(l) ?? 0) + 1);
    const fresh = new Set<number>();
    yamlLines.forEach((l, i) => {
      const n = pool.get(l) ?? 0;
      if (n > 0) pool.set(l, n - 1);
      else fresh.add(i);
    });
    if (fresh.size === 0) return;
    // Intentional one-frame visual pulse: flag the just-changed lines, then fade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHotLines(fresh);
    const id = setTimeout(() => setHotLines(new Set()), 1400);
    return () => clearTimeout(id);
  }, [yamlLines]);

  // --- engine-exact validation via the wasm build of the real Parse+validate.
  const validatorRef = useRef<EngineValidator | null>(null);
  const [engineReady, setEngineReady] = useState<boolean | null>(null);
  const [engineResult, setEngineResult] = useState<EngineResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadEngineValidator().then((fn) => {
      if (cancelled) return;
      validatorRef.current = fn;
      setEngineReady(!!fn);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const fn = validatorRef.current;
    if (!fn) return;
    const id = setTimeout(() => {
      try {
        setEngineResult(fn(yaml));
      } catch {
        setEngineResult(null);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [yaml, engineReady]);

  // --- scrollspy for the section rail.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id.slice(4) as SectionId);
      },
      { rootMargin: "-160px 0px -55% 0px", threshold: 0 },
    );
    for (const id of SECTION_IDS) {
      const el = document.getElementById(`sec-${id}`);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, []);

  function set<K extends keyof WizardState>(k: K, v: WizardState[K]) {
    setS((p) => ({ ...p, [k]: v }));
  }

  function scrollToSection(id: SectionId) {
    setActive(id);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(`sec-${id}`)
      ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  function copy() {
    navigator.clipboard?.writeText(yaml).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function download() {
    const blob = new Blob([yaml], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "config.yaml";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Which mitigation methods the config actually uses (method, escalation
  // rungs, hostgroup overrides, carpet) — drives the auto-open method panels.
  const usesAction = (a: string) =>
    s.mitigation === a ||
    s.escalation.some((e) => e.action === a) ||
    s.hostgroups.some((g) => g.mitigation === a) ||
    s.carpet_mitigation === a;
  const methodAuto: Record<"flowspec" | "scrubbing" | "dataplane", boolean> = {
    flowspec: usesAction("flowspec"),
    scrubbing: usesAction("divert"),
    dataplane: usesAction("dataplane") || s.dp_enabled,
  };

  // --- per-field validation, shared by the renderers and the section dots.
  function matrixError(f: FieldDef): string | null {
    const val = s[f.matrix!] as ThresholdSet;
    for (const k of THRESHOLD_KEYS) {
      const raw = val[k].trim();
      if (f.required && f.matrix === "thr" && (k === "pps" || k === "mbps" || k === "flows_per_sec")) {
        if (raw === "") return vmsg.required;
      }
      if (raw === "") continue;
      const err = validateNumber(`${f.path}.${k}`, Number(raw), vmsg);
      if (err) return err;
    }
    return null;
  }

  function fieldError(f: FieldDef): string | null {
    if (f.showIf && !f.showIf(s)) return null;
    switch (f.kind) {
      case "text": {
        const v = s[f.key!] as string;
        if (v.trim() === "") return f.required ? vmsg.required : null;
        return validateString(f.path, v, vmsg);
      }
      case "number": {
        const v = s[f.key!] as string;
        if (v.trim() === "") return f.required ? vmsg.required : null;
        return validateNumber(f.path, Number(v), vmsg);
      }
      case "list": {
        for (const item of s[f.key!] as string[]) {
          if (!item.trim()) continue;
          const err = validateString(f.path, item, vmsg);
          if (err) return err;
        }
        return null;
      }
      case "csv": {
        for (const token of splitCsv(s[f.key!] as string)) {
          if (f.numericCsv) {
            if (!/^\d+$/.test(token)) return vmsg.notNumber;
            continue;
          }
          const err = f.itemPath ? validateString(f.itemPath, token, vmsg) : null;
          if (err) return err;
        }
        return null;
      }
      case "matrix":
        return matrixError(f);
      case "neighbors": {
        for (const n of s.neighbors) {
          if (n.address.trim()) {
            const err = validateString("bgp.neighbors.address", n.address, vmsg);
            if (err) return err;
          }
          if (n.remote_asn.trim()) {
            const err = validateNumber("bgp.neighbors.remote_asn", Number(n.remote_asn), vmsg);
            if (err) return err;
          }
          if (n.port.trim()) {
            const err = validateNumber("bgp.neighbors.port", Number(n.port), vmsg);
            if (err) return err;
          }
        }
        return null;
      }
      case "boundary": {
        for (const b of s.boundary) {
          if (b.exporter.trim()) {
            const err = validateString("sampling.boundary.exporter", b.exporter, vmsg);
            if (err) return err;
          }
          for (const token of splitCsv(b.external_ifindexes)) {
            if (!/^\d+$/.test(token)) return vmsg.notNumber;
          }
        }
        return null;
      }
      case "escalation": {
        for (const e of s.escalation) {
          if (e.after_seconds.trim()) {
            const err = validateNumber("escalation.after_seconds", Number(e.after_seconds), vmsg);
            if (err) return err;
          }
          if (e.action) {
            const err = validateString("escalation.action", e.action, vmsg);
            if (err) return err;
          }
        }
        return null;
      }
      case "hostgroups": {
        for (const g of s.hostgroups) {
          if (g.name.trim()) {
            const err = validateString("hostgroups.name", g.name, vmsg);
            if (err) return err;
          }
          for (const net of splitCsv(g.networks)) {
            const err = validateString("hostgroups.networks", net, vmsg);
            if (err) return err;
          }
          for (const k of THRESHOLD_KEYS) {
            const raw = g.thr[k].trim();
            if (raw === "") continue;
            const err = validateNumber(`hostgroups.thresholds.${k}`, Number(raw), vmsg);
            if (err) return err;
          }
        }
        return null;
      }
      case "scrubnodes": {
        for (const n of s.scrub_nodes) {
          if (n.next_hop.trim()) {
            const err = validateString("scrubbing.nodes.next_hop", n.next_hop, vmsg);
            if (err) return err;
          }
          if (n.next_hop6.trim()) {
            const err = validateString("scrubbing.nodes.next_hop6", n.next_hop6, vmsg);
            if (err) return err;
          }
          if (n.capacity_mbps.trim()) {
            const err = validateNumber("scrubbing.nodes.capacity_mbps", Number(n.capacity_mbps), vmsg);
            if (err) return err;
          }
        }
        return null;
      }
      case "rlprofiles": {
        for (const p of s.dp_profiles) {
          if (p.name.trim()) {
            const err = validateString("dataplane.ratelimit_profiles.name", p.name, vmsg);
            if (err) return err;
          }
          for (const [path, v] of [
            ["dataplane.ratelimit_profiles.pps", p.pps],
            ["dataplane.ratelimit_profiles.mbps", p.mbps],
          ] as const) {
            if (v.trim()) {
              const err = validateNumber(path, Number(v), vmsg);
              if (err) return err;
            }
          }
        }
        return null;
      }
      case "staticrules": {
        for (const r of s.dp_rules) {
          if (r.name.trim()) {
            const err = validateString("dataplane.static_rules.name", r.name, vmsg);
            if (err) return err;
          }
          if (r.src.trim()) {
            const err = validateString("dataplane.static_rules.match.src", r.src, vmsg);
            if (err) return err;
          }
          if (r.proto) {
            const err = validateString("dataplane.static_rules.match.proto", r.proto, vmsg);
            if (err) return err;
          }
          for (const [path, v] of [
            ["dataplane.static_rules.match.src_port", r.src_port],
            ["dataplane.static_rules.match.dst_port", r.dst_port],
          ] as const) {
            if (v.trim()) {
              const err = validateNumber(path, Number(v), vmsg);
              if (err) return err;
            }
          }
        }
        return null;
      }
      case "apitokens": {
        for (const tk of s.api_tokens) {
          if (tk.name.trim()) {
            const err = validateString("api.tokens.name", tk.name, vmsg);
            if (err) return err;
          }
          if (tk.role) {
            const err = validateString("api.tokens.role", tk.role, vmsg);
            if (err) return err;
          }
        }
        return null;
      }
      default:
        return null;
    }
  }

  const sectionErrors = useMemo(() => {
    const out = {} as Record<SectionId, number>;
    for (const id of SECTION_IDS) {
      out[id] = FIELDS[id].reduce((n, f) => n + (fieldError(f) ? 1 : 0), 0);
    }
    for (const defs of Object.values(METHOD_FIELDS)) {
      out.mitigation += defs.reduce((n, f) => n + (fieldError(f) ? 1 : 0), 0);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, vmsg]);
  const totalErrors = SECTION_IDS.reduce((n, id) => n + sectionErrors[id], 0);
  const firstErrorSection = SECTION_IDS.find((id) => sectionErrors[id] > 0) ?? null;

  // --- modified-vs-default tracking (the VS Code @modified pattern) ---
  const fieldSlice = (st: WizardState, f: FieldDef): unknown =>
    f.matrix ? st[f.matrix] : f.key ? st[f.key] : undefined;
  const fieldModified = (f: FieldDef): boolean =>
    JSON.stringify(fieldSlice(s, f)) !== JSON.stringify(fieldSlice(initialState, f));
  function resetField(f: FieldDef) {
    if (f.matrix) set(f.matrix, JSON.parse(JSON.stringify(initialState[f.matrix])));
    else if (f.key) set(f.key, JSON.parse(JSON.stringify(initialState[f.key])) as WizardState[keyof WizardState]);
  }
  const modifiedCount = ALL_DEFS.reduce((n, e) => n + (fieldModified(e.f) ? 1 : 0), 0);

  function applyPreset(diff: StateDiff) {
    if (modifiedCount > 0 && !window.confirm(t.presets.confirm)) return;
    setS(applyDiff(diff));
    setImportDiag(null);
  }

  function resetAll() {
    if (modifiedCount > 0 && !window.confirm(t.reset.confirm)) return;
    clearLocal();
    setS(JSON.parse(JSON.stringify(initialState)));
    setImportDiag(null);
    setFilterModified(false);
  }

  function shareLink() {
    const diff = buildDiff(s);
    const hash = Object.keys(diff).length > 0 ? "#s=" + encodeDiff(diff) : "";
    const url = window.location.origin + window.location.pathname + window.location.search + hash;
    navigator.clipboard?.writeText(url).then(() => {
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    });
  }

  async function doImport() {
    try {
      const { load } = await import("js-yaml");
      const doc = load(importText);
      if (!doc || typeof doc !== "object") throw new Error("not a YAML mapping");
      const next = docToState(doc);
      const emitted = load(emitConfig(next));
      const emittedLeaves = new Set(leafPaths(emitted));
      const lost = [...new Set(leafPaths(doc).filter((p) => !emittedLeaves.has(p)))];
      setS(next);
      setImportDiag({ lost });
      setFilterModified(false);
    } catch (e) {
      setImportDiag({ lost: [], error: e instanceof Error ? e.message : String(e) });
    }
  }

  function copyCmd(cmd: string) {
    navigator.clipboard?.writeText(cmd).then(() => {
      setCopiedCmd(cmd);
      setTimeout(() => setCopiedCmd(null), 1500);
    });
  }

  // Search across labels, YAML keys and help text; jump opens whatever hides
  // the field (advanced <details>, a method panel) and flashes it.
  const searchResults = (() => {
    const q = searchQ.trim().toLowerCase();
    if (!q || !searchFocus) return [];
    return ALL_DEFS.map((entry) => {
      const label = labelOf(entry.f.path).toLowerCase();
      const path = entry.f.path.toLowerCase();
      const help = (helpOf(entry.f.path) ?? "").toLowerCase();
      const score = label.startsWith(q) ? 0 : label.includes(q) ? 1 : path.includes(q) ? 2 : help.includes(q) ? 3 : -1;
      return { entry, score };
    })
      .filter((x) => x.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 12)
      .map((x) => x.entry);
  })();

  function jumpToField(entry: SearchEntry) {
    setSearchQ("");
    setSearchFocus(false);
    if (entry.group) setGroupOpen((p) => ({ ...p, [entry.group as string]: true }));
    if (filterModified && !fieldModified(entry.f)) setFilterModified(false);
    setFlashPath(entry.f.path);
    setTimeout(() => {
      const el = document.getElementById(`fw-${entry.f.path}`);
      let d = el?.closest("details");
      while (d) {
        d.open = true;
        d = d.parentElement?.closest("details") ?? null;
      }
      const target = el ?? document.getElementById(`sec-${entry.section}`);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    }, 60);
    setTimeout(() => setFlashPath(null), 1800);
  }

  // Human gloss for *_seconds fields: "600" → "≈ 10 min".
  function secondsGloss(f: FieldDef): string | null {
    if (f.kind !== "number" || !f.path.endsWith("_seconds")) return null;
    const n = Number((s[f.key!] as string).trim());
    if (!Number.isFinite(n) || n < 120) return null;
    if (n >= 5400) return t.hours.replace("{v}", (Math.round((n / 3600) * 10) / 10).toString());
    return t.minutes.replace("{v}", Math.round(n / 60).toString());
  }

  // ------------------------------------------------------------------ fields

  const shellProps = (f: FieldDef) => {
    const modified = fieldModified(f);
    return {
      f,
      label: labelOf(f.path),
      help: helpOf(f.path),
      gloss: secondsGloss(f),
      modified,
      onReset: modified ? () => resetField(f) : undefined,
      resetTitle: t.reset.btn,
    };
  };

  function renderText(f: FieldDef) {
    const value = s[f.key!] as string;
    return (
      <FieldShell key={f.path} {...shellProps(f)} error={fieldError(f)}>
        <input
          id={`f-${f.path}`}
          className={`${inputCls}${f.mono ? " font-mono" : ""}`}
          value={value}
          spellCheck={false}
          onChange={(e) => set(f.key!, e.target.value as WizardState[typeof f.key & keyof WizardState])}
        />
      </FieldShell>
    );
  }

  function renderNumber(f: FieldDef) {
    const value = s[f.key!] as string;
    return (
      <FieldShell key={f.path} {...shellProps(f)} error={fieldError(f)}>
        <input
          id={`f-${f.path}`}
          className={`${inputCls} font-mono`}
          inputMode="numeric"
          value={value}
          spellCheck={false}
          onChange={(e) => set(f.key!, e.target.value as WizardState[typeof f.key & keyof WizardState])}
        />
      </FieldShell>
    );
  }

  function renderCsv(f: FieldDef) {
    const value = s[f.key!] as string;
    return (
      <FieldShell key={f.path} {...shellProps(f)} error={fieldError(f)}>
        <input
          id={`f-${f.path}`}
          className={`${inputCls}${f.mono ? " font-mono" : ""}`}
          value={value}
          spellCheck={false}
          placeholder="a, b, c"
          onChange={(e) => set(f.key!, e.target.value as WizardState[typeof f.key & keyof WizardState])}
        />
      </FieldShell>
    );
  }

  function renderBool(f: FieldDef) {
    const modified = fieldModified(f);
    return (
      <div key={f.path} className={`-ml-3 border-l-2 pl-3 ${modified ? "border-accent/60" : "border-transparent"}`}>
        <div className="flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={s[f.key!] as boolean}
              onChange={(e) => set(f.key!, e.target.checked as WizardState[typeof f.key & keyof WizardState])}
            />
            <span>{labelOf(f.path)}</span>
          </label>
          <span className="flex shrink-0 items-baseline gap-2">
            {modified && (
              <button
                type="button"
                title={t.reset.btn}
                aria-label={t.reset.btn}
                onClick={() => resetField(f)}
                className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
              >
                ↺
              </button>
            )}
            <code className="font-mono text-[11px] text-muted-foreground/80">{f.path}</code>
          </span>
        </div>
        <p className="mt-1 pl-7 text-xs text-muted-foreground">{helpOf(f.path)}</p>
      </div>
    );
  }

  function renderSelect(f: FieldDef) {
    const opts = fieldNode(f.path)?.enum ?? [];
    return (
      <FieldShell key={f.path} {...shellProps(f)} error={fieldError(f)}>
        <select
          id={`f-${f.path}`}
          className={inputCls}
          value={s[f.key!] as string}
          onChange={(e) => set(f.key!, e.target.value as WizardState[typeof f.key & keyof WizardState])}
        >
          {f.emptyOption && <option value="">—</option>}
          {opts.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </FieldShell>
    );
  }

  function renderList(f: FieldDef) {
    const values = s[f.key!] as string[];
    const key = f.key as "networks" | "whitelist" | "flow_sources" | "dp_allowlist";
    return (
      <FieldShell key={f.path} {...shellProps(f)} error={null}>
        <div className="space-y-2">
          {values.map((v, i) => {
            const err = v.trim() ? validateString(f.path, v, vmsg) : null;
            return (
              <div key={i}>
                <div className="flex gap-2">
                  <input
                    className={`${inputCls} font-mono`}
                    value={v}
                    spellCheck={false}
                    onChange={(e) => {
                      const next = values.slice();
                      next[i] = e.target.value;
                      set(key, next);
                    }}
                  />
                  <button
                    type="button"
                    aria-label="remove"
                    className="shrink-0 rounded-md border border-border px-3 text-muted-foreground hover:bg-muted"
                    onClick={() => set(key, values.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </div>
                {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
              </div>
            );
          })}
          <button type="button" className={miniBtnCls} onClick={() => set(key, [...values, ""])}>
            {t.addItem}
          </button>
        </div>
      </FieldShell>
    );
  }

  function renderMatrix(f: FieldDef) {
    const mkey = f.matrix!;
    const val = s[mkey] as ThresholdSet;
    const upd = (k: ThresholdKey, v: string) =>
      set(mkey, { ...val, [k]: v } as WizardState[typeof mkey]);
    const rows: Array<{ label: string; pps: ThresholdKey; mbps: ThresholdKey }> = [
      { label: t.thr.total, pps: "pps", mbps: "mbps" },
      { label: t.thr.tcp, pps: "tcp_pps", mbps: "tcp_mbps" },
      { label: t.thr.tcpSyn, pps: "tcp_syn_pps", mbps: "tcp_syn_mbps" },
      { label: t.thr.udp, pps: "udp_pps", mbps: "udp_mbps" },
      { label: t.thr.icmp, pps: "icmp_pps", mbps: "icmp_mbps" },
      { label: t.thr.frag, pps: "frag_pps", mbps: "frag_mbps" },
    ];
    const err = matrixError(f);
    const cell = (k: ThresholdKey) => {
      const raw = val[k].trim();
      const bad =
        (raw !== "" && validateNumber(`${f.path}.${k}`, Number(raw), vmsg) !== null) ||
        (f.required && f.matrix === "thr" && raw === "" &&
          (k === "pps" || k === "mbps" || k === "flows_per_sec"));
      return (
        <input
          aria-label={`${f.path}.${k}`}
          className={`${cellCls} ${bad ? "border-red-500" : "border-border"}`}
          inputMode="numeric"
          value={val[k]}
          spellCheck={false}
          onChange={(e) => upd(k, e.target.value)}
        />
      );
    };
    return (
      <FieldShell key={f.path} {...shellProps(f)} error={err}>
        <div className="overflow-x-auto">
          <div className="grid min-w-[320px] grid-cols-[minmax(90px,auto)_1fr_1fr] items-center gap-x-2 gap-y-1.5">
            <span />
            <span className="font-mono text-[11px] text-muted-foreground">pps</span>
            <span className="font-mono text-[11px] text-muted-foreground">mbps</span>
            {rows.map((r) => (
              <div key={r.pps} className="contents">
                <span className="text-xs text-muted-foreground">{r.label}</span>
                {cell(r.pps)}
                {cell(r.mbps)}
              </div>
            ))}
            <span className="text-xs text-muted-foreground">{t.thr.flows}</span>
            {cell("flows_per_sec")}
            <span />
          </div>
        </div>
        {!err && <p className="mt-1 text-[11px] text-muted-foreground/80">{t.thr.hint}</p>}
      </FieldShell>
    );
  }

  // Small building blocks for the repeatable-row editors.
  function rowShell(children: React.ReactNode, onRemove: () => void, key: number) {
    return (
      <div key={key} className="rounded-md border border-border p-3">
        <div className="flex flex-wrap items-start gap-2">
          {children}
          <button
            type="button"
            aria-label="remove"
            className="ml-auto shrink-0 rounded-md border border-border px-3 py-1.5 text-muted-foreground hover:bg-muted"
            onClick={onRemove}
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  function rowInput(opts: {
    value: string;
    placeholder: string;
    onChange: (v: string) => void;
    width?: string;
    numeric?: boolean;
    error?: string | null;
  }) {
    return (
      <div className={opts.width ?? "w-32"}>
        <input
          className={`${cellCls} ${opts.error ? "border-red-500" : "border-border"}`}
          value={opts.value}
          placeholder={opts.placeholder}
          spellCheck={false}
          inputMode={opts.numeric ? "numeric" : undefined}
          onChange={(e) => opts.onChange(e.target.value)}
        />
      </div>
    );
  }

  function rowSelect(opts: {
    value: string;
    path: string;
    onChange: (v: string) => void;
    width?: string;
    emptyLabel?: string;
  }) {
    const enumOpts = fieldNode(opts.path)?.enum ?? [];
    return (
      <select
        className={`${cellCls} border-border ${opts.width ?? "w-28"}`}
        value={opts.value}
        aria-label={opts.path}
        onChange={(e) => opts.onChange(e.target.value)}
      >
        <option value="">{opts.emptyLabel ?? "—"}</option>
        {enumOpts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  function renderNeighbors(f: FieldDef) {
    const updRow = (i: number, patch: Partial<(typeof s.neighbors)[number]>) => {
      const next = s.neighbors.slice();
      next[i] = { ...next[i], ...patch };
      set("neighbors", next);
    };
    return (
      <FieldShell key={f.path} {...shellProps(f)} error={fieldError(f)}>
        <div className="space-y-2">
          {s.neighbors.map((n, i) =>
            rowShell(
              <>
                {rowInput({ value: n.address, placeholder: "address", width: "w-44 grow", onChange: (v) => updRow(i, { address: v }) })}
                {rowInput({ value: n.remote_asn, placeholder: "remote_asn", numeric: true, width: "w-28", onChange: (v) => updRow(i, { remote_asn: v }) })}
                {rowInput({ value: n.port, placeholder: "port", numeric: true, width: "w-20", onChange: (v) => updRow(i, { port: v }) })}
              </>,
              () => set("neighbors", s.neighbors.filter((_, j) => j !== i)),
              i,
            ),
          )}
          <button
            type="button"
            className={miniBtnCls}
            onClick={() => set("neighbors", [...s.neighbors, { address: "", remote_asn: "", port: "" }])}
          >
            {t.addNeighbor}
          </button>
        </div>
      </FieldShell>
    );
  }

  function renderBoundary(f: FieldDef) {
    const updRow = (i: number, patch: Partial<(typeof s.boundary)[number]>) => {
      const next = s.boundary.slice();
      next[i] = { ...next[i], ...patch };
      set("boundary", next);
    };
    return (
      <FieldShell key={f.path} {...shellProps(f)} error={fieldError(f)}>
        <div className="space-y-2">
          {s.boundary.map((b, i) =>
            rowShell(
              <>
                {rowInput({ value: b.exporter, placeholder: "exporter", width: "w-40 grow", onChange: (v) => updRow(i, { exporter: v }) })}
                {rowInput({ value: b.external_ifindexes, placeholder: "external_ifindexes", width: "w-44", onChange: (v) => updRow(i, { external_ifindexes: v }) })}
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--accent)]"
                    checked={b.egress_sampling}
                    onChange={(e) => updRow(i, { egress_sampling: e.target.checked })}
                  />
                  egress_sampling
                </label>
              </>,
              () => set("boundary", s.boundary.filter((_, j) => j !== i)),
              i,
            ),
          )}
          <button
            type="button"
            className={miniBtnCls}
            onClick={() =>
              set("boundary", [...s.boundary, { exporter: "", external_ifindexes: "", egress_sampling: false }])
            }
          >
            {t.addItem}
          </button>
        </div>
      </FieldShell>
    );
  }

  function renderEscalation(f: FieldDef) {
    const updRow = (i: number, patch: Partial<(typeof s.escalation)[number]>) => {
      const next = s.escalation.slice();
      next[i] = { ...next[i], ...patch };
      set("escalation", next);
    };
    return (
      <FieldShell key={f.path} {...shellProps(f)} error={fieldError(f)}>
        <div className="space-y-2">
          {s.escalation.map((e, i) =>
            rowShell(
              <>
                {rowInput({ value: e.after_seconds, placeholder: "after_seconds", numeric: true, width: "w-32", onChange: (v) => updRow(i, { after_seconds: v }) })}
                {rowSelect({ value: e.action, path: "escalation.action", width: "w-36", onChange: (v) => updRow(i, { action: v }) })}
              </>,
              () => set("escalation", s.escalation.filter((_, j) => j !== i)),
              i,
            ),
          )}
          <button
            type="button"
            className={miniBtnCls}
            onClick={() =>
              set("escalation", [
                ...s.escalation,
                { after_seconds: s.escalation.length === 0 ? "0" : "", action: "" },
              ])
            }
          >
            {t.addItem}
          </button>
        </div>
      </FieldShell>
    );
  }

  function renderHostgroups(f: FieldDef) {
    const updRow = (i: number, patch: Partial<(typeof s.hostgroups)[number]>) => {
      const next = s.hostgroups.slice();
      next[i] = { ...next[i], ...patch };
      set("hostgroups", next);
    };
    return (
      <FieldShell key={f.path} {...shellProps(f)} error={fieldError(f)}>
        <div className="space-y-3">
          {s.hostgroups.map((g, i) => (
            <div key={i} className="space-y-2 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-start gap-2">
                {rowInput({ value: g.name, placeholder: "name", width: "w-36", onChange: (v) => updRow(i, { name: v }) })}
                {rowInput({ value: g.networks, placeholder: "networks (CIDR, CIDR…)", width: "w-56 grow", onChange: (v) => updRow(i, { networks: v }) })}
                {rowSelect({ value: g.calculation, path: "hostgroups.calculation", width: "w-28", onChange: (v) => updRow(i, { calculation: v }) })}
                {rowSelect({ value: g.mitigation, path: "hostgroups.mitigation", width: "w-32", onChange: (v) => updRow(i, { mitigation: v }) })}
                {rowInput({ value: g.tenant, placeholder: "tenant", width: "w-28", onChange: (v) => updRow(i, { tenant: v }) })}
                <label className="flex items-center gap-2 py-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--accent)]"
                    checked={g.ban}
                    onChange={(e) => updRow(i, { ban: e.target.checked })}
                  />
                  ban
                </label>
                <button
                  type="button"
                  aria-label="remove"
                  className="ml-auto shrink-0 rounded-md border border-border px-3 py-1.5 text-muted-foreground hover:bg-muted"
                  onClick={() => set("hostgroups", s.hostgroups.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
              <details>
                <summary className="cursor-pointer list-none text-xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                  ▸ {labelOf("thresholds")}
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {THRESHOLD_KEYS.map((k) => (
                    <input
                      key={k}
                      aria-label={`hostgroups.thresholds.${k}`}
                      className={`${cellCls} border-border`}
                      inputMode="numeric"
                      placeholder={k}
                      value={g.thr[k]}
                      spellCheck={false}
                      onChange={(e) => updRow(i, { thr: { ...g.thr, [k]: e.target.value } })}
                    />
                  ))}
                </div>
              </details>
            </div>
          ))}
          <button
            type="button"
            className={miniBtnCls}
            onClick={() =>
              set("hostgroups", [
                ...s.hostgroups,
                { name: "", networks: "", calculation: "", ban: true, tenant: "", mitigation: "", thr: emptyThresholds() },
              ])
            }
          >
            {t.addItem}
          </button>
        </div>
      </FieldShell>
    );
  }

  function renderScrubNodes(f: FieldDef) {
    const updRow = (i: number, patch: Partial<(typeof s.scrub_nodes)[number]>) => {
      const next = s.scrub_nodes.slice();
      next[i] = { ...next[i], ...patch };
      set("scrub_nodes", next);
    };
    return (
      <FieldShell key={f.path} {...shellProps(f)} error={fieldError(f)}>
        <div className="space-y-2">
          {s.scrub_nodes.map((n, i) =>
            rowShell(
              <>
                {rowInput({ value: n.name, placeholder: "name", width: "w-28", onChange: (v) => updRow(i, { name: v }) })}
                {rowInput({ value: n.next_hop, placeholder: "next_hop", width: "w-32", onChange: (v) => updRow(i, { next_hop: v }) })}
                {rowInput({ value: n.next_hop6, placeholder: "next_hop6", width: "w-32", onChange: (v) => updRow(i, { next_hop6: v }) })}
                {rowInput({ value: n.capacity_mbps, placeholder: "capacity_mbps", numeric: true, width: "w-32", onChange: (v) => updRow(i, { capacity_mbps: v }) })}
                {rowInput({ value: n.hostgroups, placeholder: "hostgroups", width: "w-36", onChange: (v) => updRow(i, { hostgroups: v }) })}
              </>,
              () => set("scrub_nodes", s.scrub_nodes.filter((_, j) => j !== i)),
              i,
            ),
          )}
          <button
            type="button"
            className={miniBtnCls}
            onClick={() =>
              set("scrub_nodes", [
                ...s.scrub_nodes,
                { name: "", next_hop: "", next_hop6: "", capacity_mbps: "", hostgroups: "" },
              ])
            }
          >
            {t.addItem}
          </button>
        </div>
      </FieldShell>
    );
  }

  function renderRlProfiles(f: FieldDef) {
    const updRow = (i: number, patch: Partial<(typeof s.dp_profiles)[number]>) => {
      const next = s.dp_profiles.slice();
      next[i] = { ...next[i], ...patch };
      set("dp_profiles", next);
    };
    return (
      <FieldShell key={f.path} {...shellProps(f)} error={fieldError(f)}>
        <div className="space-y-2">
          {s.dp_profiles.map((p, i) =>
            rowShell(
              <>
                {rowInput({ value: p.name, placeholder: "name", width: "w-36", onChange: (v) => updRow(i, { name: v }) })}
                {rowInput({ value: p.pps, placeholder: "pps", numeric: true, width: "w-28", onChange: (v) => updRow(i, { pps: v }) })}
                {rowInput({ value: p.mbps, placeholder: "mbps", numeric: true, width: "w-28", onChange: (v) => updRow(i, { mbps: v }) })}
              </>,
              () => set("dp_profiles", s.dp_profiles.filter((_, j) => j !== i)),
              i,
            ),
          )}
          <button
            type="button"
            className={miniBtnCls}
            onClick={() => set("dp_profiles", [...s.dp_profiles, { name: "", pps: "", mbps: "" }])}
          >
            {t.addItem}
          </button>
        </div>
      </FieldShell>
    );
  }

  function renderStaticRules(f: FieldDef) {
    const updRow = (i: number, patch: Partial<(typeof s.dp_rules)[number]>) => {
      const next = s.dp_rules.slice();
      next[i] = { ...next[i], ...patch };
      set("dp_rules", next);
    };
    return (
      <FieldShell key={f.path} {...shellProps(f)} error={fieldError(f)}>
        <div className="space-y-2">
          {s.dp_rules.map((r, i) =>
            rowShell(
              <>
                {rowInput({ value: r.name, placeholder: "name", width: "w-32", onChange: (v) => updRow(i, { name: v }) })}
                {rowInput({ value: r.src, placeholder: "match.src", width: "w-36", onChange: (v) => updRow(i, { src: v }) })}
                {rowSelect({ value: r.proto, path: "dataplane.static_rules.match.proto", width: "w-24", onChange: (v) => updRow(i, { proto: v }) })}
                {rowInput({ value: r.src_port, placeholder: "src_port", numeric: true, width: "w-24", onChange: (v) => updRow(i, { src_port: v }) })}
                {rowInput({ value: r.dst_port, placeholder: "dst_port", numeric: true, width: "w-24", onChange: (v) => updRow(i, { dst_port: v }) })}
                {rowSelect({ value: r.action, path: "dataplane.static_rules.action", width: "w-28", onChange: (v) => updRow(i, { action: v }) })}
                {rowInput({ value: r.profile, placeholder: "profile", width: "w-28", onChange: (v) => updRow(i, { profile: v }) })}
              </>,
              () => set("dp_rules", s.dp_rules.filter((_, j) => j !== i)),
              i,
            ),
          )}
          <button
            type="button"
            className={miniBtnCls}
            onClick={() =>
              set("dp_rules", [
                ...s.dp_rules,
                { name: "", src: "", proto: "", src_port: "", dst_port: "", action: "", profile: "" },
              ])
            }
          >
            {t.addItem}
          </button>
        </div>
      </FieldShell>
    );
  }

  function renderApiTokens(f: FieldDef) {
    const updRow = (i: number, patch: Partial<(typeof s.api_tokens)[number]>) => {
      const next = s.api_tokens.slice();
      next[i] = { ...next[i], ...patch };
      set("api_tokens", next);
    };
    return (
      <FieldShell key={f.path} {...shellProps(f)} error={fieldError(f)}>
        <div className="space-y-2">
          {s.api_tokens.map((tk, i) =>
            rowShell(
              <>
                {rowInput({ value: tk.name, placeholder: "name", width: "w-32", onChange: (v) => updRow(i, { name: v }) })}
                {rowInput({ value: tk.token_env, placeholder: "token_env", width: "w-44 grow", onChange: (v) => updRow(i, { token_env: v }) })}
                {rowSelect({ value: tk.role, path: "api.tokens.role", width: "w-28", onChange: (v) => updRow(i, { role: v }) })}
                {rowInput({ value: tk.tenant, placeholder: "tenant", width: "w-28", onChange: (v) => updRow(i, { tenant: v }) })}
              </>,
              () => set("api_tokens", s.api_tokens.filter((_, j) => j !== i)),
              i,
            ),
          )}
          <button
            type="button"
            className={miniBtnCls}
            onClick={() =>
              set("api_tokens", [...s.api_tokens, { name: "", token_env: "", role: "", tenant: "" }])
            }
          >
            {t.addItem}
          </button>
        </div>
      </FieldShell>
    );
  }

  function renderMethod(f: FieldDef) {
    const opts = fieldNode("mitigation")?.enum ?? ["blackhole", "flowspec", "divert", "dataplane"];
    return (
      <FieldShell key={f.path} {...shellProps(f)} error={null}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {opts.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={s.mitigation === o}
              onClick={() => {
                set("mitigation", o);
                setGroupOpen({ flowspec: null, scrubbing: null, dataplane: null });
              }}
              className={`rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                s.mitigation === o
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </FieldShell>
    );
  }

  function renderField(f: FieldDef): React.ReactNode {
    if (f.showIf && !f.showIf(s)) return null;
    switch (f.kind) {
      case "text":
        return renderText(f);
      case "number":
        return renderNumber(f);
      case "bool":
        return renderBool(f);
      case "select":
        return renderSelect(f);
      case "list":
        return renderList(f);
      case "csv":
        return renderCsv(f);
      case "matrix":
        return renderMatrix(f);
      case "neighbors":
        return renderNeighbors(f);
      case "method":
        return renderMethod(f);
      case "boundary":
        return renderBoundary(f);
      case "escalation":
        return renderEscalation(f);
      case "hostgroups":
        return renderHostgroups(f);
      case "scrubnodes":
        return renderScrubNodes(f);
      case "rlprofiles":
        return renderRlProfiles(f);
      case "staticrules":
        return renderStaticRules(f);
      case "apitokens":
        return renderApiTokens(f);
    }
  }

  function renderFieldList(defs: FieldDef[]) {
    return defs.map((f) => {
      if (filterModified && !fieldModified(f)) return null;
      const node = renderField(f);
      if (node === null) return null;
      return (
        <div
          key={f.path}
          id={`fw-${f.path}`}
          className={
            flashPath === f.path
              ? "rounded-md ring-2 ring-accent ring-offset-2 ring-offset-surface"
              : undefined
          }
        >
          {f.subhead && !filterModified && (
            <h3 className="mb-3 border-b border-border pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
              {t.subheads[f.subhead]}
            </h3>
          )}
          {node}
        </div>
      );
    });
  }

  function renderMethodGroup(id: "flowspec" | "scrubbing" | "dataplane") {
    const auto = methodAuto[id];
    const open = groupOpen[id] ?? auto;
    const errs = METHOD_FIELDS[id].reduce((n, f) => n + (fieldError(f) ? 1 : 0), 0);
    return (
      <div key={id} className={`rounded-md border ${auto ? "border-accent/50" : "border-border"}`}>
        <button
          type="button"
          aria-expanded={open}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium"
          onClick={() => setGroupOpen((p) => ({ ...p, [id]: !open }))}
        >
          <span aria-hidden className={`text-[10px] transition-transform ${open ? "rotate-90" : ""}`}>
            ▶
          </span>
          {t.subheads[id]}
          {auto && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />}
          {errs > 0 && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-red-500" />}
        </button>
        {open && <div className="space-y-5 border-t border-border p-4">{renderFieldList(METHOD_FIELDS[id])}</div>}
      </div>
    );
  }

  function renderSection(id: SectionId) {
    const defs = FIELDS[id];
    // @modified filter: flat list of just the changed fields, section hidden
    // entirely when it holds none.
    if (filterModified) {
      const mod = defs.filter(fieldModified);
      const methodMod =
        id === "mitigation"
          ? (Object.keys(METHOD_FIELDS) as Array<keyof typeof METHOD_FIELDS>).flatMap((g) =>
              METHOD_FIELDS[g].filter(fieldModified),
            )
          : [];
      if (mod.length + methodMod.length === 0) return null;
      return (
        <section key={id} id={`sec-${id}`} aria-labelledby={`sec-${id}-h`} className="scroll-mt-40">
          <h2
            id={`sec-${id}-h`}
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {t.sections[id]}
          </h2>
          <div className="mt-2 rounded-lg border border-border bg-surface p-5">
            <div className="space-y-5">{renderFieldList([...mod, ...methodMod])}</div>
          </div>
        </section>
      );
    }
    const basic = defs.filter((f) => !f.advanced);
    const advanced = defs.filter((f) => f.advanced);
    const hint = t.advHints[id];
    return (
      <section key={id} id={`sec-${id}`} aria-labelledby={`sec-${id}-h`} className="scroll-mt-40">
        <h2
          id={`sec-${id}-h`}
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t.sections[id]}
        </h2>
        <div className="mt-2 rounded-lg border border-border bg-surface p-5">
          <div className="space-y-5">
            {id === "mitigation" ? (
              <>
                {renderFieldList([defs[0]])}
                <div className="space-y-2">
                  {renderMethodGroup("flowspec")}
                  {renderMethodGroup("scrubbing")}
                  {renderMethodGroup("dataplane")}
                </div>
                {renderFieldList(basic.slice(1))}
              </>
            ) : (
              renderFieldList(basic)
            )}
          </div>
          {advanced.length > 0 && (
            <details className="group mt-5 border-t border-border pt-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="text-[10px] transition-transform group-open:rotate-90">
                  ▶
                </span>
                {t.advanced}
                {hint && <span className="font-normal text-muted-foreground/70">— {hint}</span>}
              </summary>
              <div className="mt-4 space-y-5">{renderFieldList(advanced)}</div>
            </details>
          )}
        </div>
      </section>
    );
  }

  // ------------------------------------------------------------- YAML pane

  // Line-level tint: keys accented, comments muted. The emitter never writes
  // "#" inside a quoted value, so splitting at the first "#" is safe here.
  function renderYamlLine(ln: string) {
    if (ln === "") return " ";
    const ci = ln.indexOf("#");
    const code = ci >= 0 ? ln.slice(0, ci) : ln;
    const comment = ci >= 0 ? ln.slice(ci) : "";
    const m = code.match(/^(\s*(?:- )?)([A-Za-z0-9_]+)(:)(.*)$/);
    return (
      <>
        {m ? (
          <>
            {m[1]}
            <span className="text-accent">{m[2]}</span>
            {m[3]}
            {m[4]}
          </>
        ) : (
          code
        )}
        {comment && <span className="text-muted-foreground/70">{comment}</span>}
      </>
    );
  }

  const verdict = (() => {
    if (engineReady === false)
      return { tone: "muted" as const, text: t.engineOff, section: null };
    if (engineReady === null || !engineResult)
      return { tone: "muted" as const, text: t.engineChecking, section: null };
    if (engineResult.ok)
      return {
        tone: "ok" as const,
        text: t.accepts,
        summary: engineResult.summary,
        section: null,
      };
    return {
      tone: "err" as const,
      text: engineResult.error ?? "",
      section: guessErrorSection(engineResult.error),
    };
  })();

  const yamlPane = (
    <div id="yaml-pane" className="scroll-mt-40">
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <span className="font-mono text-xs font-semibold text-muted-foreground">{t.output}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copy}
              className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-muted"
            >
              {copied ? t.copied : t.copy}
            </button>
            <button
              type="button"
              onClick={download}
              className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-foreground hover:opacity-90"
            >
              {t.download}
            </button>
          </div>
        </div>
        <pre className="max-h-[50vh] overflow-auto px-4 py-3 font-mono text-xs leading-relaxed lg:max-h-[calc(100vh-26rem)]">
          {yamlLines.map((ln, i) => (
            <span
              key={i}
              className={`block whitespace-pre rounded-sm px-1 -mx-1 transition-colors duration-700 ${
                hotLines.has(i) ? "bg-accent/20 duration-0" : ""
              }`}
            >
              {renderYamlLine(ln)}
            </span>
          ))}
        </pre>
      </div>

      <div
        className={`mt-3 rounded-md border px-3 py-2 text-xs ${
          verdict.tone === "ok"
            ? "border-emerald-500/40 bg-emerald-500/10"
            : verdict.tone === "err"
              ? "border-red-500/40 bg-red-500/10"
              : "border-border bg-surface"
        }`}
        role="status"
        aria-live="polite"
      >
        {verdict.tone === "ok" ? (
          verdict.summary ? (
            <details>
              <summary className="cursor-pointer font-medium text-emerald-600 dark:text-emerald-400">
                ✓ {verdict.text}{" "}
                <span className="font-normal text-muted-foreground">· {t.engineSummary}</span>
              </summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
                {verdict.summary}
              </pre>
            </details>
          ) : (
            <p className="font-medium text-emerald-600 dark:text-emerald-400">✓ {verdict.text}</p>
          )
        ) : verdict.tone === "err" ? (
          verdict.section ? (
            <button
              type="button"
              onClick={() => scrollToSection(verdict.section as SectionId)}
              className="w-full text-left font-medium text-red-500 hover:underline"
            >
              ✗ {verdict.text}
            </button>
          ) : (
            <p className="font-medium text-red-500">✗ {verdict.text}</p>
          )
        ) : (
          <p className="text-muted-foreground">{verdict.text}</p>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {t.checkHint}{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
          kapkan -check-config config.yaml
        </code>
      </p>

      {/* deploy runbook, generated from the chosen options */}
      <div className="mt-4 rounded-lg border border-border bg-surface p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t.runbook.title}
        </h3>
        <ol className="mt-3 space-y-3">
          {[
            { text: t.runbook.save, cmd: "sudo install -m 0644 config.yaml /etc/kapkan/config.yaml" },
            { text: t.runbook.check, cmd: "kapkan -check-config /etc/kapkan/config.yaml" },
            ...(methodAuto.dataplane
              ? [
                  {
                    text: t.runbook.dataplane,
                    cmd: "sudo install -D -m 0644 /usr/share/kapkan/kapkan-dataplane.conf /etc/systemd/system/kapkan.service.d/10-dataplane.conf && sudo systemctl daemon-reload",
                  },
                ]
              : []),
            {
              text: t.runbook.apply,
              cmd: methodAuto.dataplane ? "sudo systemctl restart kapkan" : "sudo systemctl reload kapkan",
            },
            s.dry_run
              ? { text: t.runbook.watch, cmd: "journalctl -u kapkan -f" }
              : { text: t.runbook.live, cmd: undefined },
          ].map((step, i) => (
            <li key={i} className="text-xs">
              <p className={step.cmd ? "text-muted-foreground" : "font-medium text-red-500"}>
                {i + 1}. {step.text}
              </p>
              {step.cmd && (
                <div className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded bg-muted px-2 py-1 font-mono text-[11px]">
                    {step.cmd}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyCmd(step.cmd as string)}
                    className="shrink-0 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                  >
                    {copiedCmd === step.cmd ? t.copied : t.copy}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );

  // ------------------------------------------------------------------ shell

  const dot = (id: SectionId) => (
    <span
      aria-hidden
      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
        sectionErrors[id] > 0 ? "bg-red-500" : "bg-emerald-500/70"
      }`}
    />
  );

  return (
    <div className="pb-16 lg:pb-0">
      {/* mode bar: the watch-only / live state of the whole config, always visible */}
      <div className="sticky top-0 z-30 -mx-6 border-b border-border bg-background/90 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
              s.dry_run
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/10 text-red-500"
            }`}
          >
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${s.dry_run ? "bg-emerald-500" : "bg-red-500"}`}
            />
            {s.dry_run ? t.modeWatch : t.modeLive}
          </span>

          <button
            type="button"
            role="switch"
            aria-checked={!s.dry_run}
            aria-label={t.modeLive}
            onClick={() => set("dry_run", !s.dry_run)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              s.dry_run ? "bg-muted" : "bg-red-500"
            }`}
          >
            <span
              aria-hidden
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-[left] ${
                s.dry_run ? "left-0.5" : "left-[22px]"
              } border border-border`}
            />
          </button>

          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            dry_run: {String(s.dry_run)}
          </code>

          <span className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground md:inline">
            {s.dry_run ? t.modeWatchDesc : ""}
          </span>

          {totalErrors > 0 && firstErrorSection && (
            <button
              type="button"
              onClick={() => scrollToSection(firstErrorSection)}
              className="ml-auto rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-500/20"
            >
              {t.fieldErrors.replace("{n}", String(totalErrors))}
            </button>
          )}
        </div>
        {!s.dry_run && <p className="mt-2 text-xs font-medium text-red-500">{t.liveWarning}</p>}

        {/* toolbar: presets · search · modified-filter · import · share · reset */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={t.presets[p.id].desc}
              onClick={() => applyPreset(p.diff)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {t.presets[p.id].name}
            </button>
          ))}

          <div className="relative min-w-[170px] flex-1">
            <input
              value={searchQ}
              placeholder={t.search.placeholder}
              spellCheck={false}
              onChange={(e) => setSearchQ(e.target.value)}
              onFocus={() => {
                if (blurTimer.current) clearTimeout(blurTimer.current);
                setSearchFocus(true);
              }}
              onBlur={() => {
                blurTimer.current = setTimeout(() => setSearchFocus(false), 150);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchResults[0]) jumpToField(searchResults[0]);
                if (e.key === "Escape") {
                  setSearchQ("");
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-full rounded-full border border-border bg-background px-3 py-1 text-xs outline-none transition-colors focus:border-accent"
            />
            {searchFocus && searchQ.trim() !== "" && (
              <div className="absolute z-40 mt-1 max-h-72 w-full min-w-[260px] overflow-auto rounded-md border border-border bg-surface shadow-lg">
                {searchResults.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">{t.search.empty}</p>
                ) : (
                  searchResults.map((r) => (
                    <button
                      key={r.f.path}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        jumpToField(r);
                      }}
                      className="flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="truncate">{labelOf(r.f.path)}</span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {t.sections[r.section]} · {r.f.path}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            aria-pressed={filterModified}
            disabled={modifiedCount === 0 && !filterModified}
            onClick={() => setFilterModified((v) => !v)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-40 ${
              filterModified
                ? "border-accent bg-accent/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.modifiedChip.replace("{n}", String(modifiedCount))}
          </button>
          <button
            type="button"
            onClick={() => {
              setImportOpen((v) => !v);
              setImportDiag(null);
            }}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {t.importer.btn}
          </button>
          <button
            type="button"
            onClick={shareLink}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {shared ? t.share.copied : t.share.btn}
          </button>
          <button
            type="button"
            onClick={resetAll}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {t.reset.btn}
          </button>
        </div>
      </div>

      {importOpen && (
        <div className="mt-4 rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted-foreground">{t.importer.hint}</p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            spellCheck={false}
            rows={8}
            placeholder={"dry_run: true\nnetworks:\n  - \"203.0.113.0/24\"\n…"}
            className="mt-2 w-full rounded-md border border-border bg-background p-3 font-mono text-xs outline-none transition-colors focus:border-accent"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={doImport}
              className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-foreground hover:opacity-90"
            >
              {t.importer.apply}
            </button>
            <button
              type="button"
              onClick={() => {
                setImportOpen(false);
                setImportDiag(null);
              }}
              className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              {t.importer.cancel}
            </button>
          </div>
          {importDiag?.error && (
            <p className="mt-2 text-xs text-red-500">{t.importer.bad.replace("{err}", importDiag.error)}</p>
          )}
          {importDiag && !importDiag.error && (
            <div className="mt-2 text-xs">
              <p className="font-medium text-emerald-600 dark:text-emerald-400">{t.importer.ok}</p>
              {importDiag.lost.length > 0 && (
                <>
                  <p className="mt-1 font-medium text-amber-600 dark:text-amber-400">{t.importer.lost}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {importDiag.lost.map((p) => (
                      <code key={p} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                        {p}
                      </code>
                    ))}
                  </div>
                  <p className="mt-1 text-muted-foreground">{t.importer.lostNote}</p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 lg:grid lg:grid-cols-[180px_minmax(0,1fr)_minmax(0,440px)] lg:items-start lg:gap-8 xl:grid-cols-[200px_minmax(0,1fr)_minmax(0,540px)]">
        {/* section rail */}
        <nav aria-label={t.nav} className="lg:sticky lg:top-32 lg:self-start">
          {/* mobile: horizontal chips */}
          <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:hidden">
            {SECTION_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollToSection(id)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                  active === id
                    ? "border-accent text-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                {t.sections[id]}
                {dot(id)}
              </button>
            ))}
          </div>
          {/* desktop: vertical list */}
          <ul className="hidden space-y-0.5 text-sm lg:block">
            {SECTION_IDS.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => scrollToSection(id)}
                  aria-current={active === id ? "true" : undefined}
                  className={`flex w-full items-center justify-between gap-2 rounded-md border-l-2 py-1.5 pl-3 pr-2 text-left transition-colors ${
                    active === id
                      ? "border-accent font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="truncate">{t.sections[id]}</span>
                  {dot(id)}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* form column */}
        <div className="min-w-0 space-y-8">{SECTION_IDS.map(renderSection)}</div>

        {/* YAML column */}
        <aside className="mt-10 min-w-0 lg:sticky lg:top-24 lg:mt-0 lg:self-start">{yamlPane}</aside>
      </div>

      {/* mobile status bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-2 backdrop-blur lg:hidden">
        <span
          className={`min-w-0 truncate text-xs font-medium ${
            verdict.tone === "ok"
              ? "text-emerald-600 dark:text-emerald-400"
              : verdict.tone === "err"
                ? "text-red-500"
                : "text-muted-foreground"
          }`}
        >
          {verdict.tone === "ok" ? "✓" : verdict.tone === "err" ? "✗" : "…"} {verdict.text}
        </span>
        <a
          href="#yaml-pane"
          className="shrink-0 rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground"
        >
          {t.yamlJump}
        </a>
      </div>
    </div>
  );
}
