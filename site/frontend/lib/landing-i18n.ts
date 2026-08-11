// All translatable copy for the marketing landing page, per locale. The page
// chrome/structure lives in components/Landing.tsx; this file holds only the
// strings. Technical terms (NetFlow, IPFIX, sFlow, BGP, RTBH, FlowSpec, pps,
// Mbps, Gbps, API, Apache 2.0, …) are intentionally left untranslated.

import type { Locale } from "@/lib/i18n";

export type LandingDict = {
  meta: { title: string; description: string };
  nav: {
    features: string;
    how: string;
    compare: string;
    docs: string;
    star: string;
    readDocs: string;
    buildConfig: string;
    viewGithub: string;
    menu: string;
    docFull: string;
  };
  hero: { eyebrow: string; h1a: string; h1b: string; sub: string; trust: string[] };
  stats: string[];
  how: { heading: string; sub: string; steps: { title: string; body: string }[] };
  features: { heading: string; sub: string; safetyTag: string; learnMore: string; cards: { title: string; body: string }[] };
  showcase: { heading: string; sub: string };
  compare: {
    heading: string;
    sub: string;
    colFeature: string;
    colKapkan: string;
    colThem: string;
    rows: { feature: string; kapkan: string; them: string }[];
  };
  quickstart: { heading: string; bodyBefore: string; bodyAfter: string; cta: string };
  cta: { heading: string; sub: string };
  footer: {
    tagline: string;
    product: string;
    docsCol: string;
    project: string;
    features: string;
    compare: string;
    configBuilder: string;
    quickstart: string;
    configuration: string;
    api: string;
    safety: string;
    github: string;
    releases: string;
    license: string;
  };
};

const en: LandingDict = {
  meta: {
    title: "Kapkan — Free, open-source DDoS detection & mitigation",
    description:
      "Kapkan is a single Go binary that ingests NetFlow/IPFIX/sFlow telemetry, detects volumetric DDoS attacks in seconds, and either announces automated BGP RTBH and FlowSpec mitigation or drops the attack itself in the Linux kernel with XDP. Free and open source.",
  },
  nav: {
    features: "Features",
    how: "How it works",
    compare: "Compare",
    docs: "Docs",
    star: "Star on GitHub",
    readDocs: "Read the docs",
    buildConfig: "Build a config",
    viewGithub: "View on GitHub",
    menu: "Menu",
    docFull: "View full documentation",
  },
  hero: {
    eyebrow: "Open Source · Apache 2.0",
    h1a: "Stop volumetric DDoS in seconds —",
    h1b: "on a single binary.",
    sub: "Kapkan ingests NetFlow, IPFIX and sFlow from your routers, detects volumetric attacks against the prefixes you protect, and triggers automated BGP blackhole or surgical FlowSpec mitigation — or drops the attack itself, in the Linux kernel, with XDP. Free, open-source, dry-run by default.",
    trust: ["Single Go binary", "No sidecar", "Dry-run by default", "IPv4 + IPv6"],
  },
  stats: ["≥20M flows/sec/core", "Detects in seconds", "/32 + /128 RTBH", "FlowSpec RFC 8955/8956", "Single static binary"],
  how: {
    heading: "The story in four verbs.",
    sub: "A streamlined architecture with no sidecars, message queues or external dependencies. Just run the binary.",
    steps: [
      {
        title: "INGEST",
        body: "Point your routers' flow exporters at Kapkan. sFlow v5, NetFlow v5/v9 and IPFIX over UDP, parsed entirely in-process — no sidecar daemons.",
      },
      {
        title: "DETECT",
        body: "Per-destination, sampling-corrected pps / Mbps / flows-per-second thresholds over a sliding window — plus per-protocol limits and learned baselines.",
      },
      {
        title: "MITIGATE",
        body: "An embedded BGP speaker announces /32 or /128 blackhole routes, or distributes surgical FlowSpec rules that drop only the attack vector. Auto-withdrawn when safe.",
      },
      {
        title: "DROP",
        body: "Or skip the router entirely: the same rules compile into Linux kernel maps and Kapkan drops the attack itself with XDP, before the packets reach the network stack. Every rule carries its own in-kernel deadline, so a stopped Kapkan cannot keep dropping traffic.",
      },
    ],
  },
  features: {
    heading: "Enterprise-grade capabilities, free.",
    sub: "The feature set commercial flow-DDoS products charge thousands for, packaged in a single Apache 2.0 binary.",
    safetyTag: "SAFETY",
    learnMore: "How in-kernel mitigation works",
    cards: [
      { title: "Multi-protocol flow ingest", body: "sFlow, NetFlow v5/v9, IPFIX over UDP, in library mode — no extra daemon required." },
      { title: "Sub-second volumetric detection", body: "Sampling-corrected pps/Mbps/flows thresholds over a sliding window, ≥20M flows/sec/core." },
      { title: "RTBH + surgical FlowSpec", body: "Blackhole the whole host, or drop only the attack vector. IPv6 FlowSpec at full parity with IPv4." },
      { title: "Attack classification", body: "Amplification (NTP/DNS/memcached), SYN/UDP/ICMP floods — with a 'why this fired' breakdown." },
      { title: "Continuous learned baselines", body: "Kapkan learns each host's normal traffic online and tightens thresholds automatically. Stop tuning by hand." },
      { title: "Safe by construction", body: "Dry-run by default, TTL auto-withdraw, active-ban caps, and a protected whitelist that is NEVER banned." },
      { title: "Carpet-bombing detection", body: "Catches low-per-host floods spread across a whole prefix that slip past per-IP thresholds." },
      { title: "Full observability", body: "REST API, Prometheus /metrics, plus Telegram, Slack, email, webhook and exec-hook notifications." },
      { title: "Multi-tenant & audited", body: "Per-tenant scoping, role-based API tokens (viewer/operator), and an operator-attributed audit log." },
      {
        title: "In-kernel mitigation with XDP",
        body: "Kapkan can enforce a detection itself instead of asking a router to. The same rules it would announce as FlowSpec are compiled into Linux kernel maps and applied by an XDP program — including per-source rate limiting, which BGP FlowSpec structurally cannot express. Linux 5.15+, nothing to compile on the box, and every rule expires inside the kernel, so a Kapkan that dies cannot leave your traffic dropped. Dry-run is still the default.",
      },
    ],
  },
  showcase: {
    heading: "A real operator console, included for free.",
    sub: "No hunting through raw logs. Kapkan ships with a built-in, reactive UI for the SOC war-room — attacks, hosts and mitigation in one place.",
  },
  compare: {
    heading: "How we stack up.",
    sub: "Built to replace expensive legacy flow analyzers with a modern, single-binary approach.",
    colFeature: "Feature",
    colKapkan: "Kapkan",
    colThem: "Commercial tools",
    rows: [
      { feature: "License model", kapkan: "Free & open source (Apache 2.0)", them: "Paid license / volume-based" },
      { feature: "Operator dashboard", kapkan: "Included free", them: "Paid add-on" },
      { feature: "IPv6 FlowSpec parity", kapkan: "Full parity with IPv4", them: "Unsupported / roadmap" },
      { feature: "Continuous baselines", kapkan: "Online, automatic tuning", them: "Offline calculator, copy-paste" },
      { feature: "Automation logic", kapkan: "Declarative escalation ladders", them: "Custom bash / callback scripts" },
      { feature: "Architecture", kapkan: "Single static binary, no sidecar", them: "Multi-daemon setup" },
    ],
  },
  quickstart: {
    heading: "Up and running in minutes — dry-run first.",
    bodyBefore:
      "Kapkan is safe to deploy by default. Every would-be blackhole or FlowSpec announcement is logged and exposed via the API, but never announced to your BGP peers until you explicitly flip ",
    bodyAfter: ".",
    cta: "View full documentation",
  },
  cta: { heading: "Set the trap. Protect your network.", sub: "Free forever. Apache 2.0. Deploy in an afternoon." },
  footer: {
    tagline: "Free, open-source DDoS detection & mitigation — announce it, or drop it yourself.",
    product: "Product",
    docsCol: "Docs",
    project: "Project",
    features: "Features",
    compare: "Compare",
    configBuilder: "Config builder",
    quickstart: "Quickstart",
    configuration: "Configuration",
    api: "API",
    safety: "Safety model",
    github: "GitHub",
    releases: "Releases",
    license: "License (Apache 2.0)",
  },
};

const ru: LandingDict = {
  meta: {
    title: "Kapkan — бесплатное open-source обнаружение и митигация DDoS",
    description:
      "Kapkan — единый Go-бинарь: принимает телеметрию NetFlow/IPFIX/sFlow, за секунды обнаруживает объёмные DDoS-атаки и либо запускает автоматическую митигацию через BGP RTBH и FlowSpec, либо сам отбрасывает атаку в ядре Linux через XDP. Бесплатно и с открытым кодом.",
  },
  nav: {
    features: "Возможности",
    how: "Как работает",
    compare: "Сравнение",
    docs: "Документация",
    star: "Звезда на GitHub",
    readDocs: "Документация",
    buildConfig: "Собрать конфиг",
    viewGithub: "Открыть на GitHub",
    menu: "Меню",
    docFull: "Вся документация",
  },
  hero: {
    eyebrow: "Open Source · Apache 2.0",
    h1a: "Останавливайте объёмный DDoS за секунды —",
    h1b: "в одном бинаре.",
    sub: "Kapkan принимает NetFlow, IPFIX и sFlow с ваших маршрутизаторов, за секунды обнаруживает объёмные атаки на защищаемые префиксы и запускает автоматический BGP-blackhole или хирургичную митигацию через FlowSpec — либо сам отбрасывает атаку, в ядре Linux, через XDP. Бесплатно, open-source, dry-run по умолчанию.",
    trust: ["Один Go-бинарь", "Без сайдкаров", "Dry-run по умолчанию", "IPv4 + IPv6"],
  },
  stats: ["≥20M потоков/с/ядро", "Обнаружение за секунды", "/32 + /128 RTBH", "FlowSpec RFC 8955/8956", "Один статический бинарь"],
  how: {
    heading: "Вся суть в четырёх глаголах.",
    sub: "Упрощённая архитектура без сайдкаров, очередей сообщений и внешних зависимостей. Просто запустите бинарь.",
    steps: [
      {
        title: "ПРИЁМ",
        body: "Направьте экспортёры потоков ваших маршрутизаторов в Kapkan. sFlow v5, NetFlow v5/v9 и IPFIX по UDP, разбор полностью in-process — без отдельных демонов.",
      },
      {
        title: "ОБНАРУЖЕНИЕ",
        body: "Пороги pps / Mbps / потоков-в-секунду на каждый адрес назначения с поправкой на сэмплинг по скользящему окну — плюс пер-протокольные лимиты и обучаемые baseline.",
      },
      {
        title: "МИТИГАЦИЯ",
        body: "Встроенный BGP-спикер анонсирует blackhole-маршруты /32 или /128 либо рассылает хирургичные правила FlowSpec, отбрасывающие только вектор атаки. Снимаются автоматически.",
      },
      {
        title: "ОТБРАСЫВАНИЕ",
        body: "Или вообще без маршрутизатора: те же правила компилируются в карты ядра Linux, и Kapkan сам отбрасывает атаку через XDP — до того, как пакеты дойдут до сетевого стека. У каждого правила свой срок жизни внутри ядра, поэтому остановленный Kapkan не может продолжать отбрасывать трафик.",
      },
    ],
  },
  features: {
    heading: "Корпоративные возможности — бесплатно.",
    sub: "Набор функций, за который коммерческие flow-DDoS продукты берут тысячи, — в одном бинаре под Apache 2.0.",
    safetyTag: "БЕЗОПАСНОСТЬ",
    learnMore: "Как работает подавление в ядре",
    cards: [
      { title: "Мультипротокольный приём потоков", body: "sFlow, NetFlow v5/v9, IPFIX по UDP в режиме библиотеки — без дополнительного демона." },
      { title: "Обнаружение объёмных атак за доли секунды", body: "Пороги pps/Mbps/потоков с поправкой на сэмплинг по скользящему окну, ≥20M потоков/с/ядро." },
      { title: "RTBH + хирургичный FlowSpec", body: "Blackhole целого хоста или сброс только вектора атаки. IPv6 FlowSpec на полном паритете с IPv4." },
      { title: "Классификация атак", body: "Усиление (NTP/DNS/memcached), SYN/UDP/ICMP-флуды — с разбором «почему сработало»." },
      { title: "Непрерывно обучаемые baseline", body: "Kapkan онлайн изучает нормальный трафик каждого хоста и автоматически ужесточает пороги. Хватит крутить вручную." },
      { title: "Безопасность by design", body: "Dry-run по умолчанию, авто-снятие по TTL, лимиты активных банов и защищённый whitelist, который НИКОГДА не банится." },
      { title: "Обнаружение carpet-bombing", body: "Ловит распределённые по всему префиксу низко-интенсивные флуды, проскальзывающие мимо пер-IP порогов." },
      { title: "Полная наблюдаемость", body: "REST API, Prometheus /metrics, а также уведомления в Telegram, Slack, email, webhook и exec-hook." },
      { title: "Мультиарендность и аудит", body: "Разграничение по арендаторам, ролевые API-токены (viewer/operator) и журнал аудита с привязкой к оператору." },
      {
        title: "Отбрасывание в ядре через XDP",
        body: "Kapkan может применить решение сам, а не просить об этом маршрутизатор. Те же правила, которые он анонсировал бы как FlowSpec, компилируются в карты ядра Linux и применяются XDP-программой — включая ограничение скорости по каждому источнику, которое BGP FlowSpec структурно выразить не может. Linux 5.15+, ничего компилировать на машине не нужно, и каждое правило истекает внутри ядра, поэтому упавший Kapkan не оставит ваш трафик отброшенным. Dry-run по-прежнему по умолчанию.",
      },
    ],
  },
  showcase: {
    heading: "Настоящая операторская консоль — в комплекте и бесплатно.",
    sub: "Не нужно копаться в сырых логах. Kapkan поставляется со встроенным реактивным UI для SOC — атаки, хосты и митигация в одном месте.",
  },
  compare: {
    heading: "Чем мы отличаемся.",
    sub: "Создан, чтобы заменить дорогие устаревшие flow-анализаторы современным подходом «один бинарь».",
    colFeature: "Возможность",
    colKapkan: "Kapkan",
    colThem: "Коммерческие продукты",
    rows: [
      { feature: "Модель лицензии", kapkan: "Бесплатно и open-source (Apache 2.0)", them: "Платная лицензия / по объёму" },
      { feature: "Операторская панель", kapkan: "Включена бесплатно", them: "Платное дополнение" },
      { feature: "Паритет IPv6 FlowSpec", kapkan: "Полный паритет с IPv4", them: "Не поддерживается / в планах" },
      { feature: "Непрерывные baseline", kapkan: "Онлайн, автоматическая настройка", them: "Офлайн-калькулятор, копипаст" },
      { feature: "Логика автоматизации", kapkan: "Декларативные лестницы эскалации", them: "Самописные bash/callback-скрипты" },
      { feature: "Архитектура", kapkan: "Один статический бинарь, без сайдкаров", them: "Множество демонов" },
    ],
  },
  quickstart: {
    heading: "Запуск за минуты — сначала dry-run.",
    bodyBefore:
      "Kapkan безопасен для развёртывания по умолчанию. Каждый потенциальный blackhole или анонс FlowSpec логируется и доступен через API, но никогда не анонсируется вашим BGP-пирам, пока вы явно не переключите ",
    bodyAfter: ".",
    cta: "Вся документация",
  },
  cta: { heading: "Поставьте капкан. Защитите свою сеть.", sub: "Бесплатно навсегда. Apache 2.0. Разверните за один вечер." },
  footer: {
    tagline: "Бесплатное open-source обнаружение DDoS — анонсировать маршрут или отбросить самому.",
    product: "Продукт",
    docsCol: "Документация",
    project: "Проект",
    features: "Возможности",
    compare: "Сравнение",
    configBuilder: "Сборщик конфига",
    quickstart: "Быстрый старт",
    configuration: "Конфигурация",
    api: "API",
    safety: "Модель безопасности",
    github: "GitHub",
    releases: "Релизы",
    license: "Лицензия (Apache 2.0)",
  },
};

const de: LandingDict = {
  meta: {
    title: "Kapkan — kostenlose Open-Source-DDoS-Erkennung & -Mitigation",
    description:
      "Kapkan ist eine einzige Go-Binary: Sie nimmt NetFlow/IPFIX/sFlow-Telemetrie auf, erkennt volumetrische DDoS-Angriffe in Sekunden und löst entweder automatische BGP-RTBH- und FlowSpec-Mitigation aus oder verwirft den Angriff selbst im Linux-Kernel mit XDP. Kostenlos und quelloffen.",
  },
  nav: {
    features: "Funktionen",
    how: "Funktionsweise",
    compare: "Vergleich",
    docs: "Doku",
    star: "Auf GitHub favorisieren",
    readDocs: "Zur Doku",
    buildConfig: "Config erstellen",
    viewGithub: "Auf GitHub ansehen",
    menu: "Menü",
    docFull: "Vollständige Doku ansehen",
  },
  hero: {
    eyebrow: "Open Source · Apache 2.0",
    h1a: "Volumetrische DDoS in Sekunden stoppen —",
    h1b: "mit einer einzigen Binary.",
    sub: "Kapkan nimmt NetFlow, IPFIX und sFlow von Ihren Routern auf, erkennt volumetrische Angriffe auf die von Ihnen geschützten Präfixe und löst automatisches BGP-Blackholing oder chirurgische FlowSpec-Mitigation aus — oder verwirft den Angriff selbst, im Linux-Kernel, mit XDP. Kostenlos, quelloffen, standardmäßig Dry-Run.",
    trust: ["Eine Go-Binary", "Kein Sidecar", "Standardmäßig Dry-Run", "IPv4 + IPv6"],
  },
  stats: ["≥20M Flows/s/Kern", "Erkennung in Sekunden", "/32 + /128 RTBH", "FlowSpec RFC 8955/8956", "Eine statische Binary"],
  how: {
    heading: "Die Geschichte in vier Verben.",
    sub: "Eine schlanke Architektur ohne Sidecars, Message-Queues oder externe Abhängigkeiten. Einfach die Binary starten.",
    steps: [
      {
        title: "ERFASSEN",
        body: "Richten Sie die Flow-Exporter Ihrer Router auf Kapkan. sFlow v5, NetFlow v5/v9 und IPFIX über UDP, vollständig in-process verarbeitet — ohne Sidecar-Daemons.",
      },
      {
        title: "ERKENNEN",
        body: "Pro Ziel sampling-korrigierte pps-/Mbps-/Flows-pro-Sekunde-Schwellen über ein gleitendes Fenster — plus protokollspezifische Limits und gelernte Baselines.",
      },
      {
        title: "ABWEHREN",
        body: "Ein eingebetteter BGP-Speaker kündigt /32- oder /128-Blackhole-Routen an oder verteilt chirurgische FlowSpec-Regeln, die nur den Angriffsvektor verwerfen. Automatischer Rückzug.",
      },
      {
        title: "VERWERFEN",
        body: "Oder ganz ohne Router: Dieselben Regeln werden in Linux-Kernel-Maps kompiliert, und Kapkan verwirft den Angriff selbst mit XDP — bevor die Pakete den Netzwerk-Stack erreichen. Jede Regel trägt ihre eigene Frist im Kernel, ein gestopptes Kapkan kann also nicht weiter Traffic verwerfen.",
      },
    ],
  },
  features: {
    heading: "Enterprise-Funktionen, kostenlos.",
    sub: "Der Funktionsumfang, für den kommerzielle Flow-DDoS-Produkte Tausende verlangen — in einer einzigen Apache-2.0-Binary.",
    safetyTag: "SICHERHEIT",
    learnMore: "Wie die Mitigation im Kernel funktioniert",
    cards: [
      { title: "Multiprotokoll-Flow-Aufnahme", body: "sFlow, NetFlow v5/v9, IPFIX über UDP im Library-Modus — kein zusätzlicher Daemon nötig." },
      { title: "Volumetrische Erkennung im Subsekundenbereich", body: "Sampling-korrigierte pps/Mbps/Flows-Schwellen über ein gleitendes Fenster, ≥20M Flows/s/Kern." },
      { title: "RTBH + chirurgischer FlowSpec", body: "Den ganzen Host blackholen oder nur den Angriffsvektor verwerfen. IPv6-FlowSpec auf voller Parität mit IPv4." },
      { title: "Angriffsklassifizierung", body: "Amplification (NTP/DNS/memcached), SYN-/UDP-/ICMP-Floods — mit einer „Warum ausgelöst“-Aufschlüsselung." },
      { title: "Kontinuierlich gelernte Baselines", body: "Kapkan lernt online den Normalverkehr jedes Hosts und verschärft Schwellen automatisch. Schluss mit manuellem Tuning." },
      { title: "Sicher by Design", body: "Standardmäßig Dry-Run, automatischer TTL-Rückzug, Limits für aktive Sperren und eine geschützte Whitelist, die NIEMALS gesperrt wird." },
      { title: "Carpet-Bombing-Erkennung", body: "Erkennt über ein ganzes Präfix verteilte schwache Floods, die an Per-IP-Schwellen vorbeischlüpfen." },
      { title: "Volle Beobachtbarkeit", body: "REST-API, Prometheus /metrics sowie Telegram-, Slack-, E-Mail-, Webhook- und Exec-Hook-Benachrichtigungen." },
      { title: "Mandantenfähig & auditiert", body: "Pro-Mandant-Scoping, rollenbasierte API-Tokens (viewer/operator) und ein dem Operator zugeordnetes Audit-Log." },
      {
        title: "Mitigation im Kernel mit XDP",
        body: "Kapkan kann eine Erkennung selbst durchsetzen, statt einen Router darum zu bitten. Dieselben Regeln, die es als FlowSpec ankündigen würde, werden in Linux-Kernel-Maps kompiliert und von einem XDP-Programm angewendet — inklusive Ratenbegrenzung pro Quelle, die BGP FlowSpec strukturell nicht ausdrücken kann. Linux 5.15+, nichts auf der Maschine zu kompilieren, und jede Regel läuft im Kernel selbst ab, ein abgestürztes Kapkan kann Ihren Traffic also nicht verworfen zurücklassen. Dry-Run bleibt der Standard.",
      },
    ],
  },
  showcase: {
    heading: "Eine echte Operator-Konsole, kostenlos inklusive.",
    sub: "Kein Wühlen in Rohlogs. Kapkan bringt eine eingebaute, reaktive UI für den SOC-Kriegsraum mit — Angriffe, Hosts und Mitigation an einem Ort.",
  },
  compare: {
    heading: "So schneiden wir ab.",
    sub: "Entwickelt, um teure Legacy-Flow-Analyzer durch einen modernen Single-Binary-Ansatz zu ersetzen.",
    colFeature: "Funktion",
    colKapkan: "Kapkan",
    colThem: "Kommerzielle Tools",
    rows: [
      { feature: "Lizenzmodell", kapkan: "Kostenlos & quelloffen (Apache 2.0)", them: "Kostenpflichtige Lizenz / volumenbasiert" },
      { feature: "Operator-Dashboard", kapkan: "Kostenlos enthalten", them: "Kostenpflichtiges Add-on" },
      { feature: "IPv6-FlowSpec-Parität", kapkan: "Volle Parität mit IPv4", them: "Nicht unterstützt / Roadmap" },
      { feature: "Kontinuierliche Baselines", kapkan: "Online, automatisches Tuning", them: "Offline-Rechner, Copy-Paste" },
      { feature: "Automatisierungslogik", kapkan: "Deklarative Eskalationsstufen", them: "Eigene Bash-/Callback-Skripte" },
      { feature: "Architektur", kapkan: "Eine statische Binary, kein Sidecar", them: "Setup mit mehreren Daemons" },
    ],
  },
  quickstart: {
    heading: "In Minuten einsatzbereit — zuerst Dry-Run.",
    bodyBefore:
      "Kapkan ist standardmäßig sicher im Betrieb. Jedes potenzielle Blackhole bzw. jede FlowSpec-Ankündigung wird protokolliert und über die API bereitgestellt, aber niemals an Ihre BGP-Peers angekündigt, bis Sie explizit ",
    bodyAfter: " umlegen.",
    cta: "Vollständige Doku ansehen",
  },
  cta: { heading: "Stell die Falle. Schütze dein Netzwerk.", sub: "Für immer kostenlos. Apache 2.0. An einem Nachmittag ausgerollt." },
  footer: {
    tagline: "Kostenlose Open-Source-DDoS-Erkennung & -Mitigation — ankündigen oder selbst verwerfen.",
    product: "Produkt",
    docsCol: "Doku",
    project: "Projekt",
    features: "Funktionen",
    compare: "Vergleich",
    configBuilder: "Config-Builder",
    quickstart: "Schnellstart",
    configuration: "Konfiguration",
    api: "API",
    safety: "Sicherheitsmodell",
    github: "GitHub",
    releases: "Releases",
    license: "Lizenz (Apache 2.0)",
  },
};

const fr: LandingDict = {
  meta: {
    title: "Kapkan — détection et mitigation DDoS open source et gratuites",
    description:
      "Kapkan est un binaire Go unique : il ingère la télémétrie NetFlow/IPFIX/sFlow, détecte les attaques DDoS volumétriques en quelques secondes et déclenche soit une mitigation automatique BGP RTBH et FlowSpec, soit rejette l'attaque lui-même dans le noyau Linux avec XDP. Gratuit et open source.",
  },
  nav: {
    features: "Fonctionnalités",
    how: "Fonctionnement",
    compare: "Comparer",
    docs: "Docs",
    star: "Star sur GitHub",
    readDocs: "Lire la doc",
    buildConfig: "Créer une config",
    viewGithub: "Voir sur GitHub",
    menu: "Menu",
    docFull: "Voir toute la documentation",
  },
  hero: {
    eyebrow: "Open Source · Apache 2.0",
    h1a: "Stoppez le DDoS volumétrique en quelques secondes —",
    h1b: "avec un seul binaire.",
    sub: "Kapkan ingère NetFlow, IPFIX et sFlow depuis vos routeurs, détecte les attaques volumétriques contre les préfixes que vous protégez et déclenche un blackhole BGP automatique ou une mitigation FlowSpec chirurgicale — ou rejette l'attaque lui-même, dans le noyau Linux, avec XDP. Gratuit, open source, dry-run par défaut.",
    trust: ["Un seul binaire Go", "Sans sidecar", "Dry-run par défaut", "IPv4 + IPv6"],
  },
  stats: ["≥20M flux/s/cœur", "Détection en quelques secondes", "/32 + /128 RTBH", "FlowSpec RFC 8955/8956", "Un binaire statique unique"],
  how: {
    heading: "Tout tient en quatre verbes.",
    sub: "Une architecture épurée, sans sidecar, sans file de messages ni dépendance externe. Lancez simplement le binaire.",
    steps: [
      {
        title: "INGÉRER",
        body: "Pointez les exportateurs de flux de vos routeurs vers Kapkan. sFlow v5, NetFlow v5/v9 et IPFIX sur UDP, traités entièrement in-process — sans daemon sidecar.",
      },
      {
        title: "DÉTECTER",
        body: "Seuils pps / Mbps / flux-par-seconde par destination, corrigés de l'échantillonnage sur une fenêtre glissante — plus des limites par protocole et des baselines apprises.",
      },
      {
        title: "ATTÉNUER",
        body: "Un locuteur BGP intégré annonce des routes blackhole /32 ou /128, ou distribue des règles FlowSpec chirurgicales ne supprimant que le vecteur d'attaque. Retrait automatique.",
      },
      {
        title: "REJETER",
        body: "Ou sans routeur du tout : les mêmes règles sont compilées dans les maps du noyau Linux, et Kapkan rejette l'attaque lui-même avec XDP — avant que les paquets n'atteignent la pile réseau. Chaque règle porte sa propre échéance dans le noyau : un Kapkan arrêté ne peut donc pas continuer à rejeter du trafic.",
      },
    ],
  },
  features: {
    heading: "Des capacités de niveau entreprise, gratuites.",
    sub: "L'ensemble de fonctionnalités facturé des milliers par les produits flow-DDoS commerciaux, réuni dans un seul binaire Apache 2.0.",
    safetyTag: "SÛRETÉ",
    learnMore: "Comment fonctionne la mitigation dans le noyau",
    cards: [
      { title: "Ingestion de flux multi-protocole", body: "sFlow, NetFlow v5/v9, IPFIX sur UDP en mode bibliothèque — aucun daemon supplémentaire requis." },
      { title: "Détection volumétrique en moins d'une seconde", body: "Seuils pps/Mbps/flux corrigés de l'échantillonnage sur une fenêtre glissante, ≥20M flux/s/cœur." },
      { title: "RTBH + FlowSpec chirurgical", body: "Blackholer l'hôte entier, ou ne supprimer que le vecteur d'attaque. FlowSpec IPv6 à pleine parité avec IPv4." },
      { title: "Classification des attaques", body: "Amplification (NTP/DNS/memcached), floods SYN/UDP/ICMP — avec une explication « pourquoi déclenché »." },
      { title: "Baselines apprises en continu", body: "Kapkan apprend en ligne le trafic normal de chaque hôte et resserre les seuils automatiquement. Fini le réglage manuel." },
      { title: "Sûr par conception", body: "Dry-run par défaut, retrait automatique par TTL, plafonds de bans actifs et une whitelist protégée JAMAIS bannie." },
      { title: "Détection du carpet-bombing", body: "Repère les floods faibles répartis sur tout un préfixe qui échappent aux seuils par IP." },
      { title: "Observabilité complète", body: "API REST, Prometheus /metrics, plus notifications Telegram, Slack, e-mail, webhook et exec-hook." },
      { title: "Multi-locataire & audité", body: "Cloisonnement par locataire, jetons d'API par rôle (viewer/operator) et journal d'audit attribué à l'opérateur." },
      {
        title: "Mitigation dans le noyau avec XDP",
        body: "Kapkan peut appliquer une détection lui-même au lieu de le demander à un routeur. Les mêmes règles qu'il annoncerait en FlowSpec sont compilées dans les maps du noyau Linux et appliquées par un programme XDP — y compris une limitation de débit par source, que BGP FlowSpec ne peut structurellement pas exprimer. Linux 5.15+, rien à compiler sur la machine, et chaque règle expire dans le noyau : un Kapkan qui meurt ne peut pas laisser votre trafic rejeté. Le dry-run reste la valeur par défaut.",
      },
    ],
  },
  showcase: {
    heading: "Une vraie console opérateur, incluse gratuitement.",
    sub: "Fini de fouiller les logs bruts. Kapkan embarque une UI réactive pour la war-room du SOC — attaques, hôtes et mitigation au même endroit.",
  },
  compare: {
    heading: "Comment nous nous situons.",
    sub: "Conçu pour remplacer les coûteux analyseurs de flux hérités par une approche moderne à binaire unique.",
    colFeature: "Fonctionnalité",
    colKapkan: "Kapkan",
    colThem: "Outils commerciaux",
    rows: [
      { feature: "Modèle de licence", kapkan: "Gratuit & open source (Apache 2.0)", them: "Licence payante / au volume" },
      { feature: "Tableau de bord opérateur", kapkan: "Inclus gratuitement", them: "Option payante" },
      { feature: "Parité FlowSpec IPv6", kapkan: "Pleine parité avec IPv4", them: "Non pris en charge / roadmap" },
      { feature: "Baselines continues", kapkan: "En ligne, réglage automatique", them: "Calculateur hors ligne, copier-coller" },
      { feature: "Logique d'automatisation", kapkan: "Échelles d'escalade déclaratives", them: "Scripts bash/callback maison" },
      { feature: "Architecture", kapkan: "Un binaire statique, sans sidecar", them: "Installation multi-daemon" },
    ],
  },
  quickstart: {
    heading: "Opérationnel en quelques minutes — dry-run d'abord.",
    bodyBefore:
      "Kapkan est sûr à déployer par défaut. Chaque blackhole potentiel ou annonce FlowSpec est journalisé et exposé via l'API, mais jamais annoncé à vos pairs BGP tant que vous ne basculez pas explicitement ",
    bodyAfter: ".",
    cta: "Voir toute la documentation",
  },
  cta: { heading: "Tendez le piège. Protégez votre réseau.", sub: "Gratuit pour toujours. Apache 2.0. Déployé en un après-midi." },
  footer: {
    tagline: "Détection et mitigation DDoS open source et gratuites — annoncer, ou rejeter soi-même.",
    product: "Produit",
    docsCol: "Docs",
    project: "Projet",
    features: "Fonctionnalités",
    compare: "Comparer",
    configBuilder: "Générateur de config",
    quickstart: "Démarrage rapide",
    configuration: "Configuration",
    api: "API",
    safety: "Modèle de sûreté",
    github: "GitHub",
    releases: "Versions",
    license: "Licence (Apache 2.0)",
  },
};

const es: LandingDict = {
  meta: {
    title: "Kapkan — detección y mitigación de DDoS gratuita y de código abierto",
    description:
      "Kapkan es un único binario Go: ingiere telemetría NetFlow/IPFIX/sFlow, detecta ataques DDoS volumétricos en segundos y o dispara mitigación automática BGP RTBH y FlowSpec, o descarta el ataque él mismo en el kernel de Linux con XDP. Gratis y de código abierto.",
  },
  nav: {
    features: "Funciones",
    how: "Cómo funciona",
    compare: "Comparar",
    docs: "Docs",
    star: "Estrella en GitHub",
    readDocs: "Leer la documentación",
    buildConfig: "Crear configuración",
    viewGithub: "Ver en GitHub",
    menu: "Menú",
    docFull: "Ver toda la documentación",
  },
  hero: {
    eyebrow: "Open Source · Apache 2.0",
    h1a: "Detén el DDoS volumétrico en segundos —",
    h1b: "con un solo binario.",
    sub: "Kapkan ingiere NetFlow, IPFIX y sFlow desde tus routers, detecta ataques volumétricos contra los prefijos que proteges y dispara blackhole BGP automático o mitigación FlowSpec quirúrgica — o descarta el ataque él mismo, en el kernel de Linux, con XDP. Gratis, de código abierto, dry-run por defecto.",
    trust: ["Un solo binario Go", "Sin sidecar", "Dry-run por defecto", "IPv4 + IPv6"],
  },
  stats: ["≥20M flujos/s/núcleo", "Detección en segundos", "/32 + /128 RTBH", "FlowSpec RFC 8955/8956", "Un único binario estático"],
  how: {
    heading: "Todo en cuatro verbos.",
    sub: "Una arquitectura simplificada sin sidecars, colas de mensajes ni dependencias externas. Solo ejecuta el binario.",
    steps: [
      {
        title: "INGERIR",
        body: "Apunta los exportadores de flujo de tus routers a Kapkan. sFlow v5, NetFlow v5/v9 e IPFIX sobre UDP, procesados completamente in-process — sin daemons sidecar.",
      },
      {
        title: "DETECTAR",
        body: "Umbrales de pps / Mbps / flujos-por-segundo por destino, corregidos por muestreo sobre una ventana deslizante — además de límites por protocolo y baselines aprendidas.",
      },
      {
        title: "MITIGAR",
        body: "Un speaker BGP integrado anuncia rutas blackhole /32 o /128, o distribuye reglas FlowSpec quirúrgicas que descartan solo el vector de ataque. Se retiran automáticamente.",
      },
      {
        title: "DESCARTAR",
        body: "O sin router alguno: las mismas reglas se compilan en mapas del kernel de Linux y Kapkan descarta el ataque él mismo con XDP — antes de que los paquetes lleguen a la pila de red. Cada regla lleva su propio plazo dentro del kernel, así que un Kapkan detenido no puede seguir descartando tráfico.",
      },
    ],
  },
  features: {
    heading: "Capacidades de nivel empresarial, gratis.",
    sub: "El conjunto de funciones por el que los productos comerciales de flow-DDoS cobran miles, en un único binario Apache 2.0.",
    safetyTag: "SEGURIDAD",
    learnMore: "Cómo funciona la mitigación en el kernel",
    cards: [
      { title: "Ingesta de flujo multiprotocolo", body: "sFlow, NetFlow v5/v9, IPFIX sobre UDP en modo biblioteca — sin daemon adicional." },
      { title: "Detección volumétrica en menos de un segundo", body: "Umbrales de pps/Mbps/flujos corregidos por muestreo sobre una ventana deslizante, ≥20M flujos/s/núcleo." },
      { title: "RTBH + FlowSpec quirúrgico", body: "Blackhole del host completo, o descartar solo el vector de ataque. FlowSpec IPv6 con plena paridad con IPv4." },
      { title: "Clasificación de ataques", body: "Amplificación (NTP/DNS/memcached), floods SYN/UDP/ICMP — con un desglose de «por qué se disparó»." },
      { title: "Baselines aprendidas en continuo", body: "Kapkan aprende en línea el tráfico normal de cada host y ajusta los umbrales automáticamente. Deja de calibrar a mano." },
      { title: "Seguro por diseño", body: "Dry-run por defecto, retirada automática por TTL, topes de bans activos y una whitelist protegida que NUNCA se banea." },
      { title: "Detección de carpet-bombing", body: "Detecta floods de baja intensidad repartidos por todo un prefijo que se escapan de los umbrales por IP." },
      { title: "Observabilidad completa", body: "API REST, Prometheus /metrics, además de notificaciones por Telegram, Slack, email, webhook y exec-hook." },
      { title: "Multiinquilino y auditado", body: "Aislamiento por inquilino, tokens de API por rol (viewer/operator) y un registro de auditoría atribuido al operador." },
      {
        title: "Mitigación en el kernel con XDP",
        body: "Kapkan puede aplicar una detección él mismo en lugar de pedírselo a un router. Las mismas reglas que anunciaría como FlowSpec se compilan en mapas del kernel de Linux y las aplica un programa XDP — incluida la limitación de tasa por origen, que BGP FlowSpec no puede expresar estructuralmente. Linux 5.15+, nada que compilar en la máquina, y cada regla expira dentro del kernel, así que un Kapkan que muere no puede dejar tu tráfico descartado. El dry-run sigue siendo el valor por defecto.",
      },
    ],
  },
  showcase: {
    heading: "Una consola de operador real, incluida gratis.",
    sub: "Sin rebuscar en logs en bruto. Kapkan incluye una UI reactiva para la sala de guerra del SOC — ataques, hosts y mitigación en un solo lugar.",
  },
  compare: {
    heading: "Cómo nos comparamos.",
    sub: "Creado para reemplazar los costosos analizadores de flujo heredados con un enfoque moderno de un solo binario.",
    colFeature: "Función",
    colKapkan: "Kapkan",
    colThem: "Herramientas comerciales",
    rows: [
      { feature: "Modelo de licencia", kapkan: "Gratis y de código abierto (Apache 2.0)", them: "Licencia de pago / por volumen" },
      { feature: "Panel de operador", kapkan: "Incluido gratis", them: "Complemento de pago" },
      { feature: "Paridad FlowSpec IPv6", kapkan: "Plena paridad con IPv4", them: "No soportado / en la hoja de ruta" },
      { feature: "Baselines continuas", kapkan: "En línea, ajuste automático", them: "Calculadora offline, copiar y pegar" },
      { feature: "Lógica de automatización", kapkan: "Escaleras de escalado declarativas", them: "Scripts bash/callback propios" },
      { feature: "Arquitectura", kapkan: "Un binario estático, sin sidecar", them: "Configuración con múltiples daemons" },
    ],
  },
  quickstart: {
    heading: "En marcha en minutos — primero dry-run.",
    bodyBefore:
      "Kapkan es seguro de desplegar por defecto. Cada posible blackhole o anuncio FlowSpec se registra y se expone vía la API, pero nunca se anuncia a tus pares BGP hasta que cambies explícitamente ",
    bodyAfter: ".",
    cta: "Ver toda la documentación",
  },
  cta: { heading: "Tiende la trampa. Protege tu red.", sub: "Gratis para siempre. Apache 2.0. Despliega en una tarde." },
  footer: {
    tagline: "Detección y mitigación de DDoS gratuita y de código abierto — anunciar, o descartar tú mismo.",
    product: "Producto",
    docsCol: "Docs",
    project: "Proyecto",
    features: "Funciones",
    compare: "Comparar",
    configBuilder: "Generador de configuración",
    quickstart: "Inicio rápido",
    configuration: "Configuración",
    api: "API",
    safety: "Modelo de seguridad",
    github: "GitHub",
    releases: "Versiones",
    license: "Licencia (Apache 2.0)",
  },
};

export const landing: Record<Locale, LandingDict> = { en, ru, de, fr, es };
