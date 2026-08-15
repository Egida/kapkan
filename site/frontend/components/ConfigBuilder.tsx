"use client";

// Config builder v2: one sectioned page instead of a stepper. The generated
// YAML is always on screen (sticky right pane) with just-changed lines
// highlighted, and the wasm engine verdict is a permanent strip — not a
// last-step reveal. Sections follow the operator pipeline (telemetry →
// networks → detection → mitigation → bans → notify → api); each field shows
// a human label with the raw YAML key beside it, and rarely-needed fields sit
// in one collapsed "Advanced" group per section.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import {
  wizardChrome,
  wizardHelp,
  wizardLabels,
  type SectionId,
  type WizardChrome,
} from "@/lib/wizard/strings";
import { emitConfig, initialState, type WizardState } from "@/lib/wizard/emit";
import { fieldMeta, fieldNode } from "@/lib/wizard/schema";
import { validateNumber, validateString } from "@/lib/wizard/validate";
import { loadEngineValidator, type EngineResult, type EngineValidator } from "@/lib/wizard/wasm";

const inputCls =
  "w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent";

// ---------------------------------------------------------------------------
// Field registry: one declaration drives both rendering and per-section error
// status. Order inside a section is render order; `advanced` fields collapse
// into the section's Advanced group. (Full schema-driven coverage is stage 2 —
// this registry still lists fields by hand.)

type FieldKind = "text" | "number" | "bool" | "select" | "list" | "neighbors" | "method";

type FieldDef = {
  kind: FieldKind;
  key: keyof WizardState;
  path: string;
  required?: boolean;
  mono?: boolean;
  advanced?: boolean;
  subhead?: keyof WizardChrome["subheads"]; // rendered before this field
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
  ],
  networks: [
    { kind: "list", key: "networks", path: "networks" },
    { kind: "list", key: "whitelist", path: "protected_whitelist" },
  ],
  detection: [
    { kind: "number", key: "pps", path: "thresholds.pps", required: true },
    { kind: "number", key: "mbps", path: "thresholds.mbps", required: true },
    { kind: "number", key: "flows_per_sec", path: "thresholds.flows_per_sec", required: true },
    { kind: "number", key: "tcp_syn_pps", path: "thresholds.tcp_syn_pps", advanced: true },
    { kind: "number", key: "udp_pps", path: "thresholds.udp_pps", advanced: true },
  ],
  mitigation: [
    { kind: "method", key: "mitigation", path: "mitigation", subhead: "method" },
    { kind: "number", key: "local_asn", path: "bgp.local_asn", required: true, subhead: "bgp" },
    { kind: "text", key: "router_id", path: "bgp.router_id", required: true, mono: true },
    { kind: "text", key: "next_hop", path: "bgp.next_hop", required: true, mono: true },
    { kind: "text", key: "next_hop6", path: "bgp.next_hop6", mono: true },
    { kind: "text", key: "community", path: "bgp.community", required: true, mono: true },
    { kind: "neighbors", key: "neighbors", path: "bgp.neighbors" },
    { kind: "bool", key: "gr_enabled", path: "bgp.graceful_restart.enabled", advanced: true },
    { kind: "number", key: "gr_restart_seconds", path: "bgp.graceful_restart.restart_seconds", advanced: true },
    { kind: "bool", key: "gr_long_lived", path: "bgp.graceful_restart.long_lived", advanced: true },
    { kind: "number", key: "gr_long_lived_stale", path: "bgp.graceful_restart.long_lived_stale_seconds", advanced: true },
  ],
  bans: [
    { kind: "number", key: "ttl_seconds", path: "ban.ttl_seconds", required: true },
    { kind: "number", key: "unban_hysteresis_seconds", path: "ban.unban_hysteresis_seconds", required: true },
    { kind: "number", key: "max_active_bans", path: "ban.max_active_bans", required: true },
    { kind: "text", key: "state_file", path: "ban.state_file", mono: true, advanced: true },
  ],
  notify: [
    { kind: "text", key: "tg_token_env", path: "notify.telegram.token_env", mono: true, subhead: "telegram" },
    { kind: "text", key: "tg_chat_id", path: "notify.telegram.chat_id", mono: true },
    { kind: "bool", key: "uc_enabled", path: "update_check.enabled", advanced: true },
    { kind: "number", key: "uc_interval", path: "update_check.interval_seconds", advanced: true },
    { kind: "select", key: "uc_channel", path: "update_check.channel", advanced: true },
    { kind: "text", key: "uc_url", path: "update_check.url", mono: true, advanced: true },
    { kind: "bool", key: "uc_notify", path: "update_check.notify", advanced: true },
  ],
  api: [
    { kind: "text", key: "api_listen", path: "api.listen", required: true, mono: true },
    { kind: "text", key: "api_token_env", path: "api.token_env", mono: true },
  ],
};

// Best-effort map from an engine error's leading YAML path to the section that
// owns it, so the red verdict strip can jump to the right place.
const ERROR_SECTION: Array<[RegExp, SectionId]> = [
  [/^(listen|sampling|flow_sources)/, "telemetry"],
  [/^(networks|protected_whitelist|hostgroups)/, "networks"],
  [/^(thresholds|baseline|carpet)/, "detection"],
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

// Module-level on purpose: defining this inside ConfigBuilder would give it a
// new component identity every render, remounting the subtree and dropping
// input focus on each keystroke.
function FieldShell({
  f,
  label,
  help,
  gloss,
  error,
  children,
}: {
  f: FieldDef;
  label: string;
  help?: string;
  gloss?: string | null;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <label htmlFor={`f-${f.path}`} className="text-sm font-medium">
          {label}
        </label>
        <code className="shrink-0 font-mono text-[11px] text-muted-foreground/80">{f.path}</code>
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
      { rootMargin: "-112px 0px -55% 0px", threshold: 0 },
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

  // --- per-field validation, shared by the renderers and the section dots.
  function fieldError(f: FieldDef): string | null {
    switch (f.kind) {
      case "text": {
        const v = s[f.key] as string;
        if (v.trim() === "") return f.required ? vmsg.required : null;
        return validateString(f.path, v, vmsg);
      }
      case "number": {
        const v = s[f.key] as string;
        if (v.trim() === "") return f.required ? vmsg.required : null;
        return validateNumber(f.path, Number(v), vmsg);
      }
      case "list": {
        for (const item of s[f.key] as string[]) {
          if (!item.trim()) continue;
          const err = validateString(f.path, item, vmsg);
          if (err) return err;
        }
        return null;
      }
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
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, vmsg]);
  const totalErrors = SECTION_IDS.reduce((n, id) => n + sectionErrors[id], 0);
  const firstErrorSection = SECTION_IDS.find((id) => sectionErrors[id] > 0) ?? null;

  // Human gloss for *_seconds fields: "600" → "≈ 10 min".
  function secondsGloss(f: FieldDef): string | null {
    if (f.kind !== "number" || !f.path.endsWith("_seconds")) return null;
    const n = Number((s[f.key] as string).trim());
    if (!Number.isFinite(n) || n < 120) return null;
    if (n >= 5400) return t.hours.replace("{v}", (Math.round((n / 3600) * 10) / 10).toString());
    return t.minutes.replace("{v}", Math.round(n / 60).toString());
  }

  // ------------------------------------------------------------------ fields

  const shellProps = (f: FieldDef) => ({
    f,
    label: labelOf(f.path),
    help: helpOf(f.path),
    gloss: secondsGloss(f),
  });

  function renderText(f: FieldDef) {
    const value = s[f.key] as string;
    return (
      <FieldShell key={f.path} {...shellProps(f)} error={fieldError(f)}>
        <input
          id={`f-${f.path}`}
          className={`${inputCls}${f.mono ? " font-mono" : ""}`}
          value={value}
          spellCheck={false}
          onChange={(e) => set(f.key, e.target.value as WizardState[typeof f.key])}
        />
      </FieldShell>
    );
  }

  function renderNumber(f: FieldDef) {
    const value = s[f.key] as string;
    return (
      <FieldShell key={f.path} {...shellProps(f)} error={fieldError(f)}>
        <input
          id={`f-${f.path}`}
          className={`${inputCls} font-mono`}
          inputMode="numeric"
          value={value}
          spellCheck={false}
          onChange={(e) => set(f.key, e.target.value as WizardState[typeof f.key])}
        />
      </FieldShell>
    );
  }

  function renderBool(f: FieldDef) {
    return (
      <div key={f.path}>
        <div className="flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={s[f.key] as boolean}
              onChange={(e) => set(f.key, e.target.checked as WizardState[typeof f.key])}
            />
            <span>{labelOf(f.path)}</span>
          </label>
          <code className="shrink-0 font-mono text-[11px] text-muted-foreground/80">{f.path}</code>
        </div>
        <p className="mt-1 pl-7 text-xs text-muted-foreground">{helpOf(f.path)}</p>
      </div>
    );
  }

  function renderSelect(f: FieldDef) {
    const opts = fieldNode(f.path)?.enum ?? [];
    return (
      <FieldShell key={f.path} {...shellProps(f)} error={null}>
        <select
          id={`f-${f.path}`}
          className={inputCls}
          value={s[f.key] as string}
          onChange={(e) => set(f.key, e.target.value as WizardState[typeof f.key])}
        >
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
    const values = s[f.key] as string[];
    const key = f.key as "networks" | "whitelist";
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
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            onClick={() => set(key, [...values, ""])}
          >
            {t.addItem}
          </button>
        </div>
      </FieldShell>
    );
  }

  function renderNeighbors(f: FieldDef) {
    return (
      <FieldShell key={f.path} {...shellProps(f)} error={null}>
        <div className="space-y-3">
          {s.neighbors.map((n, i) => {
            const addrErr = n.address.trim()
              ? validateString("bgp.neighbors.address", n.address, vmsg)
              : null;
            const asnErr = n.remote_asn.trim()
              ? validateNumber("bgp.neighbors.remote_asn", Number(n.remote_asn), vmsg)
              : null;
            return (
              <div key={i} className="rounded-md border border-border p-3">
                <div className="flex gap-2">
                  <input
                    className={`${inputCls} font-mono`}
                    placeholder="address"
                    value={n.address}
                    spellCheck={false}
                    onChange={(e) => {
                      const next = s.neighbors.slice();
                      next[i] = { ...next[i], address: e.target.value };
                      set("neighbors", next);
                    }}
                  />
                  <input
                    className={`${inputCls} w-32 font-mono`}
                    inputMode="numeric"
                    placeholder="remote_asn"
                    value={n.remote_asn}
                    onChange={(e) => {
                      const next = s.neighbors.slice();
                      next[i] = { ...next[i], remote_asn: e.target.value };
                      set("neighbors", next);
                    }}
                  />
                  <button
                    type="button"
                    aria-label="remove"
                    className="shrink-0 rounded-md border border-border px-3 text-muted-foreground hover:bg-muted"
                    onClick={() => set("neighbors", s.neighbors.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </div>
                {(addrErr || asnErr) && (
                  <p className="mt-1 text-xs text-red-500">{addrErr ?? asnErr}</p>
                )}
              </div>
            );
          })}
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            onClick={() => set("neighbors", [...s.neighbors, { address: "", remote_asn: "" }])}
          >
            {t.addNeighbor}
          </button>
        </div>
      </FieldShell>
    );
  }

  function renderMethod(f: FieldDef) {
    const opts = fieldNode("mitigation")?.enum ?? ["blackhole", "flowspec", "divert"];
    return (
      <FieldShell key={f.path} {...shellProps(f)} error={null}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {opts.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={s.mitigation === o}
              onClick={() => set("mitigation", o)}
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

  function renderField(f: FieldDef) {
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
      case "neighbors":
        return renderNeighbors(f);
      case "method":
        return renderMethod(f);
    }
  }

  function renderSection(id: SectionId) {
    const defs = FIELDS[id];
    const basic = defs.filter((f) => !f.advanced);
    const advanced = defs.filter((f) => f.advanced);
    const hint = t.advHints[id];
    return (
      <section key={id} id={`sec-${id}`} aria-labelledby={`sec-${id}-h`} className="scroll-mt-28">
        <h2
          id={`sec-${id}-h`}
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t.sections[id]}
        </h2>
        <div className="mt-2 rounded-lg border border-border bg-surface p-5">
          <div className="space-y-5">
            {basic.map((f) => (
              <div key={f.path}>
                {f.subhead && (
                  <h3 className="mb-3 border-b border-border pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                    {t.subheads[f.subhead]}
                  </h3>
                )}
                {renderField(f)}
              </div>
            ))}
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
              <div className="mt-4 space-y-5">{advanced.map((f) => renderField(f))}</div>
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
    <div id="yaml-pane" className="scroll-mt-28">
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
        <pre className="max-h-[50vh] overflow-auto px-4 py-3 font-mono text-xs leading-relaxed lg:max-h-[calc(100vh-21rem)]">
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
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[180px_minmax(0,1fr)_minmax(0,440px)] lg:items-start lg:gap-8 xl:grid-cols-[200px_minmax(0,1fr)_minmax(0,540px)]">
        {/* section rail */}
        <nav aria-label={t.nav} className="lg:sticky lg:top-24 lg:self-start">
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
