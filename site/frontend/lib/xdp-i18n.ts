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
      "Kapkan drops the attack itself, inside the Linux kernel, using a small XDP program — the moment packets arrive, on a machine you already run. A separate rate limit for each source, watch-only by default, and every rule expires inside the kernel.",
  },
  nav: { docs: "Data-plane docs", home: "Home", backToSite: "kapkan.io" },
  hero: {
    eyebrow: "In-kernel data plane",
    h1a: "Drop the attack",
    h1b: "in the kernel.",
    sub: "Normally Kapkan asks a router to drop the attack. This drops it itself. On the machine Kapkan runs on, it loads a tiny program into the Linux kernel (XDP) that throws away attack packets the instant they arrive — no router, no waiting. Same detection, same safety checks, one less thing that has to say yes.",
    ctaDocs: "Read the data-plane docs",
    ctaConfig: "Build a config",
    trust: ["Linux 5.15+", "Nothing to compile on the box", "Watch-only by default", "Rules expire in the kernel"],
    shotAlt: "Kapkan console: three active attacks, each mitigated by In-kernel drop (XDP)",
    shotCaption: "Three live detections, each dropped in the kernel — not announced to a router.",
  },
  contrast: {
    heading: "Announce, or drop.",
    sub: "Kapkan has always turned a detection into a BGP message — a blackhole route, or a precise FlowSpec rule — and left the actual dropping to your routers. The data plane adds a second option: do it yourself.",
    announce: {
      title: "Announce (RTBH / FlowSpec)",
      body: "Kapkan tells a router what to drop. The router does the work, wherever it sits in your network.",
      points: [
        "Reaches every IP range your routers carry, far upstream of any single machine.",
        "Needs a router that speaks BGP, and a session it already trusts.",
        "Matches on packet headers only — it can't give each source its own rate limit.",
      ],
    },
    drop: {
      title: "Drop (in-kernel XDP)",
      body: "Kapkan drops the packet itself, in the kernel of the machine running it, before the rest of the system even sees it.",
      points: [
        "No router, no BGP session, no waiting — the rule is just an entry in a kernel table.",
        "Runs at the earliest point software can touch a packet: the driver's receive path.",
        "Gives each attacking source its own budget — the one thing FlowSpec can't do.",
      ],
    },
  },
  how: {
    heading: "From detection to dropped packet.",
    sub: "The data plane plugs in at the same point as every other mitigation, so a detection reaches it having already passed every safety check. Only the last step changes: instead of announcing a route, the rules become entries in kernel tables.",
    steps: [
      {
        title: "The detector fires",
        body: "The same sampling-corrected limits, learned baselines and classifier as always. Detection doesn't change just because the mitigation does.",
      },
      {
        title: "Rules are generated",
        body: "The detection produces the very rules it would have announced as FlowSpec — aimed at the victim, at most a handful per attack — but through a second encoder instead of the BGP one.",
      },
      {
        title: "Rules load into the kernel",
        body: "The rules are written into the XDP program's kernel tables, double-buffered so a reload swaps a whole set at once — with no moment where traffic goes unmatched.",
      },
      {
        title: "The kernel decides",
        body: "For every packet the program checks a fixed list — allow-list, static rules, victim match, per-source budget — and returns pass or drop. The default is always pass.",
      },
    ],
    diagram: {
      detect: "Detection",
      compile: "Rule encoder",
      maps: "Kernel tables",
      verdict: "XDP program",
      pass: "PASS (default)",
      drop: "DROP (matched)",
      caption: "Every packet on the interface takes this path. Anything the rules don't match is passed through untouched.",
    },
  },
  ratelimit: {
    heading: "Per-source rate limiting — the one thing FlowSpec can't do.",
    body: "A FlowSpec rule can match a flow and drop it, or cap it to one shared speed. It has no way to say “hold every single source to N”. The data plane does: each attacking source gets its own token bucket in the kernel. Set the limit to N and each source is held to N — instead of a thousand sources and your real users all fighting over one shared ceiling.",
    aside: "This is the one thing BGP simply can't do — not a faster version of an old trick, but a new one.",
  },
  safety: {
    heading: "Safe by design.",
    sub: "The data plane keeps every safety property Kapkan already had, because it plugs in at the same point — and adds one the kernel enforces on its own.",
    cards: [
      {
        title: "Watch-only is still the default",
        body: "Until you switch it live, the program attaches, matches and counts exactly as it would in production — but every “drop” becomes a “pass”. You see what it would do before it does anything.",
      },
      {
        title: "Rules expire inside the kernel",
        body: "Every generated rule carries its own deadline, and the program treats an expired rule as gone. A Kapkan that is killed, hung or restarted can't leave a victim's traffic dropped: the kernel forgets on schedule, with no daemon needed.",
      },
      {
        title: "The protected list is enforced in the kernel",
        body: "Your protected list is checked in the program itself, by both source and destination — so a protected host inside a blocked range keeps receiving traffic, with no trip back to user space.",
      },
      {
        title: "The default is pass",
        body: "Anything the rules don't explicitly match is forwarded. There's no hidden “deny everything”: even the one packet shape the program can't fully inspect is passed and counted, not dropped.",
      },
    ],
  },
  measured: {
    heading: "Measured, not claimed.",
    sub: "Eighteen recorded attacks run end to end on every change — fake telemetry into the real detector, its rules loaded into real kernel tables, then the recorded packets replayed through the program, with legitimate traffic mixed in the whole time.",
    stats: [
      { value: "18", label: "recorded attacks, every build" },
      { value: "100%", label: "of attack traffic dropped on 17 of 18 (98.5% on the per-source rate-limit test)" },
      { value: "0", label: "legitimate packets dropped · 0 allow-listed packets dropped" },
      { value: "5.15–6.12", label: "kernels the full suite runs on in CI (5.15, 6.1, 6.6, 6.12)" },
    ],
    caveat:
      "These are block rates, not throughput. A block rate tells you what share of an attack the rules catch; it says nothing about how many packets a given machine can absorb, which depends on your NIC, driver, CPU and whether the program attached in native or generic mode. Size your deployment on your own hardware.",
  },
  limits: {
    heading: "The honest limits.",
    sub: "Two things worth knowing before you deploy it — stated here rather than found later.",
    items: [
      {
        title: "One IPv6 packet shape is passed without checking",
        body: "An IPv6 packet with more than eight extension headers is forwarded without a rule being checked — walking a longer chain would cost the program more kernel budget than it has. This is on purpose: a parse limit that dropped packets would be a hidden “deny everything”. No real traffic chains eight headers, so it is counted and shown — the CLI and console flag any change on that counter — not quietly buried.",
      },
      {
        title: "Native and generic attach differ in capacity",
        body: "On a driver with native XDP support the program runs in the driver's receive path, before the kernel builds its packet buffer. Without it, the kernel falls back to generic mode — correct, but it does far less per CPU core. Kapkan reports which mode each interface got; plan capacity around native, and treat generic as a working fallback, not the target.",
      },
    ],
  },
  requirements: {
    heading: "What it needs.",
    sub: "No agent, no sidecar, no compiler on the box. The program ships as ready-to-run bytecode inside the binary.",
    items: [
      "Linux 5.15 or newer, with BTF (CONFIG_DEBUG_INFO_BTF=y — every mainstream distro kernel has it).",
      "CAP_BPF and CAP_NET_ADMIN, and a writable bpffs at /sys/fs/bpf.",
      "An interface to attach to. Native XDP if the driver supports it; generic otherwise.",
      "Nothing to build. The XDP program is compiled ahead of time and shipped inside the Kapkan binary.",
    ],
  },
  showcaseCaption:
    "One live detection, expanded in the console: the escalation ladder holding at In-kernel drop (XDP), and the exact rule it loaded into the kernel — dst 203.0.113.45/32, proto udp → discard.",
  cta: {
    heading: "Drop it yourself.",
    sub: "Add a dataplane block, leave watch-only on, and see what it would drop before it drops anything.",
    primary: "Read the data-plane docs",
    secondary: "Build a config",
  },
};

const ru: XdpDict = {
  "meta": {
    "title": "Подавление атак в ядре через XDP — Kapkan",
    "description": "Kapkan сбрасывает атаку сам, прямо в ядре Linux, небольшой XDP-программой — в тот же миг, как приходят пакеты, на машине, которая у вас уже работает. Отдельный лимит скорости для каждого источника, «только наблюдение» по умолчанию, и каждое правило истекает прямо в ядре."
  },
  "nav": {
    "docs": "Документация по плоскости данных",
    "home": "Главная",
    "backToSite": "kapkan.io"
  },
  "hero": {
    "eyebrow": "Плоскость данных в ядре",
    "h1a": "Отбросьте атаку",
    "h1b": "в ядре.",
    "sub": "Обычно Kapkan просит маршрутизатор сбросить атаку. Здесь он сбрасывает её сам. На машине, где работает Kapkan, он загружает крошечную программу в ядро Linux (XDP), и она выбрасывает атакующие пакеты в тот же миг, как они приходят, — без маршрутизатора и без ожидания. То же обнаружение, те же проверки безопасности, на одно «да» меньше.",
    "ctaDocs": "Читать документацию по плоскости данных",
    "ctaConfig": "Собрать конфигурацию",
    "trust": [
      "Linux 5.15+",
      "Ничего не нужно компилировать на машине",
      "«Только наблюдение» по умолчанию",
      "Правила истекают в ядре"
    ],
    "shotAlt": "Консоль Kapkan: три активные атаки, каждая подавлена отбросом в ядре (XDP)",
    "shotCaption": "Три активных обнаружения, каждое отброшено в ядре — а не анонсировано маршрутизатору."
  },
  "contrast": {
    "heading": "Анонсировать или отбросить.",
    "sub": "Kapkan всегда превращал обнаружение в BGP-сообщение — blackhole-маршрут или точное правило FlowSpec — и оставлял сам отброс вашим маршрутизаторам. Плоскость данных добавляет второй вариант: сделать это самому.",
    "announce": {
      "title": "Анонс (RTBH / FlowSpec)",
      "body": "Kapkan сообщает маршрутизатору, что отбрасывать. Работу делает сам маршрутизатор — где бы он ни стоял в вашей сети.",
      "points": [
        "Достаёт до каждого диапазона адресов, который несут ваши маршрутизаторы, — намного выше по потоку любой отдельной машины.",
        "Нужен маршрутизатор, который говорит на BGP, и сессия, которой он уже доверяет.",
        "Сопоставляет только заголовки пакетов — он не может дать каждому источнику свой лимит скорости."
      ]
    },
    "drop": {
      "title": "Отброс (XDP в ядре)",
      "body": "Kapkan отбрасывает пакет сам, в ядре той машины, где он запущен, ещё до того как его увидит остальная система.",
      "points": [
        "Ни маршрутизатора, ни BGP-сессии, ни ожидания — правило это просто запись в таблице ядра.",
        "Работает в самой ранней точке, где ПО вообще может коснуться пакета: на пути приёма в драйвере.",
        "Даёт каждому атакующему источнику свой бюджет — то единственное, чего FlowSpec не умеет."
      ]
    }
  },
  "how": {
    "heading": "От обнаружения до отброшенного пакета.",
    "sub": "Плоскость данных подключается в той же точке, что и любое другое подавление, поэтому обнаружение доходит до неё, уже пройдя все проверки безопасности. Меняется только последний шаг: вместо анонса маршрута правила становятся записями в таблицах ядра.",
    "steps": [
      {
        "title": "Срабатывает детектор",
        "body": "Те же пределы с поправкой на выборку, обученные базовые уровни и классификатор, что и всегда. Обнаружение не меняется от того, что меняется подавление."
      },
      {
        "title": "Генерируются правила",
        "body": "Обнаружение порождает ровно те правила, которые оно анонсировало бы как FlowSpec — нацеленные на жертву, не больше горстки на атаку, — но через второй кодировщик, а не через BGP."
      },
      {
        "title": "Правила загружаются в ядро",
        "body": "Правила записываются в таблицы ядра XDP-программы с двойной буферизацией, так что перезагрузка меняет весь набор разом — без момента, когда трафик остаётся без сопоставления."
      },
      {
        "title": "Решает ядро",
        "body": "Для каждого пакета программа проверяет фиксированный список — белый список, статические правила, совпадение с жертвой, бюджет на источник — и возвращает: пропустить или отбросить. По умолчанию — всегда пропустить."
      }
    ],
    "diagram": {
      "detect": "Обнаружение",
      "compile": "Кодировщик правил",
      "maps": "Таблицы ядра",
      "verdict": "XDP-программа",
      "pass": "ПРОПУСК (по умолчанию)",
      "drop": "ОТБРОС (совпадение)",
      "caption": "Каждый пакет на интерфейсе проходит этот путь. Всё, с чем правила не совпали, пропускается насквозь нетронутым."
    }
  },
  "ratelimit": {
    "heading": "Лимит скорости по каждому источнику — то единственное, чего FlowSpec не умеет.",
    "body": "Правило FlowSpec может сопоставить поток и отбросить его или ограничить одной общей скоростью. Оно никак не может сказать «держи каждый отдельный источник на уровне N». А плоскость данных может: каждый атакующий источник получает свою корзину токенов прямо в ядре. Задаёте N — и каждый источник держится на N, вместо того чтобы тысяча источников и ваши настоящие пользователи дрались за один общий потолок.",
    "aside": "Это единственное, чего BGP не умеет в принципе, — не ускоренная версия старого приёма, а новый."
  },
  "safety": {
    "heading": "Безопасно по устройству.",
    "sub": "Плоскость данных сохраняет все свойства безопасности, что уже были у Kapkan, потому что подключается в той же точке, — и добавляет ещё одно, которое ядро обеспечивает само.",
    "cards": [
      {
        "title": "«Только наблюдение» по-прежнему по умолчанию",
        "body": "Пока вы не переключите её в боевой режим, программа подключается, сопоставляет и считает ровно так же, как в бою, — но каждый «отброс» превращается в «пропуск». Вы видите, что она сделала бы, ещё до того как она что-либо сделает."
      },
      {
        "title": "Правила истекают прямо в ядре",
        "body": "У каждого сгенерированного правила свой срок, и программа считает истёкшее правило исчезнувшим. Kapkan, который убит, завис или перезапущен, не может оставить трафик жертвы отброшенным: ядро забывает по расписанию, без участия демона."
      },
      {
        "title": "Защищённый список применяется в ядре",
        "body": "Ваш защищённый список проверяется в самой программе, и по источнику, и по назначению, — так что защищённый хост внутри заблокированного диапазона продолжает получать трафик, без обращения обратно в пространство пользователя."
      },
      {
        "title": "По умолчанию — пропустить",
        "body": "Всё, с чем правила явно не совпали, пересылается дальше. Никакого скрытого «запретить всё»: даже единственный вид пакета, который программа не может полностью разобрать, пропускается и учитывается, а не отбрасывается."
      }
    ]
  },
  "measured": {
    "heading": "Измерено, а не заявлено.",
    "sub": "Восемнадцать записанных атак прогоняются от начала до конца при каждом изменении — искусственная телеметрия подаётся в настоящий детектор, его правила загружаются в настоящие таблицы ядра, затем записанные пакеты воспроизводятся через программу, а легитимный трафик подмешан на всём протяжении.",
    "stats": [
      {
        "value": "18",
        "label": "записанных атак в каждой сборке"
      },
      {
        "value": "100%",
        "label": "трафика атаки отброшено на 17 из 18 (98.5% в тесте с лимитом по источникам)"
      },
      {
        "value": "0",
        "label": "легитимных пакетов отброшено · 0 пакетов из белого списка отброшено"
      },
      {
        "value": "5.15–6.12",
        "label": "ядра, на которых весь набор гоняется в CI (5.15, 6.1, 6.6, 6.12)"
      }
    ],
    "caveat": "Это доли блокировки, а не пропускная способность. Доля блокировки говорит, какую часть атаки ловят правила; она ничего не говорит о том, сколько пакетов способна принять конкретная машина, — а это зависит от вашей NIC, драйвера, процессора и от того, подключилась ли программа в нативном или обобщённом режиме. Рассчитывайте масштаб развёртывания на собственном оборудовании."
  },
  "limits": {
    "heading": "Честные ограничения.",
    "sub": "Две вещи, которые стоит знать до развёртывания, — сказанные здесь, а не обнаруженные потом.",
    "items": [
      {
        "title": "Один вид IPv6-пакета пропускается без проверки",
        "body": "IPv6-пакет с более чем восемью заголовками расширения пересылается дальше без проверки правила — проход по более длинной цепочке стоил бы программе больше бюджета ядра, чем у неё есть. Это сделано намеренно: ограничение разбора, которое отбрасывало бы пакеты, было бы скрытым «запретить всё». Реальный трафик не выстраивает и восьми заголовков, поэтому такой случай учитывается и показывается — CLI и консоль отмечают любое изменение этого счётчика, — а не замалчивается."
      },
      {
        "title": "Нативное и обобщённое подключение различаются по мощности",
        "body": "На драйвере с нативной поддержкой XDP программа работает на пути приёма в драйвере, ещё до того как ядро построит свой буфер пакета. Без неё ядро откатывается в обобщённый (generic) режим — корректный, но делающий гораздо меньше на процессорное ядро. Kapkan сообщает, какой режим получил каждый интерфейс; рассчитывайте мощность на нативный режим, а обобщённый считайте рабочим запасным вариантом, а не целью."
      }
    ]
  },
  "requirements": {
    "heading": "Что ему нужно.",
    "sub": "Ни агента, ни sidecar, ни компилятора на машине. Программа поставляется как готовый к запуску байт-код внутри бинарника.",
    "items": [
      "Linux 5.15 или новее, с BTF (CONFIG_DEBUG_INFO_BTF=y — есть в ядре любого массового дистрибутива).",
      "CAP_BPF и CAP_NET_ADMIN, а также доступный для записи bpffs в /sys/fs/bpf.",
      "Интерфейс, к которому подключаться. Нативный XDP, если драйвер его поддерживает; иначе обобщённый (generic).",
      "Ничего собирать не нужно. XDP-программа скомпилирована заранее и поставляется внутри бинарника Kapkan."
    ]
  },
  "showcaseCaption": "Одно активное обнаружение, раскрытое в консоли: лестница эскалации удерживается на «отбросе в ядре (XDP)», и точное правило, которое оно загрузило в ядро, — dst 203.0.113.45/32, proto udp → discard.",
  "cta": {
    "heading": "Отбросьте сами.",
    "sub": "Добавьте блок dataplane, оставьте «только наблюдение» включённым и посмотрите, что оно отбросило бы, прежде чем оно что-либо отбросит.",
    "primary": "Читать документацию по плоскости данных",
    "secondary": "Собрать конфигурацию"
  }
};

const de: XdpDict = {
  "meta": {
    "title": "XDP-Abwehr im Kernel — Kapkan",
    "description": "Kapkan verwirft den Angriff selbst, im Linux-Kernel, mit einem kleinen XDP-Programm — in dem Moment, in dem die Pakete ankommen, auf einer Maschine, die Sie ohnehin schon betreiben. Ein eigenes Rate-Limit für jede Quelle, standardmäßig „nur beobachten“, und jede Regel läuft im Kernel selbst ab."
  },
  "nav": {
    "docs": "Datenebenen-Doku",
    "home": "Startseite",
    "backToSite": "kapkan.io"
  },
  "hero": {
    "eyebrow": "Datenebene im Kernel",
    "h1a": "Verwerfen Sie den Angriff",
    "h1b": "im Kernel.",
    "sub": "Normalerweise bittet Kapkan einen Router, den Angriff zu verwerfen. Hier verwirft es ihn selbst. Auf der Maschine, auf der Kapkan läuft, lädt es ein winziges Programm in den Linux-Kernel (XDP), das angreifende Pakete wegwirft, sobald sie ankommen — kein Router, kein Warten. Dieselbe Erkennung, dieselben Sicherheitsprüfungen, eine Stelle weniger, die Ja sagen muss.",
    "ctaDocs": "Datenebenen-Doku lesen",
    "ctaConfig": "Konfiguration erstellen",
    "trust": [
      "Linux 5.15+",
      "Nichts auf der Maschine zu kompilieren",
      "Standardmäßig „nur beobachten“",
      "Regeln laufen im Kernel ab"
    ],
    "shotAlt": "Kapkan-Konsole: drei aktive Angriffe, jeder abgewehrt durch In-kernel drop (XDP)",
    "shotCaption": "Drei Live-Erkennungen, jede im Kernel verworfen — nicht an einen Router angekündigt."
  },
  "contrast": {
    "heading": "Ankündigen oder verwerfen.",
    "sub": "Kapkan hat eine Erkennung schon immer in eine BGP-Nachricht verwandelt — eine Blackhole-Route oder eine präzise FlowSpec-Regel — und das eigentliche Verwerfen Ihren Routern überlassen. Die Datenebene fügt eine zweite Möglichkeit hinzu: Machen Sie es selbst.",
    "announce": {
      "title": "Ankündigen (RTBH / FlowSpec)",
      "body": "Kapkan sagt einem Router, was zu verwerfen ist. Der Router erledigt die Arbeit, wo auch immer er in Ihrem Netz sitzt.",
      "points": [
        "Erreicht jeden IP-Bereich, den Ihre Router führen — weit oben im Netz, vor jeder einzelnen Maschine.",
        "Braucht einen Router, der BGP spricht, und eine Session, der er bereits vertraut.",
        "Gleicht nur Paket-Header ab — und kann nicht jeder Quelle ihr eigenes Rate-Limit geben."
      ]
    },
    "drop": {
      "title": "Verwerfen (XDP im Kernel)",
      "body": "Kapkan verwirft das Paket selbst, im Kernel der Maschine, auf der es läuft, noch bevor der Rest des Systems es überhaupt sieht.",
      "points": [
        "Kein Router, keine BGP-Session, kein Warten — die Regel ist nur ein Eintrag in einer Kernel-Tabelle.",
        "Läuft am frühesten Punkt, an dem Software ein Paket berühren kann: im Empfangspfad des Treibers.",
        "Gibt jeder angreifenden Quelle ihr eigenes Budget — das Einzige, was FlowSpec nicht kann."
      ]
    }
  },
  "how": {
    "heading": "Von der Erkennung zum verworfenen Paket.",
    "sub": "Die Datenebene klinkt sich an derselben Stelle ein wie jede andere Abwehrmaßnahme, sodass eine Erkennung sie erst erreicht, nachdem sie bereits jede Sicherheitsprüfung bestanden hat. Nur der letzte Schritt ändert sich: Statt eine Route anzukündigen, werden die Regeln zu Einträgen in Kernel-Tabellen.",
    "steps": [
      {
        "title": "Der Detektor löst aus",
        "body": "Dieselben sampling-korrigierten Grenzwerte, gelernten Baselines und derselbe Klassifikator wie immer. Die Erkennung ändert sich nicht, nur weil sich die Abwehr ändert."
      },
      {
        "title": "Regeln werden erzeugt",
        "body": "Die Erkennung erzeugt genau die Regeln, die sie als FlowSpec angekündigt hätte — auf das Opfer gerichtet, höchstens eine Handvoll pro Angriff —, aber über einen zweiten Encoder statt über den BGP-Encoder."
      },
      {
        "title": "Regeln werden in den Kernel geladen",
        "body": "Die Regeln werden in die Kernel-Tabellen des XDP-Programms geschrieben, doppelt gepuffert, sodass ein Neuladen einen ganzen Satz auf einmal austauscht — ohne einen Moment, in dem Verkehr nicht abgeglichen wird."
      },
      {
        "title": "Der Kernel entscheidet",
        "body": "Für jedes Paket prüft das Programm eine feste Liste — Allow-Liste, statische Regeln, Opfer-Treffer, Budget pro Quelle — und gibt pass oder drop zurück. Die Vorgabe ist immer pass."
      }
    ],
    "diagram": {
      "detect": "Erkennung",
      "compile": "Regel-Encoder",
      "maps": "Kernel-Tabellen",
      "verdict": "XDP-Programm",
      "pass": "PASS (Standard)",
      "drop": "DROP (Treffer)",
      "caption": "Jedes Paket auf dem Interface nimmt diesen Weg. Alles, worauf die Regeln nicht passen, wird unangetastet durchgelassen."
    }
  },
  "ratelimit": {
    "heading": "Rate-Limiting pro Quelle — das Einzige, was FlowSpec nicht kann.",
    "body": "Eine FlowSpec-Regel kann einen Flow abgleichen und verwerfen oder ihn auf eine einzige gemeinsame Rate deckeln. Sie hat keine Möglichkeit zu sagen „halte jede einzelne Quelle auf N“. Die Datenebene schon: Jede angreifende Quelle bekommt ihren eigenen Token-Bucket im Kernel. Setzen Sie das Limit auf N, und jede Quelle wird auf N gehalten — statt dass tausend Quellen und Ihre echten Nutzer um eine einzige gemeinsame Obergrenze kämpfen.",
    "aside": "Das ist das Einzige, was BGP schlicht nicht kann — keine schnellere Version eines alten Tricks, sondern ein neuer."
  },
  "safety": {
    "heading": "Von Grund auf sicher.",
    "sub": "Die Datenebene behält jede Sicherheitseigenschaft, die Kapkan schon hatte, weil sie sich an derselben Stelle einklinkt — und fügt eine hinzu, die der Kernel von selbst durchsetzt.",
    "cards": [
      {
        "title": "Die Vorgabe bleibt „nur beobachten“",
        "body": "Bis Sie es scharfschalten, hängt sich das Programm an, gleicht ab und zählt genau wie im Produktivbetrieb — aber jedes „drop“ wird zu einem „pass“. Sie sehen, was es tun würde, bevor es irgendetwas tut."
      },
      {
        "title": "Regeln laufen im Kernel selbst ab",
        "body": "Jede erzeugte Regel trägt ihre eigene Frist, und das Programm behandelt eine abgelaufene Regel als nicht vorhanden. Ein Kapkan, das beendet wird, sich aufhängt oder neu startet, kann den Verkehr eines Opfers nicht verworfen zurücklassen: Der Kernel vergisst pünktlich, ganz ohne Daemon."
      },
      {
        "title": "Die geschützte Liste wird im Kernel durchgesetzt",
        "body": "Ihre geschützte Liste wird im Programm selbst geprüft, nach Quelle und nach Ziel — so bekommt ein geschützter Host innerhalb eines gesperrten Bereichs weiterhin Verkehr, ohne den Umweg zurück in den User-Space."
      },
      {
        "title": "Die Vorgabe ist pass",
        "body": "Alles, worauf die Regeln nicht ausdrücklich passen, wird weitergeleitet. Es gibt kein verstecktes „alles verbieten“: Selbst die eine Paketform, die das Programm nicht vollständig prüfen kann, wird durchgelassen und gezählt, nicht verworfen."
      }
    ]
  },
  "measured": {
    "heading": "Gemessen, nicht behauptet.",
    "sub": "Achtzehn aufgezeichnete Angriffe laufen bei jeder Änderung von Anfang bis Ende durch — künstliche Telemetrie in den echten Detektor, dessen Regeln in echte Kernel-Tabellen geladen, dann die aufgezeichneten Pakete durch das Programm abgespielt, die ganze Zeit mit legitimem Verkehr vermischt.",
    "stats": [
      {
        "value": "18",
        "label": "aufgezeichnete Angriffe, bei jedem Build"
      },
      {
        "value": "100 %",
        "label": "des Angriffsverkehrs verworfen bei 17 von 18 (98,5 % beim Rate-Limit-Test pro Quelle)"
      },
      {
        "value": "0",
        "label": "legitime Pakete verworfen · 0 Pakete der Allow-Liste verworfen"
      },
      {
        "value": "5.15–6.12",
        "label": "Kernel, auf denen die vollständige Suite in CI läuft (5.15, 6.1, 6.6, 6.12)"
      }
    ],
    "caveat": "Das sind Blockraten, kein Durchsatz. Eine Blockrate sagt Ihnen, welchen Anteil eines Angriffs die Regeln erwischen; sie sagt nichts darüber, wie viele Pakete eine bestimmte Maschine schlucken kann — das hängt von Ihrer NIC, dem Treiber, der CPU und davon ab, ob sich das Programm im nativen oder generischen Modus angehängt hat. Dimensionieren Sie Ihr Deployment auf Ihrer eigenen Hardware."
  },
  "limits": {
    "heading": "Die ehrlichen Grenzen.",
    "sub": "Zwei Dinge, die man vor dem Ausrollen wissen sollte — hier gesagt, statt später entdeckt.",
    "items": [
      {
        "title": "Eine IPv6-Paketform wird ohne Prüfung durchgelassen",
        "body": "Ein IPv6-Paket mit mehr als acht Extension-Headern wird weitergeleitet, ohne dass eine Regel geprüft wird — eine längere Kette abzulaufen würde das Programm mehr Kernel-Budget kosten, als es hat. Das ist Absicht: Ein Parse-Limit, das Pakete verwirft, wäre ein verstecktes „alles verbieten“. Kein echter Verkehr verkettet acht Header, deshalb wird der Fall gezählt und angezeigt — CLI und Konsole melden jede Änderung an diesem Zähler —, nicht klammheimlich unter den Teppich gekehrt."
      },
      {
        "title": "Natives und generisches Anhängen unterscheiden sich in der Kapazität",
        "body": "Auf einem Treiber mit nativer XDP-Unterstützung läuft das Programm im Empfangspfad des Treibers, bevor der Kernel seinen Paketpuffer aufbaut. Ohne sie fällt der Kernel auf den generischen Modus zurück — korrekt, aber pro CPU-Kern deutlich weniger leistungsfähig. Kapkan meldet, welchen Modus jedes Interface bekommen hat; planen Sie die Kapazität rund um den nativen Modus und behandeln Sie den generischen als funktionierenden Fallback, nicht als Ziel."
      }
    ]
  },
  "requirements": {
    "heading": "Was es braucht.",
    "sub": "Kein Agent, kein Sidecar, kein Compiler auf der Maschine. Das Programm wird als sofort lauffähiger Bytecode in der Binary ausgeliefert.",
    "items": [
      "Linux 5.15 oder neuer, mit BTF (CONFIG_DEBUG_INFO_BTF=y — jeder gängige Distributions-Kernel hat es).",
      "CAP_BPF und CAP_NET_ADMIN sowie ein beschreibbares bpffs unter /sys/fs/bpf.",
      "Ein Interface zum Anhängen. Natives XDP, wenn der Treiber es unterstützt; sonst generisch.",
      "Nichts zu bauen. Das XDP-Programm ist vorab kompiliert und steckt in der Kapkan-Binary."
    ]
  },
  "showcaseCaption": "Eine aktive Erkennung, in der Konsole aufgeklappt: die Eskalationsleiter hält bei In-kernel drop (XDP), samt der genauen Regel, die sie in den Kernel geladen hat — dst 203.0.113.45/32, proto udp → discard.",
  "cta": {
    "heading": "Verwerfen Sie ihn selbst.",
    "sub": "Fügen Sie einen dataplane-Block hinzu, lassen Sie „nur beobachten“ an und sehen Sie, was es verwerfen würde, bevor es irgendetwas verwirft.",
    "primary": "Datenebenen-Doku lesen",
    "secondary": "Konfiguration erstellen"
  }
};

const fr: XdpDict = {
  "meta": {
    "title": "Mitigation XDP dans le noyau — Kapkan",
    "description": "Kapkan rejette l'attaque lui-même, dans le noyau Linux, à l'aide d'un petit programme XDP — dès l'arrivée des paquets, sur une machine que vous exploitez déjà. Une limite de débit distincte pour chaque source, « observation seule » par défaut, et chaque règle expire dans le noyau."
  },
  "nav": {
    "docs": "Docs du plan de données",
    "home": "Accueil",
    "backToSite": "kapkan.io"
  },
  "hero": {
    "eyebrow": "Plan de données dans le noyau",
    "h1a": "Rejetez l'attaque",
    "h1b": "dans le noyau.",
    "sub": "Normalement, Kapkan demande à un routeur de rejeter l'attaque. Ici, il la rejette lui-même. Sur la machine où tourne Kapkan, il charge dans le noyau Linux un tout petit programme (XDP) qui jette les paquets d'attaque à l'instant où ils arrivent — sans routeur, sans attente. Même détection, mêmes contrôles de sûreté, une chose de moins qui doit dire oui.",
    "ctaDocs": "Lire les docs du plan de données",
    "ctaConfig": "Créer une config",
    "trust": [
      "Linux 5.15+",
      "Rien à compiler sur la machine",
      "« Observation seule » par défaut",
      "Les règles expirent dans le noyau"
    ],
    "shotAlt": "Console Kapkan : trois attaques actives, chacune atténuée par In-kernel drop (XDP)",
    "shotCaption": "Trois détections en direct, chacune rejetée dans le noyau — non annoncée à un routeur."
  },
  "contrast": {
    "heading": "Annoncer, ou rejeter.",
    "sub": "Kapkan a toujours transformé une détection en message BGP — une route blackhole, ou une règle FlowSpec précise — en laissant le rejet lui-même à vos routeurs. Le plan de données ajoute une seconde option : le faire vous-même.",
    "announce": {
      "title": "Annoncer (RTBH / FlowSpec)",
      "body": "Kapkan indique à un routeur ce qu'il faut rejeter. Le routeur fait le travail, où qu'il se trouve dans votre réseau.",
      "points": [
        "Atteint chaque plage d'IP que portent vos routeurs, bien en amont de toute machine isolée.",
        "Nécessite un routeur qui parle BGP, et une session à laquelle il fait déjà confiance.",
        "Ne filtre que sur les en-têtes de paquets — il ne peut pas donner à chaque source sa propre limite de débit."
      ]
    },
    "drop": {
      "title": "Rejeter (XDP dans le noyau)",
      "body": "Kapkan rejette le paquet lui-même, dans le noyau de la machine qui l'exécute, avant même que le reste du système ne le voie.",
      "points": [
        "Pas de routeur, pas de session BGP, pas d'attente — la règle n'est qu'une entrée dans une table du noyau.",
        "S'exécute au point le plus précoce où un logiciel peut toucher un paquet : le chemin de réception du pilote.",
        "Donne à chaque source attaquante son propre budget — la seule chose que FlowSpec ne sait pas faire."
      ]
    }
  },
  "how": {
    "heading": "De la détection au paquet rejeté.",
    "sub": "Le plan de données se branche au même endroit que toute autre mitigation : une détection l'atteint donc après avoir déjà passé chaque contrôle de sûreté. Seule la dernière étape change : au lieu d'annoncer une route, les règles deviennent des entrées dans des tables du noyau.",
    "steps": [
      {
        "title": "Le détecteur se déclenche",
        "body": "Les mêmes limites corrigées de l'échantillonnage, les mêmes lignes de base apprises et le même classifieur que d'habitude. La détection ne change pas juste parce que la mitigation change."
      },
      {
        "title": "Les règles sont générées",
        "body": "La détection produit les règles mêmes qu'elle aurait annoncées en FlowSpec — visant la victime, tout au plus une poignée par attaque — mais via un second encodeur au lieu de celui de BGP."
      },
      {
        "title": "Les règles se chargent dans le noyau",
        "body": "Les règles sont écrites dans les tables du noyau du programme XDP, en double tampon : un rechargement échange tout un jeu d'un coup — sans aucun instant où le trafic reste sans correspondance."
      },
      {
        "title": "Le noyau décide",
        "body": "Pour chaque paquet, le programme parcourt une liste fixe — liste d'autorisation, règles statiques, correspondance de victime, budget par source — et renvoie passe ou rejet. Par défaut, c'est toujours passe."
      }
    ],
    "diagram": {
      "detect": "Détection",
      "compile": "Encodeur de règles",
      "maps": "Tables du noyau",
      "verdict": "Programme XDP",
      "pass": "PASSE (défaut)",
      "drop": "REJET (correspondance)",
      "caption": "Chaque paquet sur l'interface emprunte ce chemin. Tout ce que les règles ne font pas correspondre est laissé passer, intact."
    }
  },
  "ratelimit": {
    "heading": "Limite de débit par source — la seule chose que FlowSpec ne sait pas faire.",
    "body": "Une règle FlowSpec peut faire correspondre un flux et le rejeter, ou le plafonner à une seule vitesse partagée. Elle n'a aucun moyen de dire « maintenir chaque source individuelle à N ». Le plan de données, si : chaque source attaquante reçoit son propre seau à jetons dans le noyau. Fixez la limite à N et chaque source est maintenue à N — au lieu d'avoir mille sources et vos vrais utilisateurs qui se disputent tous un unique plafond partagé.",
    "aside": "C'est la seule chose que BGP ne sait tout simplement pas faire — pas une version plus rapide d'une vieille astuce, mais une nouvelle."
  },
  "safety": {
    "heading": "Sûr par conception.",
    "sub": "Le plan de données conserve toutes les propriétés de sûreté que Kapkan avait déjà, parce qu'il se branche au même endroit — et en ajoute une que le noyau fait respecter de lui-même.",
    "cards": [
      {
        "title": "L'« observation seule » reste le mode par défaut",
        "body": "Tant que vous ne l'activez pas pour de vrai, le programme s'attache, établit les correspondances et compte exactement comme il le ferait en production — mais chaque « rejet » devient un « passe ». Vous voyez ce qu'il ferait avant qu'il ne fasse quoi que ce soit."
      },
      {
        "title": "Les règles expirent dans le noyau",
        "body": "Chaque règle générée porte sa propre échéance, et le programme considère une règle expirée comme disparue. Un Kapkan tué, figé ou redémarré ne peut pas laisser le trafic d'une victime rejeté : le noyau oublie à l'heure prévue, sans qu'aucun daemon soit nécessaire."
      },
      {
        "title": "La liste protégée est appliquée dans le noyau",
        "body": "Votre liste protégée est vérifiée dans le programme lui-même, à la fois par source et par destination — ainsi un hôte protégé situé dans une plage bloquée continue de recevoir du trafic, sans aller-retour vers l'espace utilisateur."
      },
      {
        "title": "Par défaut, c'est passe",
        "body": "Tout ce que les règles ne font pas explicitement correspondre est transmis. Il n'y a pas de « tout refuser » caché : même la seule forme de paquet que le programme ne peut pas inspecter entièrement est laissée passer et comptée, non rejetée."
      }
    ]
  },
  "measured": {
    "heading": "Mesuré, pas affirmé.",
    "sub": "Dix-huit attaques enregistrées sont rejouées de bout en bout à chaque changement — de la télémétrie factice envoyée dans le vrai détecteur, ses règles chargées dans de vraies tables du noyau, puis les paquets enregistrés rejoués à travers le programme, avec du trafic légitime mélangé du début à la fin.",
    "stats": [
      {
        "value": "18",
        "label": "attaques enregistrées, à chaque build"
      },
      {
        "value": "100 %",
        "label": "du trafic d'attaque rejeté sur 17 des 18 (98,5 % au test de limite de débit par source)"
      },
      {
        "value": "0",
        "label": "paquet légitime rejeté · 0 paquet en liste d'autorisation rejeté"
      },
      {
        "value": "5.15–6.12",
        "label": "noyaux sur lesquels tourne la suite complète en CI (5.15, 6.1, 6.6, 6.12)"
      }
    ],
    "caveat": "Ce sont des taux de blocage, pas du débit. Un taux de blocage indique quelle part d'une attaque les règles interceptent ; il ne dit rien sur le nombre de paquets qu'une machine donnée peut absorber, ce qui dépend de votre NIC, de votre pilote, de votre CPU et du fait que le programme se soit attaché en mode natif ou générique. Dimensionnez votre déploiement sur votre propre matériel."
  },
  "limits": {
    "heading": "Les limites, en toute honnêteté.",
    "sub": "Deux choses à savoir avant de le déployer — dites ici plutôt que découvertes plus tard.",
    "items": [
      {
        "title": "Une forme de paquet IPv6 est laissée passer sans vérification",
        "body": "Un paquet IPv6 comportant plus de huit en-têtes d'extension est transmis sans qu'aucune règle soit vérifiée — parcourir une chaîne plus longue coûterait au programme plus de budget noyau qu'il n'en a. C'est volontaire : une limite d'analyse qui rejetterait des paquets serait un « tout refuser » caché. Aucun trafic réel n'enchaîne huit en-têtes, donc c'est compté et affiché — la CLI et la console signalent tout changement de ce compteur — plutôt qu'enterré en silence."
      },
      {
        "title": "L'attachement natif et l'attachement générique diffèrent en capacité",
        "body": "Sur un pilote qui prend en charge XDP en natif, le programme s'exécute dans le chemin de réception du pilote, avant que le noyau ne construise son tampon de paquet. Sans cela, le noyau se rabat sur le mode générique — correct, mais bien moins performant par cœur de CPU. Kapkan indique quel mode chaque interface a obtenu ; dimensionnez la capacité en fonction du mode natif, et voyez le générique comme une solution de repli qui marche, pas comme la cible."
      }
    ]
  },
  "requirements": {
    "heading": "Ce dont il a besoin.",
    "sub": "Pas d'agent, pas de sidecar, pas de compilateur sur la machine. Le programme est livré sous forme de bytecode prêt à l'emploi à l'intérieur du binaire.",
    "items": [
      "Linux 5.15 ou plus récent, avec BTF (CONFIG_DEBUG_INFO_BTF=y — présent dans le noyau de toutes les distributions grand public).",
      "CAP_BPF et CAP_NET_ADMIN, et un bpffs accessible en écriture sur /sys/fs/bpf.",
      "Une interface à laquelle s'attacher. XDP natif si le pilote le prend en charge ; générique sinon.",
      "Rien à compiler. Le programme XDP est compilé à l'avance et livré dans le binaire Kapkan."
    ]
  },
  "showcaseCaption": "Une détection en direct, dépliée dans la console : l'échelle d'escalade se maintient à In-kernel drop (XDP), et la règle exacte qu'elle a chargée dans le noyau — dst 203.0.113.45/32, proto udp → discard.",
  "cta": {
    "heading": "Rejetez-la vous-même.",
    "sub": "Ajoutez un bloc dataplane, laissez l'« observation seule » activée, et voyez ce qu'il rejetterait avant qu'il ne rejette quoi que ce soit.",
    "primary": "Lire les docs du plan de données",
    "secondary": "Créer une config"
  }
};

const es: XdpDict = {
  "meta": {
    "title": "Mitigación XDP en el kernel — Kapkan",
    "description": "Kapkan descarta el ataque él mismo, dentro del kernel de Linux, con un pequeño programa XDP — en el momento en que llegan los paquetes, en una máquina que ya tienes en marcha. Un límite de tasa aparte para cada origen, «solo observación» por defecto, y cada regla expira dentro del kernel."
  },
  "nav": {
    "docs": "Docs del plano de datos",
    "home": "Inicio",
    "backToSite": "kapkan.io"
  },
  "hero": {
    "eyebrow": "Plano de datos en el kernel",
    "h1a": "Descarta el ataque",
    "h1b": "en el kernel.",
    "sub": "Normalmente Kapkan le pide a un router que descarte el ataque. Aquí lo descarta él mismo. En la máquina donde se ejecuta Kapkan, carga un programa diminuto en el kernel de Linux (XDP) que tira los paquetes del ataque en cuanto llegan — sin router, sin esperas. La misma detección, las mismas comprobaciones de seguridad, una cosa menos que tiene que decir que sí.",
    "ctaDocs": "Lee las docs del plano de datos",
    "ctaConfig": "Crea una configuración",
    "trust": [
      "Linux 5.15+",
      "Nada que compilar en la máquina",
      "«Solo observación» por defecto",
      "Las reglas expiran en el kernel"
    ],
    "shotAlt": "Consola de Kapkan: tres ataques activos, cada uno mitigado con In-kernel drop (XDP)",
    "shotCaption": "Tres detecciones en vivo, cada una descartada en el kernel — no anunciada a un router."
  },
  "contrast": {
    "heading": "Anunciar o descartar.",
    "sub": "Kapkan siempre ha convertido una detección en un mensaje BGP — una ruta blackhole, o una regla FlowSpec precisa — y ha dejado el descarte en sí a tus routers. El plano de datos añade una segunda opción: hazlo tú mismo.",
    "announce": {
      "title": "Anunciar (RTBH / FlowSpec)",
      "body": "Kapkan le dice a un router qué descartar. El router hace el trabajo, esté donde esté en tu red.",
      "points": [
        "Alcanza cada rango de IPs que transportan tus routers, mucho más arriba en la red que cualquier máquina individual.",
        "Necesita un router que hable BGP, y una sesión en la que ya confíe.",
        "Solo coincide con las cabeceras de los paquetes — no puede darle a cada origen su propio límite de tasa."
      ]
    },
    "drop": {
      "title": "Descartar (XDP en el kernel)",
      "body": "Kapkan descarta el paquete él mismo, en el kernel de la máquina que lo ejecuta, antes incluso de que el resto del sistema lo vea.",
      "points": [
        "Sin router, sin sesión BGP, sin esperas — la regla es solo una entrada en una tabla del kernel.",
        "Se ejecuta en el punto más temprano en que el software puede tocar un paquete: la ruta de recepción del controlador.",
        "Le da a cada origen atacante su propio presupuesto — lo único que FlowSpec no puede hacer."
      ]
    }
  },
  "how": {
    "heading": "De la detección al paquete descartado.",
    "sub": "El plano de datos se conecta en el mismo punto que cualquier otra mitigación, así que una detección le llega tras haber superado ya cada comprobación de seguridad. Solo cambia el último paso: en lugar de anunciar una ruta, las reglas se convierten en entradas de tablas del kernel.",
    "steps": [
      {
        "title": "El detector se dispara",
        "body": "Los mismos límites corregidos por muestreo, las líneas base aprendidas y el clasificador de siempre. La detección no cambia solo porque cambie la mitigación."
      },
      {
        "title": "Se generan las reglas",
        "body": "La detección produce las mismas reglas que habría anunciado como FlowSpec — dirigidas a la víctima, a lo sumo un puñado por ataque — pero a través de un segundo codificador en vez del de BGP."
      },
      {
        "title": "Las reglas se cargan en el kernel",
        "body": "Las reglas se escriben en las tablas del kernel del programa XDP, con doble búfer para que una recarga intercambie todo un conjunto de una vez — sin ningún instante en que el tráfico quede sin coincidir."
      },
      {
        "title": "El kernel decide",
        "body": "Para cada paquete el programa comprueba una lista fija — lista de permitidos, reglas estáticas, coincidencia con la víctima, presupuesto por origen — y devuelve pasar o descartar. El valor por defecto siempre es pasar."
      }
    ],
    "diagram": {
      "detect": "Detección",
      "compile": "Codificador de reglas",
      "maps": "Tablas del kernel",
      "verdict": "Programa XDP",
      "pass": "PASAR (por defecto)",
      "drop": "DESCARTAR (coincide)",
      "caption": "Cada paquete de la interfaz toma este camino. Todo lo que las reglas no hacen coincidir se deja pasar intacto."
    }
  },
  "ratelimit": {
    "heading": "Límite de tasa por origen — lo único que FlowSpec no puede hacer.",
    "body": "Una regla FlowSpec puede coincidir con un flujo y descartarlo, o limitarlo a una única velocidad compartida. No tiene forma de decir «mantén cada origen individual en N». El plano de datos sí: cada origen atacante recibe su propio token bucket en el kernel. Fija el límite en N y cada origen se mantiene en N — en vez de mil orígenes y tus usuarios reales peleándose todos por un único techo compartido.",
    "aside": "Esto es lo único que BGP simplemente no puede hacer — no una versión más rápida de un truco viejo, sino uno nuevo."
  },
  "safety": {
    "heading": "Seguro por diseño.",
    "sub": "El plano de datos conserva todas las propiedades de seguridad que Kapkan ya tenía, porque se conecta en el mismo punto — y añade una que el kernel hace cumplir por sí mismo.",
    "cards": [
      {
        "title": "«Solo observación» sigue siendo el valor por defecto",
        "body": "Hasta que lo actives en vivo, el programa se adjunta, hace coincidir y cuenta exactamente como lo haría en producción — pero cada «descarte» se convierte en un «pase». Ves lo que haría antes de que haga nada."
      },
      {
        "title": "Las reglas expiran dentro del kernel",
        "body": "Cada regla generada lleva su propio plazo, y el programa trata una regla expirada como si no existiera. Un Kapkan que muere, se cuelga o se reinicia no puede dejar el tráfico de una víctima descartado: el kernel olvida a su hora, sin necesidad de ningún daemon."
      },
      {
        "title": "La lista protegida se aplica en el kernel",
        "body": "Tu lista protegida se comprueba en el propio programa, tanto por origen como por destino — así que un host protegido dentro de un rango bloqueado sigue recibiendo tráfico, sin tener que volver al espacio de usuario."
      },
      {
        "title": "El valor por defecto es pasar",
        "body": "Todo lo que las reglas no hacen coincidir explícitamente se reenvía. No hay ningún «denegar todo» oculto: incluso la única forma de paquete que el programa no puede inspeccionar del todo se deja pasar y se cuenta, no se descarta."
      }
    ]
  },
  "measured": {
    "heading": "Medido, no prometido.",
    "sub": "Dieciocho ataques grabados se ejecutan de principio a fin en cada cambio — telemetría falsa hacia el detector real, sus reglas cargadas en tablas del kernel reales, y luego los paquetes grabados reproducidos a través del programa, con tráfico legítimo mezclado todo el tiempo.",
    "stats": [
      {
        "value": "18",
        "label": "ataques grabados, en cada build"
      },
      {
        "value": "100 %",
        "label": "del tráfico de ataque descartado en 17 de 18 (98,5 % en la prueba de límite de tasa por origen)"
      },
      {
        "value": "0",
        "label": "paquetes legítimos descartados · 0 paquetes de la lista de permitidos descartados"
      },
      {
        "value": "5.15–6.12",
        "label": "kernels sobre los que se ejecuta la suite completa en CI (5.15, 6.1, 6.6, 6.12)"
      }
    ],
    "caveat": "Son tasas de bloqueo, no de rendimiento. Una tasa de bloqueo te dice qué parte de un ataque atrapan las reglas; no dice nada de cuántos paquetes puede absorber una máquina concreta, lo cual depende de tu NIC, tu controlador, tu CPU y de si el programa se adjuntó en modo nativo o genérico. Dimensiona tu despliegue con tu propio hardware."
  },
  "limits": {
    "heading": "Los límites honestos.",
    "sub": "Dos cosas que conviene saber antes de desplegarlo — mejor dichas aquí que descubiertas después.",
    "items": [
      {
        "title": "Una forma de paquete IPv6 se deja pasar sin comprobar",
        "body": "Un paquete IPv6 con más de ocho cabeceras de extensión se reenvía sin comprobar ninguna regla — recorrer una cadena más larga le costaría al programa más presupuesto del kernel del que tiene. Es a propósito: un límite de análisis que descartara paquetes sería un «denegar todo» oculto. Ningún tráfico real encadena ocho cabeceras, así que se cuenta y se muestra — la CLI y la consola señalan cualquier cambio en ese contador — en vez de enterrarlo en silencio."
      },
      {
        "title": "El adjuntado nativo y el genérico difieren en capacidad",
        "body": "En un controlador con soporte XDP nativo el programa corre en la ruta de recepción del controlador, antes de que el kernel construya su búfer de paquetes. Sin él, el kernel recurre al modo genérico — correcto, pero hace mucho menos por núcleo de CPU. Kapkan informa de qué modo obtuvo cada interfaz; planifica la capacidad en torno al nativo, y trata el genérico como un respaldo funcional, no como el objetivo."
      }
    ]
  },
  "requirements": {
    "heading": "Qué necesita.",
    "sub": "Sin agente, sin sidecar, sin compilador en la máquina. El programa se distribuye como bytecode listo para ejecutar dentro del binario.",
    "items": [
      "Linux 5.15 o posterior, con BTF (CONFIG_DEBUG_INFO_BTF=y — lo tiene el kernel de cualquier distribución mayoritaria).",
      "CAP_BPF y CAP_NET_ADMIN, y un bpffs con permiso de escritura en /sys/fs/bpf.",
      "Una interfaz a la que adjuntarse. XDP nativo si el controlador lo admite; genérico en caso contrario.",
      "Nada que compilar. El programa XDP se compila con antelación y se distribuye dentro del binario de Kapkan."
    ]
  },
  "showcaseCaption": "Una detección en vivo, expandida en la consola: la escalera de escalado que se mantiene en In-kernel drop (XDP), y la regla exacta que cargó en el kernel — dst 203.0.113.45/32, proto udp → discard.",
  "cta": {
    "heading": "Descártalo tú mismo.",
    "sub": "Añade un bloque dataplane, deja «solo observación» activado, y mira lo que descartaría antes de que descarte nada.",
    "primary": "Lee las docs del plano de datos",
    "secondary": "Crea una configuración"
  }
};

// Locale table. English is authored above; ru/de/fr/es were translated and
// adversarially verified (workflow xdp-landing-fanout), then hand-fixed:
// a German causal that had inverted, a French "par cœur" idiom clash, and
// comma-decimal number formatting for de/fr/es.
export const xdp: Record<Locale, XdpDict> = { en, ru, de, fr, es };
