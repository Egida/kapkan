import Link from "next/link";
import { site } from "@/lib/site";
import type { Locale } from "@/lib/i18n";
import { xdp } from "@/lib/xdp-i18n";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MobileNav, type NavLink } from "@/components/MobileNav";

/* ------------------------------------------------------------------ icons */
// Same lucide-style inline set the main landing uses, trimmed to this page.
type IconName =
  | "cpu" | "route" | "gauge" | "shieldCheck" | "clock" | "lock" | "check"
  | "arrowRight" | "arrowDown" | "x" | "layers" | "zap" | "terminal";

function Icon({ name, className }: { name: IconName; className?: string }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const c = { viewBox: "0 0 24 24", className, "aria-hidden": true, focusable: false } as const;
  switch (name) {
    case "cpu":
      return <svg {...c} {...s}><rect x="5" y="5" width="14" height="14" rx="2" /><rect x="9" y="9" width="6" height="6" rx="1" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /></svg>;
    case "route":
      return <svg {...c} {...s}><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M8.5 19H15a3 3 0 003-3V7.5" /></svg>;
    case "gauge":
      return <svg {...c} {...s}><path d="M12 14l4-4" /><path d="M5.5 18a9 9 0 1113 0" /></svg>;
    case "shieldCheck":
      return <svg {...c} {...s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>;
    case "clock":
      return <svg {...c} {...s}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "lock":
      return <svg {...c} {...s}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>;
    case "check":
      return <svg {...c} {...s}><path d="M20 6L9 17l-5-5" /></svg>;
    case "arrowRight":
      return <svg {...c} {...s}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
    case "arrowDown":
      return <svg {...c} {...s}><path d="M12 5v14M6 13l6 6 6-6" /></svg>;
    case "x":
      return <svg {...c} {...s}><path d="M18 6L6 18M6 6l12 12" /></svg>;
    case "layers":
      return <svg {...c} {...s}><path d="M12 2l9 5-9 5-9-5 9-5z" /><path d="M3 12l9 5 9-5M3 17l9 5 9-5" /></svg>;
    case "zap":
      return <svg {...c} {...s}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>;
    case "terminal":
      return <svg {...c} {...s}><path d="M4 17l6-5-6-5" /><path d="M12 19h8" /></svg>;
  }
}

const HOW_ICONS: IconName[] = ["zap", "layers", "cpu", "shieldCheck"];
const SAFETY_ICONS: IconName[] = ["gauge", "clock", "lock", "check"];

/* ---------------------------------------------------- pipeline diagram */
// Inline SVG, theme-aware through currentColor and the token stroke/fill
// classes. It shows the one thing that changes versus an announcement: the
// encoded rules go into kernel maps, and the XDP program returns a verdict per
// packet with pass as the default.
function Pipeline({ t }: { t: (typeof xdp)[Locale]["how"]["diagram"] }) {
  const box = "fill-[var(--surface)] stroke-[var(--border)]";
  return (
    <figure className="mt-14">
      <div className="overflow-x-auto">
        <svg viewBox="0 0 900 220" className="mx-auto h-auto w-full min-w-[680px] max-w-4xl" role="img" aria-label={t.caption}>
          <defs>
            <marker id="xdp-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" className="fill-[var(--border)]" />
            </marker>
          </defs>
          {/* flow line */}
          <g strokeWidth="1.6" className="stroke-[var(--border)]" markerEnd="url(#xdp-arrow)" fill="none">
            <line x1="150" y1="70" x2="212" y2="70" />
            <line x1="360" y1="70" x2="422" y2="70" />
            <line x1="570" y1="70" x2="632" y2="70" />
          </g>
          {/* nodes */}
          {[
            { x: 20, label: t.detect, sub: "threshold · classifier" },
            { x: 230, label: t.compile, sub: "victim-anchored rules" },
            { x: 440, label: t.maps, sub: "double-buffered" },
            { x: 650, label: t.verdict, sub: "per packet" },
          ].map((n) => (
            <g key={n.x}>
              <rect x={n.x} y="40" width="130" height="60" rx="10" strokeWidth="1.4" className={box} />
              <text x={n.x + 65} y="66" textAnchor="middle" className="fill-[var(--foreground)]" fontSize="14" fontWeight="600">{n.label}</text>
              <text x={n.x + 65} y="85" textAnchor="middle" className="fill-[var(--muted-foreground)]" fontSize="10.5">{n.sub}</text>
            </g>
          ))}
          {/* verdict branch */}
          <g strokeWidth="1.6" className="stroke-[var(--border)]" fill="none">
            <path d="M715 100 L715 140 L360 140 L360 158" markerEnd="url(#xdp-arrow)" />
            <path d="M715 100 L715 170" markerEnd="url(#xdp-arrow)" />
          </g>
          <g>
            <rect x="285" y="158" width="150" height="34" rx="8" strokeWidth="1.4" className="fill-[color-mix(in_srgb,#22c55e_12%,transparent)] stroke-[#22c55e]" />
            <text x="360" y="180" textAnchor="middle" className="fill-[#22c55e]" fontSize="12.5" fontWeight="600">{t.pass}</text>
            <rect x="640" y="178" width="150" height="34" rx="8" strokeWidth="1.4" className="fill-[color-mix(in_srgb,#ef4444_12%,transparent)] stroke-[#ef4444]" />
            <text x="715" y="200" textAnchor="middle" className="fill-[#ef4444]" fontSize="12.5" fontWeight="600">{t.drop}</text>
          </g>
        </svg>
      </div>
      <figcaption className="mx-auto mt-5 max-w-2xl text-center text-sm text-muted-foreground">{t.caption}</figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ frame */
function Shot({ src, alt, w, h }: { src: string; alt: string; w: number; h: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl ring-1 ring-black/5">
      <div className="flex h-11 items-center gap-4 border-b border-border bg-muted px-4">
        <div className="flex gap-2">
          <span className="h-3 w-3 rounded-full bg-border" />
          <span className="h-3 w-3 rounded-full bg-border" />
          <span className="h-3 w-3 rounded-full bg-border" />
        </div>
        <div className="flex flex-1 justify-center">
          <span className="rounded-md border border-border bg-background px-4 py-1 text-center font-mono text-xs text-muted-foreground">
            kapkan.local:8080/ui
          </span>
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={w} height={h} className="h-auto w-full" />
    </div>
  );
}

/* ------------------------------------------------------------------- page */
export function XdpLanding({ locale, basePath }: { locale: Locale; basePath: string }) {
  const t = xdp[locale];
  const docsHref = `${basePath}/docs/dataplane`;
  const configHref = `${basePath}/config`;
  const homeHref = basePath || "/";

  const mobileLinks: NavLink[] = [
    { label: t.nav.home, href: homeHref },
    { label: t.nav.docs, href: docsHref },
    { label: site.name, href: site.repo, external: true },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* ---------------------------------------------------------- header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Logo href={homeHref} />
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <Link href={homeHref} className="transition-colors hover:text-foreground">{t.nav.home}</Link>
            <Link href={docsHref} className="transition-colors hover:text-foreground">{t.nav.docs}</Link>
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block"><LanguageSwitcher lang={locale} /></div>
            <ThemeToggle />
            <Link href={docsHref} className="hidden rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 sm:inline-flex">
              {t.nav.docs}
            </Link>
            <MobileNav links={mobileLinks} cta={{ label: t.nav.docs, href: docsHref }} menuLabel={t.nav.home}>
              <LanguageSwitcher lang={locale} />
              <ThemeToggle />
            </MobileNav>
          </div>
        </div>
      </header>

      <main>
        {/* ------------------------------------------------------------ hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px]"
            style={{ background: "radial-gradient(60% 60% at 50% -10%, rgba(245,158,11,0.14) 0%, rgba(245,158,11,0) 60%)" }} />
          <div className="mx-auto max-w-7xl px-6 pb-16 pt-16 lg:pb-24 lg:pt-24">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 backdrop-blur-sm">
              <Icon name="cpu" className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.hero.eyebrow}</span>
            </div>
            <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <h1 className="mb-6 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
                  {t.hero.h1a} <span className="text-amber-400">{t.hero.h1b}</span>
                </h1>
                <p className="mb-8 max-w-xl text-lg leading-relaxed text-muted-foreground">{t.hero.sub}</p>
                <div className="mb-8 flex flex-wrap items-center gap-3">
                  <Link href={docsHref} className="rounded-full bg-accent px-6 py-3 font-medium text-accent-foreground transition-opacity hover:opacity-90">{t.hero.ctaDocs}</Link>
                  <Link href={configHref} className="group flex items-center gap-1 rounded-full border border-border bg-surface px-6 py-3 font-medium transition-colors hover:bg-muted">
                    {t.hero.ctaConfig}
                    <Icon name="arrowRight" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
                <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-sm text-muted-foreground">
                  {t.hero.trust.map((item) => (
                    <li key={item} className="flex items-center gap-1.5">
                      <Icon name="check" className="h-3.5 w-3.5 text-amber-400/80" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lg:col-span-7">
                <Shot src="/assets/screenshots/xdp/attacks-xdp-method.png" alt={t.hero.shotAlt} w={1440} h={644} />
                <p className="mt-4 text-center text-sm text-muted-foreground">{t.hero.shotCaption}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- announce vs drop */}
        <section className="border-y border-border bg-muted/20 py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-14 max-w-3xl">
              <h2 className="mb-4 text-3xl font-bold tracking-tight">{t.contrast.heading}</h2>
              <p className="text-muted-foreground">{t.contrast.sub}</p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {[
                { icon: "route" as IconName, tone: "text-accent", d: t.contrast.announce },
                { icon: "cpu" as IconName, tone: "text-amber-400", d: t.contrast.drop },
              ].map((col) => (
                <div key={col.d.title} className="rounded-2xl border border-border bg-surface p-7">
                  <div className="mb-4 flex items-center gap-3">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background ${col.tone}`}>
                      <Icon name={col.icon} className="h-6 w-6" />
                    </span>
                    <h3 className="text-lg font-semibold">{col.d.title}</h3>
                  </div>
                  <p className="mb-5 text-sm leading-relaxed text-muted-foreground">{col.d.body}</p>
                  <ul className="space-y-2.5">
                    {col.d.points.map((p) => (
                      <li key={p} className="flex gap-2.5 text-sm leading-relaxed">
                        <Icon name="arrowRight" className={`mt-1 h-3.5 w-3.5 shrink-0 ${col.tone}`} />
                        <span className="text-muted-foreground">{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- how it works */}
        <section className="mx-auto max-w-7xl px-6 py-24">
          <div className="mb-4 max-w-3xl">
            <h2 className="mb-4 text-3xl font-bold tracking-tight">{t.how.heading}</h2>
            <p className="text-muted-foreground">{t.how.sub}</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {t.how.steps.map((step, i) => (
              <div key={step.title} className="relative rounded-2xl border border-border bg-surface p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-amber-400">
                    <Icon name={HOW_ICONS[i]} className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="mb-2 font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
          <Pipeline t={t.how.diagram} />
        </section>

        {/* ------------------------------------------------- rate limiting */}
        <section className="border-y border-border bg-muted/20 py-24">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 lg:grid-cols-12">
            <div className="lg:col-span-1">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface text-amber-400">
                <Icon name="gauge" className="h-6 w-6" />
              </span>
            </div>
            <div className="lg:col-span-11">
              <h2 className="mb-4 max-w-3xl text-3xl font-bold tracking-tight">{t.ratelimit.heading}</h2>
              <p className="mb-6 max-w-3xl text-lg leading-relaxed text-muted-foreground">{t.ratelimit.body}</p>
              <p className="max-w-3xl border-l-2 border-amber-400/40 pl-4 text-sm italic leading-relaxed text-muted-foreground">{t.ratelimit.aside}</p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- safety */}
        <section className="mx-auto max-w-7xl px-6 py-24">
          <div className="mb-14 max-w-3xl">
            <h2 className="mb-4 text-3xl font-bold tracking-tight">{t.safety.heading}</h2>
            <p className="text-muted-foreground">{t.safety.sub}</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {t.safety.cards.map((card, i) => (
              <div key={card.title} className="rounded-2xl border border-border bg-surface p-6">
                <Icon name={SAFETY_ICONS[i]} className="mb-4 h-6 w-6 text-green-500" />
                <h3 className="mb-2 font-semibold">{card.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------- measured */}
        <section className="border-y border-border bg-muted/20 py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-12 max-w-3xl">
              <h2 className="mb-4 text-3xl font-bold tracking-tight">{t.measured.heading}</h2>
              <p className="text-muted-foreground">{t.measured.sub}</p>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {t.measured.stats.map((s) => (
                <div key={s.label} className="rounded-2xl border border-border bg-surface p-6">
                  <div className="mb-2 font-mono text-3xl font-bold text-amber-400">{s.value}</div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t.measured.caveat}</p>
          </div>
        </section>

        {/* --------------------------------------------------------- showcase */}
        <section className="mx-auto max-w-5xl px-6 py-24">
          <Shot src="/assets/screenshots/xdp/dataplane-live.png" alt={t.showcaseCaption} w={1440} h={1283} />
          <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-muted-foreground">{t.showcaseCaption}</p>
        </section>

        {/* ---------------------------------------------------------- limits */}
        <section className="border-y border-border bg-muted/20 py-24">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-12 max-w-3xl">
              <h2 className="mb-4 text-3xl font-bold tracking-tight">{t.limits.heading}</h2>
              <p className="text-muted-foreground">{t.limits.sub}</p>
            </div>
            <div className="space-y-5">
              {t.limits.items.map((it) => (
                <div key={it.title} className="rounded-2xl border border-border bg-surface p-6">
                  <h3 className="mb-2 font-semibold">{it.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{it.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- requirements */}
        <section className="mx-auto max-w-5xl px-6 py-24">
          <div className="mb-10 max-w-3xl">
            <h2 className="mb-4 text-3xl font-bold tracking-tight">{t.requirements.heading}</h2>
            <p className="text-muted-foreground">{t.requirements.sub}</p>
          </div>
          <ul className="space-y-3">
            {t.requirements.items.map((item) => (
              <li key={item} className="flex gap-3 rounded-xl border border-border bg-surface p-4">
                <Icon name="terminal" className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                <span className="text-sm leading-relaxed text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* -------------------------------------------------------------- cta */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-4xl px-6 py-24 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">{t.cta.heading}</h2>
            <p className="mx-auto mb-8 max-w-xl text-muted-foreground">{t.cta.sub}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href={docsHref} className="rounded-full bg-accent px-6 py-3 font-medium text-accent-foreground transition-opacity hover:opacity-90">{t.cta.primary}</Link>
              <Link href={configHref} className="rounded-full border border-border bg-surface px-6 py-3 font-medium transition-colors hover:bg-muted">{t.cta.secondary}</Link>
            </div>
          </div>
        </section>
      </main>

      {/* --------------------------------------------------------------- foot */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row">
          <Logo href={homeHref} />
          <div className="flex items-center gap-6">
            <Link href={homeHref} className="hover:text-foreground">{t.nav.home}</Link>
            <Link href={docsHref} className="hover:text-foreground">{t.nav.docs}</Link>
            <a href={site.repo} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
