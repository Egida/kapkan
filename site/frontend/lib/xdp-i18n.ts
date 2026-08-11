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

const ru: XdpDict = {
  "contrast": {
    "heading": "Анонсировать или отбросить.",
    "sub": "Kapkan всегда превращал обнаружение в BGP-анонс — blackhole-маршрут или точечное правило FlowSpec — и оставлял отбрасывание вашим маршрутизаторам. Плоскость данных добавляет второй ответ: сделать это самому.",
    "announce": {
      "title": "Анонс (RTBH / FlowSpec)",
      "body": "Kapkan сообщает маршрутизатору, что отбрасывать. Работу выполняет сам маршрутизатор — где бы он ни стоял в вашей сети.",
      "points": [
        "Достаёт до каждого префикса, который несут ваши маршрутизаторы, — намного выше по потоку любой отдельной машины.",
        "Нужен маршрутизатор, который понимает протокол, и сессия, которой он доверяет.",
        "FlowSpec сопоставляет заголовки; он не может ограничивать скорость каждого источника по отдельности."
      ]
    },
    "drop": {
      "title": "Отбрасывание (XDP в ядре)",
      "body": "Kapkan отбрасывает пакет сам, в ядре той машины, где он запущен, ещё до того как пакет увидит сетевой стек.",
      "points": [
        "Ни маршрутизатора, ни сессии, ни протокола — правило это запись в карте ядра.",
        "Работает в самой ранней точке, где ПО вообще может коснуться пакета: на пути приёма в драйвере.",
        "Даёт каждому атакующему источнику собственный бюджет, чего FlowSpec выразить не может."
      ]
    }
  },
  "cta": {
    "heading": "Отбросьте сами.",
    "sub": "Добавьте блок dataplane, оставьте dry-run включённым и посмотрите, что оно отбросило бы, прежде чем оно что-либо отбросит.",
    "primary": "Читать документацию по плоскости данных",
    "secondary": "Собрать конфигурацию"
  },
  "hero": {
    "eyebrow": "Плоскость данных в ядре",
    "h1a": "Отбросьте атаку",
    "h1b": "в ядре.",
    "sub": "Все остальные способы, которыми Kapkan останавливает атаку, анонсируют маршрут и поручают маршрутизатору его применить. Плоскость данных обходится без этой просьбы. То же самое обнаружение, которое стало бы правилом FlowSpec, компилируется в карты ядра Linux, и XDP-программа отбрасывает атаку прямо на проводе — ещё до того как она дойдёт до сетевого стека, на машине, которая у вас уже работает.",
    "ctaDocs": "Читать документацию по плоскости данных",
    "ctaConfig": "Собрать конфигурацию",
    "trust": [
      "Linux 5.15+",
      "Ничего не нужно компилировать на машине",
      "Dry-run по умолчанию",
      "Правила истекают в ядре"
    ],
    "shotAlt": "Консоль Kapkan: три активные атаки, каждая подавлена отбрасыванием в ядре (XDP)",
    "shotCaption": "Три активных обнаружения, каждое отброшено в ядре — а не анонсировано маршрутизатору."
  },
  "how": {
    "heading": "От обнаружения до отброшенного пакета.",
    "sub": "Плоскость данных находится под тем же стыком, что и любое другое подавление, поэтому обнаружение доходит до неё, уже пройдя все проверки безопасности. Меняется лишь последний шаг: вместо анонса правила становятся записями в картах ядра.",
    "steps": [
      {
        "title": "Срабатывает детектор",
        "body": "Те же скорректированные по выборке пороги, обученные базовые уровни и классификатор, что и всегда. В обнаружении ничего не меняется от того, что меняется подавление."
      },
      {
        "title": "Генерируются правила",
        "body": "Обнаружение порождает ровно те правила, которые оно анонсировало бы как FlowSpec — привязанные к жертве, не больше горстки на атаку, — но через второй кодировщик, а не через BGP."
      },
      {
        "title": "Записываются карты",
        "body": "Закодированные правила записываются в карты ядра XDP-программы с двойной буферизацией, так что перезагрузка меняет целое поколение атомарно — без промежутка, в котором трафик остаётся без сопоставления."
      },
      {
        "title": "Решает ядро",
        "body": "Для каждого пакета программа проходит фиксированный порядок — белый список, статические правила, сопоставление с жертвой, бюджет на источник — и возвращает вердикт: пропустить или отбросить. Вердикт по умолчанию — всегда пропустить."
      }
    ],
    "diagram": {
      "detect": "Обнаружение",
      "compile": "Кодировщик правил",
      "maps": "Карты ядра",
      "verdict": "XDP-программа",
      "pass": "ПРОПУСК (по умолчанию)",
      "drop": "ОТБРОС (совпадение)",
      "caption": "Каждый пакет на интерфейсе проходит этот путь. Всё, с чем правила не совпали, пропускается нетронутым."
    }
  },
  "limits": {
    "heading": "Честные ограничения.",
    "sub": "Две вещи, которые стоит знать до развёртывания, — сказанные здесь, а не обнаруженные потом.",
    "items": [
      {
        "title": "Один вид IPv6-пакета пропускается без проверки",
        "body": "IPv6-пакет, несущий более восьми заголовков расширения, пересылается дальше без вычисления правила — проход по более длинной цепочке стоил бы программе бюджета ядра, которого у неё нет. Это сделано намеренно: ограничение разбора, отбрасывающее пакеты, было бы запретом по умолчанию, спрятанным в разборщике. Легитимный трафик не выстраивает и восьми, поэтому такой случай учитывается и выводится наружу — CLI и консоль отмечают любое движение этого счётчика, — а не замалчивается."
      },
      {
        "title": "Нативное и обобщённое подключение различаются по мощности",
        "body": "На драйвере с нативной поддержкой XDP программа работает на пути приёма в драйвере, ещё до того как построен skb. Без неё ядро откатывается в обобщённый (generic) режим — корректный, но делающий гораздо меньше в расчёте на процессорное ядро. Kapkan сообщает, какой режим получил каждый интерфейс; планируйте мощность из расчёта на нативный режим, а обобщённый считайте рабочим запасным вариантом, а не целью."
      }
    ]
  },
  "measured": {
    "heading": "Измерено, а не заявлено.",
    "sub": "Восемнадцать записей атак прогоняются от начала до конца при каждом изменении — синтетическая телеметрия подаётся в настоящий детектор, сгенерированные им правила компилируются в настоящие карты ядра, затем записанные кадры воспроизводятся через программу, а легитимный трафик перемешан с ними на всём протяжении.",
    "stats": [
      {
        "value": "18",
        "label": "записей атак в каждой сборке"
      },
      {
        "value": "100%",
        "label": "трафика атаки отброшено на 17 из 18 (98.5% на записи с ограничением скорости по источникам)"
      },
      {
        "value": "0",
        "label": "легитимных кадров отброшено · 0 кадров из белого списка отброшено"
      },
      {
        "value": "5.15–6.12",
        "label": "ядра, на которых весь набор гоняется в CI (5.15, 6.1, 6.6, 6.12)"
      }
    ],
    "caveat": "Это доли блокировки, а не пропускная способность. Доля блокировки говорит, какую часть атаки ловят правила; она ничего не говорит о том, сколько пакетов способна принять конкретная машина, — а это зависит от вашей NIC, драйвера, процессора и от того, подключилась ли программа в нативном или обобщённом режиме. Рассчитывайте масштаб развёртывания на собственном оборудовании."
  },
  "meta": {
    "title": "Подавление атак в ядре с помощью XDP — Kapkan",
    "description": "Kapkan компилирует обнаружение в карты ядра Linux и отбрасывает атаку XDP-программой, ещё до того как пакеты дойдут до сетевого стека, — на оборудовании, которое у вас уже работает. Ограничение скорости по каждому источнику, dry-run по умолчанию, и каждое правило истекает прямо в ядре."
  },
  "nav": {
    "docs": "Документация по плоскости данных",
    "home": "Главная",
    "backToSite": "kapkan.io"
  },
  "ratelimit": {
    "heading": "Ограничение скорости по каждому источнику — то, что FlowSpec выразить не может.",
    "body": "Правило FlowSpec сопоставляет поток и отбрасывает его или ограничивает единой общей скоростью. Оно никак не может сказать «держать каждый отдельный источник на уровне N». А плоскость данных может: каждый атакующий источник получает собственную корзину токенов в карте ядра. Лимит N держит на уровне N каждый источник, вместо того чтобы тысяча источников и ваши легитимные клиенты боролись за один общий потолок.",
    "aside": "Это единственная возможность, которая не является более быстрой версией того, что режим анонса уже умел, — это то, чего режим анонса по самому своему устройству сделать не мог вообще."
  },
  "requirements": {
    "heading": "Что ему нужно.",
    "sub": "Ни агента, ни sidecar, ни компилятора на машине. Программа поставляется как проверенный байт-код внутри бинарника.",
    "items": [
      "Linux 5.15 или новее, с BTF (CONFIG_DEBUG_INFO_BTF=y — есть в ядре любого массового дистрибутива).",
      "CAP_BPF и CAP_NET_ADMIN, а также доступный для записи bpffs в /sys/fs/bpf.",
      "Интерфейс, к которому подключаться. Нативный XDP, если драйвер его поддерживает; иначе обобщённый (generic).",
      "Ничего собирать не нужно. XDP-объект скомпилирован заранее и встроен в бинарник Kapkan."
    ]
  },
  "safety": {
    "heading": "Безопасно по построению.",
    "sub": "Плоскость данных наследует все свойства безопасности, которые уже были у Kapkan, потому что находится под тем же стыком, — и добавляет ещё одно, которое ядро обеспечивает само.",
    "cards": [
      {
        "title": "Dry-run по-прежнему по умолчанию",
        "body": "Пока вы не переключите его в боевой режим, программа подключается, сопоставляет и считает ровно так же, как в промышленной среде, — но каждый вердикт «отбросить» переписывается в «пропустить». Вы видите, что она сделала бы, ещё до того как она что-либо сделает."
      },
      {
        "title": "Правила истекают внутри ядра",
        "body": "Каждое сгенерированное правило несёт собственный срок, и программа считает истёкшее правило отсутствующим. Kapkan, который убит, завис или перезапущен, не может оставить трафик жертвы отброшенным: ядро забывает по расписанию, без участия демона."
      },
      {
        "title": "Белый список применяется в ядре",
        "body": "Ваш защищённый белый список сопоставляется в самой программе, по обеим осям — источника и назначения, — так что защищённый хост внутри префикса под ковровой блокировкой продолжает получать трафик, без обращения в пространство пользователя."
      },
      {
        "title": "Вердикт по умолчанию — пропустить",
        "body": "Всё, с чем правила явно не совпали, пересылается дальше. Нет никакого запрета по умолчанию, спрятанного в разборщике: даже единственный вид пакета, который программа не может полностью разобрать, пропускается и учитывается, а не отбрасывается."
      }
    ]
  },
  "showcaseCaption": "Карточка плоскости данных в консоли, вживую: программа подключена к eth0, три обнаружения установлены как три правила в ядре, и память под карты, которую она зарезервировала заранее."
};

const de: XdpDict = {
  "meta": {
    "title": "XDP-Mitigation im Kernel — Kapkan",
    "description": "Kapkan kompiliert eine Erkennung in Linux-Kernel-Maps und verwirft den Angriff mit einem XDP-Programm, bevor die Pakete den Netzwerk-Stack erreichen — auf Hardware, die Sie bereits betreiben. Rate-Limiting pro Quelle, dry-run als Standard, und jede Regel läuft im Kernel ab."
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
    "sub": "Bei jeder anderen Art, wie Kapkan einen Angriff stoppt, wird eine Route angekündigt und ein Router gebeten, darauf zu reagieren. Die Datenebene überspringt diese Bitte. Dieselbe Erkennung, die zu einer FlowSpec-Regel würde, wird in Linux-Kernel-Maps kompiliert, und ein XDP-Programm verwirft den Angriff direkt auf der Leitung — bevor er den Netzwerk-Stack erreicht, auf einem Rechner, den Sie bereits betreiben.",
    "ctaDocs": "Datenebenen-Doku lesen",
    "ctaConfig": "Konfiguration erstellen",
    "trust": [
      "Linux 5.15+",
      "Nichts auf dem Rechner zu kompilieren",
      "Dry-run als Standard",
      "Regeln laufen im Kernel ab"
    ],
    "shotAlt": "Kapkan-Konsole: drei aktive Angriffe, jeder durch Verwerfen im Kernel (XDP) abgewehrt",
    "shotCaption": "Drei Live-Erkennungen, jede im Kernel verworfen — nicht an einen Router angekündigt."
  },
  "contrast": {
    "heading": "Ankündigen oder verwerfen.",
    "sub": "Kapkan hat eine Erkennung schon immer in eine BGP-Ankündigung verwandelt — eine Blackhole-Route oder eine chirurgisch präzise FlowSpec-Regel — und das Verwerfen Ihren Routern überlassen. Die Datenebene fügt eine zweite Antwort hinzu: Tun Sie es selbst.",
    "announce": {
      "title": "Ankündigen (RTBH / FlowSpec)",
      "body": "Kapkan teilt einem Router mit, was zu verwerfen ist. Der Router erledigt die Arbeit, wo auch immer er in Ihrem Netzwerk sitzt.",
      "points": [
        "Erreicht jedes Präfix, das Ihre Router führen — weit stromaufwärts von jedem einzelnen Rechner.",
        "Benötigt einen Router, der das Protokoll spricht, und eine Sitzung, der er vertraut.",
        "FlowSpec gleicht Header ab; es kann nicht jede Quelle einzeln per Rate-Limit begrenzen."
      ]
    },
    "drop": {
      "title": "Verwerfen (XDP im Kernel)",
      "body": "Kapkan verwirft das Paket selbst, im Kernel des Rechners, auf dem es läuft, bevor der Netzwerk-Stack es sieht.",
      "points": [
        "Kein Router, keine Sitzung, kein Protokoll — die Regel ist ein Eintrag in einer Kernel-Map.",
        "Läuft am frühesten Punkt, an dem Software ein Paket berühren kann: im Empfangspfad des Treibers.",
        "Gibt jeder angreifenden Quelle ihr eigenes Budget, was FlowSpec nicht ausdrücken kann."
      ]
    }
  },
  "how": {
    "heading": "Von der Erkennung zum verworfenen Paket.",
    "sub": "Die Datenebene sitzt unterhalb derselben Nahtstelle, die jede andere Mitigation nutzt, sodass eine Erkennung sie erst erreicht, nachdem sie bereits jede Sicherheitsprüfung durchlaufen hat. Was sich ändert, ist der letzte Schritt: Statt einer Ankündigung werden die Regeln zu Einträgen in Kernel-Maps.",
    "steps": [
      {
        "title": "Der Detektor löst aus",
        "body": "Dieselben stichprobenkorrigierten Schwellenwerte, gelernten Baselines und derselbe Klassifikator wie immer. Dass sich das Mitigationsverfahren ändert, ändert nichts an der Erkennung."
      },
      {
        "title": "Regeln werden generiert",
        "body": "Die Erkennung erzeugt genau die Regeln, die sie als FlowSpec angekündigt hätte — am Opfer verankert, höchstens eine Handvoll pro Angriff — über einen zweiten Encoder statt einen BGP-Encoder."
      },
      {
        "title": "Maps werden geschrieben",
        "body": "Die kodierten Regeln werden in die Kernel-Maps des XDP-Programms geschrieben, doppelt gepuffert, sodass ein Neuladen eine ganze Generation atomar austauscht — ohne ein Zeitfenster, in dem Verkehr nicht abgeglichen wird."
      },
      {
        "title": "Der Kernel entscheidet",
        "body": "Für jedes Paket durchläuft das Programm eine feste Reihenfolge — Allow-Liste, statische Regeln, Opfer-Abgleich, Budget pro Quelle — und gibt pass oder drop zurück. Das Standardurteil ist immer pass."
      }
    ],
    "diagram": {
      "detect": "Erkennung",
      "compile": "Regel-Encoder",
      "maps": "Kernel-Maps",
      "verdict": "XDP-Programm",
      "pass": "PASS (Standard)",
      "drop": "DROP (Treffer)",
      "caption": "Jedes Paket auf dem Interface nimmt diesen Weg. Alles, worauf die Regeln nicht passen, wird unangetastet durchgelassen."
    }
  },
  "ratelimit": {
    "heading": "Rate-Limiting pro Quelle — das, was FlowSpec nicht ausdrücken kann.",
    "body": "Eine FlowSpec-Regel gleicht einen Flow ab und verwirft ihn oder begrenzt ihn auf eine einzige gemeinsame Rate. Sie hat keine Möglichkeit zu sagen „halte jede einzelne Quelle auf N“. Die Datenebene schon: Jede angreifende Quelle erhält ihren eigenen Token-Bucket in einer Kernel-Map. Ein Limit von N hält jede Quelle auf N, statt tausend Quellen und Ihre legitimen Clients um eine einzige aggregierte Obergrenze streiten zu lassen.",
    "aside": "Dies ist die eine Fähigkeit, die keine schnellere Version von etwas ist, das der Ankündiger bereits tat — es ist etwas, das der Ankündiger strukturell überhaupt nicht leisten konnte."
  },
  "safety": {
    "heading": "Sicher durch Konstruktion.",
    "sub": "Die Datenebene erbt jede Sicherheitseigenschaft, die Kapkan bereits hatte, weil sie unterhalb derselben Nahtstelle sitzt — und fügt eine hinzu, die der Kernel selbst durchsetzt.",
    "cards": [
      {
        "title": "Dry-run ist weiterhin der Standard",
        "body": "Ohne es scharfzuschalten, hängt sich das Programm an, gleicht ab und zählt genau so, wie es in Produktion würde — aber jedes drop-Urteil wird zu einem pass umgeschrieben. Sie sehen, was es tun würde, bevor es irgendetwas tut."
      },
      {
        "title": "Regeln laufen im Kernel ab",
        "body": "Jede generierte Regel trägt ihre eigene Frist, und das Programm behandelt eine abgelaufene Regel als nicht vorhanden. Ein Kapkan, das beendet, hängengeblieben oder neu gestartet wird, kann den Verkehr eines Opfers nicht verworfen zurücklassen: Der Kernel vergisst planmäßig, ohne dass ein Daemon beteiligt ist."
      },
      {
        "title": "Die Whitelist wird im Kernel durchgesetzt",
        "body": "Ihre geschützte Whitelist wird im Programm selbst abgeglichen, sowohl auf der Quell- als auch auf der Zielachse — sodass ein geschützter Host innerhalb eines pauschal gesperrten Präfixes weiterhin Verkehr empfängt, ohne einen Umweg in den Userspace."
      },
      {
        "title": "Das Standardurteil ist pass",
        "body": "Alles, worauf die Regeln nicht ausdrücklich passen, wird weitergeleitet. Es gibt kein Default-Deny, das sich in einem Parser versteckt: Selbst die eine Paketform, die das Programm nicht vollständig inspizieren kann, wird durchgelassen und gezählt, nicht verworfen."
      }
    ]
  },
  "measured": {
    "heading": "Gemessen, nicht behauptet.",
    "sub": "Achtzehn Angriffsmitschnitte laufen bei jeder Änderung durchgängig durch — synthetische Telemetrie in den echten Detektor, dessen generierte Regeln in echte Kernel-Maps kompiliert, dann die mitgeschnittenen Frames durch das Programm abgespielt, mit legitimem Verkehr durchgängig dazwischengemischt.",
    "stats": [
      {
        "value": "18",
        "label": "Angriffsmitschnitte, bei jedem Build"
      },
      {
        "value": "100 %",
        "label": "Angriffsverkehr verworfen bei 17 von 18 (98,5 % beim Rate-Limit-Mitschnitt pro Quelle)"
      },
      {
        "value": "0",
        "label": "legitime Frames verworfen · 0 Frames der Allow-Liste verworfen"
      },
      {
        "value": "5.15–6.12",
        "label": "Kernel, auf denen die vollständige Suite in CI läuft (5.15, 6.1, 6.6, 6.12)"
      }
    ],
    "caveat": "Dies sind Blockraten, kein Durchsatz. Eine Blockrate sagt aus, welchen Anteil eines Angriffs die Regeln erfassen; sie sagt nichts darüber aus, wie viele Pakete ein gegebener Rechner aufnehmen kann — das hängt von Ihrer NIC, Ihrem Treiber, Ihrer CPU und davon ab, ob sich das Programm im nativen oder generischen Modus angehängt hat. Dimensionieren Sie ein Deployment anhand Ihrer eigenen Hardware."
  },
  "limits": {
    "heading": "Die ehrlichen Grenzen.",
    "sub": "Zwei Dinge, die man vor dem Deployment wissen sollte — hier genannt, statt später entdeckt.",
    "items": [
      {
        "title": "Eine IPv6-Paketform wird uninspiziert durchgelassen",
        "body": "Ein IPv6-Paket mit mehr als acht Extension-Headern wird weitergeleitet, ohne dass eine Regel ausgewertet wird — eine längere Kette zu durchlaufen würde das Programm ein Kernel-Budget kosten, das es nicht hat. Das ist gewollt: Ein Parsing-Limit, das Pakete verwirft, wäre ein Default-Deny, das sich in einem Parser versteckt. Kein legitimer Verkehr verkettet acht, daher wird es gezählt und sichtbar gemacht — CLI und Konsole melden jede Bewegung an diesem Zähler — statt es zu verbergen."
      },
      {
        "title": "Natives und generisches Anhängen unterscheiden sich in der Kapazität",
        "body": "Auf einem Treiber mit nativer XDP-Unterstützung läuft das Programm im Empfangspfad des Treibers, bevor ein skb erstellt wird. Ohne sie fällt der Kernel auf den generischen Modus zurück, der korrekt ist, aber pro Kern weit weniger leistet. Kapkan meldet, welchen Modus jedes Interface erhalten hat; planen Sie die Kapazität rund um den nativen Modus und behandeln Sie den generischen als funktionierenden Fallback, nicht als Ziel."
      }
    ]
  },
  "requirements": {
    "heading": "Was es benötigt.",
    "sub": "Kein Agent, kein Sidecar, kein Compiler auf dem Rechner. Das Programm wird als verifizierter Bytecode innerhalb der Binärdatei ausgeliefert.",
    "items": [
      "Linux 5.15 oder neuer, mit BTF (CONFIG_DEBUG_INFO_BTF=y — jeder gängige Distributions-Kernel hat es).",
      "CAP_BPF und CAP_NET_ADMIN sowie ein beschreibbares bpffs unter /sys/fs/bpf.",
      "Ein Interface zum Anhängen. Natives XDP, wenn der Treiber es unterstützt; sonst generisch.",
      "Nichts zu bauen. Das XDP-Objekt wird vorab kompiliert und in die Kapkan-Binärdatei eingebettet."
    ]
  },
  "showcaseCaption": "Die Datenebenen-Karte in der Konsole, live: das Programm an eth0 angehängt, drei Erkennungen als drei Kernel-Regeln installiert, und der Map-Speicher, den es vorab reserviert hat.",
  "cta": {
    "heading": "Verwerfen Sie ihn selbst.",
    "sub": "Fügen Sie einen dataplane-Block hinzu, lassen Sie dry-run aktiviert und beobachten Sie, was es verwerfen würde, bevor es irgendetwas verwirft.",
    "primary": "Datenebenen-Doku lesen",
    "secondary": "Konfiguration erstellen"
  }
};

const fr: XdpDict = {
  "contrast": {
    "heading": "Annoncer, ou rejeter.",
    "sub": "Kapkan a toujours transformé une détection en annonce BGP — une route blackhole, ou une règle FlowSpec chirurgicale — et laissé le rejet à vos routeurs. Le plan de données ajoute une seconde réponse : le faire soi-même.",
    "announce": {
      "title": "Annoncer (RTBH / FlowSpec)",
      "body": "Kapkan indique à un routeur ce qu'il faut rejeter. Le routeur fait le travail, où qu'il se trouve dans votre réseau.",
      "points": [
        "Atteint chaque préfixe que portent vos routeurs, bien en amont de n'importe quelle machine.",
        "Nécessite un routeur qui parle le protocole, et une session à laquelle il fait confiance.",
        "FlowSpec filtre les en-têtes ; il ne peut pas limiter le débit de chaque source séparément."
      ]
    },
    "drop": {
      "title": "Rejeter (XDP dans le noyau)",
      "body": "Kapkan rejette le paquet lui-même, dans le noyau de la machine qui l'exécute, avant que la pile réseau ne le voie.",
      "points": [
        "Pas de routeur, pas de session, pas de protocole — la règle est une entrée de map du noyau.",
        "S'exécute au point le plus précoce où un logiciel peut toucher un paquet : le chemin de réception du pilote.",
        "Donne à chaque source attaquante son propre budget, ce que FlowSpec ne peut pas exprimer."
      ]
    }
  },
  "cta": {
    "heading": "Rejetez-le vous-même.",
    "sub": "Ajoutez un bloc dataplane, laissez le dry-run activé, et observez ce qu'il rejetterait avant qu'il ne rejette quoi que ce soit.",
    "primary": "Lire les docs du plan de données",
    "secondary": "Créer une configuration"
  },
  "hero": {
    "eyebrow": "Plan de données dans le noyau",
    "h1a": "Rejetez l'attaque",
    "h1b": "dans le noyau.",
    "sub": "Toutes les autres façons dont Kapkan arrête une attaque annoncent une route et demandent à un routeur d'agir. Le plan de données se passe de cette demande. La même détection qui deviendrait une règle FlowSpec se compile en maps du noyau Linux, et un programme XDP rejette l'attaque sur le fil — avant qu'elle n'atteigne la pile réseau, sur une machine que vous exploitez déjà.",
    "ctaDocs": "Lire les docs du plan de données",
    "ctaConfig": "Créer une configuration",
    "trust": [
      "Linux 5.15+",
      "Rien à compiler sur la machine",
      "Dry-run par défaut",
      "Les règles expirent dans le noyau"
    ],
    "shotAlt": "Console Kapkan : trois attaques actives, chacune neutralisée par rejet dans le noyau (XDP)",
    "shotCaption": "Trois détections en direct, chacune rejetée dans le noyau — non annoncée à un routeur."
  },
  "how": {
    "heading": "De la détection au paquet rejeté.",
    "sub": "Le plan de données se situe sous la même jointure que toute autre mitigation, de sorte qu'une détection l'atteint après avoir déjà passé chaque contrôle de sûreté. Ce qui change, c'est la dernière étape : au lieu d'une annonce, les règles deviennent des entrées de maps du noyau.",
    "steps": [
      {
        "title": "Le détecteur se déclenche",
        "body": "Les mêmes seuils corrigés par échantillonnage, lignes de base apprises et classifieur, comme toujours. Rien de la détection ne change du fait que la mitigation change."
      },
      {
        "title": "Les règles sont générées",
        "body": "La détection produit les règles mêmes qu'elle aurait annoncées en FlowSpec — ancrées sur la victime, tout au plus une poignée par attaque — via un second encodeur au lieu d'un encodeur BGP."
      },
      {
        "title": "Les maps sont écrites",
        "body": "Les règles encodées sont écrites dans les maps du noyau du programme XDP, en double tampon, de sorte qu'un rechargement échange toute une génération de façon atomique, sans aucune fenêtre pendant laquelle le trafic resterait sans correspondance."
      },
      {
        "title": "Le noyau décide",
        "body": "Pour chaque paquet, le programme parcourt un ordre fixe — liste blanche, règles statiques, correspondance de victime, budget par source — et renvoie passe ou rejet. Le verdict par défaut est toujours passe."
      }
    ],
    "diagram": {
      "detect": "Détection",
      "compile": "Encodeur de règles",
      "maps": "Maps du noyau",
      "verdict": "Programme XDP",
      "pass": "PASSE (défaut)",
      "drop": "REJET (apparié)",
      "caption": "Chaque paquet sur l'interface emprunte ce chemin. Tout ce que les règles ne font pas correspondre est laissé passer, intact."
    }
  },
  "limits": {
    "heading": "Les limites, en toute honnêteté.",
    "sub": "Deux choses qui méritent d'être connues avant de le déployer, énoncées ici plutôt que découvertes plus tard.",
    "items": [
      {
        "title": "Une forme de paquet IPv6 est laissée passer sans inspection",
        "body": "Un paquet IPv6 portant plus de huit en-têtes d'extension est transmis sans qu'une règle ne soit évaluée — parcourir une chaîne plus longue coûterait au programme un budget du noyau dont il ne dispose pas. C'est délibéré : une limite d'analyse qui rejetterait des paquets serait un refus par défaut caché dans un analyseur. Aucun trafic légitime n'enchaîne huit en-têtes, il est donc compté et rendu visible — la CLI et la console signalent tout mouvement de ce compteur — plutôt qu'enfoui."
      },
      {
        "title": "Les attachements natif et générique diffèrent en capacité",
        "body": "Sur un pilote prenant en charge XDP en natif, le programme s'exécute dans le chemin de réception du pilote, avant qu'un skb ne soit construit. Sans cela, le noyau se rabat sur le mode générique, qui est correct mais fait bien moins par cœur de processeur. Kapkan rapporte quel mode chaque interface a obtenu ; dimensionnez la capacité en fonction du natif, et traitez le générique comme une solution de repli fonctionnelle, non comme la cible."
      }
    ]
  },
  "measured": {
    "heading": "Mesuré, pas affirmé.",
    "sub": "Dix-huit captures d'attaque exécutées de bout en bout à chaque changement — télémétrie synthétique injectée dans le détecteur réel, ses règles générées compilées en maps du noyau réelles, puis les trames capturées rejouées à travers le programme, avec du trafic légitime entrelacé du début à la fin.",
    "stats": [
      {
        "value": "18",
        "label": "captures d'attaque, à chaque build"
      },
      {
        "value": "100 %",
        "label": "trafic d'attaque rejeté sur 17 des 18 (98,5 % sur la capture de limitation de débit par source)"
      },
      {
        "value": "0",
        "label": "trames légitimes rejetées · 0 trame en liste blanche rejetée"
      },
      {
        "value": "5.15–6.12",
        "label": "noyaux sur lesquels tourne la suite complète en CI (5.15, 6.1, 6.6, 6.12)"
      }
    ],
    "caveat": "Ce sont des taux de blocage, pas du débit. Un taux de blocage indique quelle fraction d'une attaque les règles interceptent ; il ne dit rien sur le nombre de paquets qu'une machine donnée peut absorber, ce qui dépend de votre NIC, de votre pilote, de votre CPU et du fait que le programme se soit attaché en mode natif ou générique. Dimensionnez un déploiement sur votre propre matériel."
  },
  "meta": {
    "title": "Mitigation XDP dans le noyau — Kapkan",
    "description": "Kapkan compile une détection en maps du noyau Linux et rejette l'attaque avec un programme XDP, avant que les paquets n'atteignent la pile réseau — sur du matériel que vous exploitez déjà. Limitation de débit par source, dry-run par défaut, et chaque règle expire au sein du noyau."
  },
  "nav": {
    "docs": "Docs du plan de données",
    "home": "Accueil",
    "backToSite": "kapkan.io"
  },
  "ratelimit": {
    "heading": "Limitation de débit par source — ce que FlowSpec ne peut pas exprimer.",
    "body": "Une règle FlowSpec fait correspondre un flux et le rejette, ou le régule à un unique débit partagé. Elle n'a aucun moyen de dire « maintenir chaque source individuelle à N ». Le plan de données le fait : chaque source attaquante obtient son propre seau à jetons dans une map du noyau. Une limite de N maintient chaque source à N, au lieu de laisser un millier de sources et vos clients légitimes se disputer un unique plafond agrégé.",
    "aside": "C'est la seule capacité qui n'est pas une version plus rapide de quelque chose que l'annonceur faisait déjà — c'est quelque chose que l'annonceur ne pouvait structurellement pas faire du tout."
  },
  "requirements": {
    "heading": "Ce dont il a besoin.",
    "sub": "Pas d'agent, pas de sidecar, pas de compilateur sur la machine. Le programme est livré sous forme de bytecode vérifié à l'intérieur du binaire.",
    "items": [
      "Linux 5.15 ou plus récent, avec BTF (CONFIG_DEBUG_INFO_BTF=y — chaque noyau des distributions grand public en dispose).",
      "CAP_BPF et CAP_NET_ADMIN, et un bpffs accessible en écriture sur /sys/fs/bpf.",
      "Une interface à laquelle s'attacher. XDP natif si le pilote le prend en charge ; générique sinon.",
      "Rien à compiler. L'objet XDP est compilé à l'avance et intégré dans le binaire Kapkan."
    ]
  },
  "safety": {
    "heading": "Sûr par construction.",
    "sub": "Le plan de données hérite de chaque propriété de sûreté que Kapkan possédait déjà, parce qu'il se situe sous la même jointure — et en ajoute une que le noyau applique de lui-même.",
    "cards": [
      {
        "title": "Le dry-run est toujours le mode par défaut",
        "body": "Sans le basculer en direct, le programme s'attache, établit les correspondances et compte exactement comme il le ferait en production — mais chaque verdict de rejet est réécrit en passe. Vous voyez ce qu'il ferait avant qu'il ne fasse quoi que ce soit."
      },
      {
        "title": "Les règles expirent au sein du noyau",
        "body": "Chaque règle générée porte sa propre échéance, et le programme traite une règle expirée comme absente. Un Kapkan tué, bloqué ou redémarré ne peut pas laisser le trafic d'une victime rejeté : le noyau oublie à l'heure prévue, sans aucun démon dans la boucle."
      },
      {
        "title": "La liste blanche est appliquée dans le noyau",
        "body": "Votre liste blanche protégée est mise en correspondance dans le programme lui-même, sur les deux axes, source et destination — de sorte qu'un hôte protégé au sein d'un préfixe banni en bloc continue de recevoir du trafic, sans aller-retour vers l'espace utilisateur."
      },
      {
        "title": "Le verdict par défaut est passe",
        "body": "Tout ce que les règles ne font pas explicitement correspondre est transmis. Il n'y a pas de refus par défaut caché dans un analyseur : même la seule forme de paquet que le programme ne peut pas inspecter entièrement est laissée passer et comptée, non rejetée."
      }
    ]
  },
  "showcaseCaption": "La carte du plan de données dans la console, en direct : le programme attaché à eth0, trois détections installées sous forme de trois règles du noyau, et la mémoire de maps qu'il a réservée d'avance."
};

const es: XdpDict = {
  "meta": {
    "title": "Mitigación XDP en el kernel — Kapkan",
    "description": "Kapkan compila una detección en mapas del kernel de Linux y descarta el ataque con un programa XDP, antes de que los paquetes lleguen a la pila de red — en hardware que ya utilizas. Limitación de tasa por origen, dry-run de forma predeterminada, y cada regla expira dentro del kernel."
  },
  "nav": {
    "docs": "Documentación del plano de datos",
    "home": "Inicio",
    "backToSite": "kapkan.io"
  },
  "hero": {
    "eyebrow": "Plano de datos en el kernel",
    "h1a": "Descarta el ataque",
    "h1b": "en el kernel.",
    "sub": "Cualquier otra forma en que Kapkan detiene un ataque anuncia una ruta y pide a un router que actúe en consecuencia. El plano de datos se salta la petición. La misma detección que se convertiría en una regla FlowSpec se compila en mapas del kernel de Linux, y un programa XDP descarta el ataque en el cable — antes de que llegue a la pila de red, en un equipo que ya utilizas.",
    "ctaDocs": "Lee la documentación del plano de datos",
    "ctaConfig": "Crea una configuración",
    "trust": [
      "Linux 5.15+",
      "Nada que compilar en el equipo",
      "Dry-run de forma predeterminada",
      "Las reglas expiran en el kernel"
    ],
    "shotAlt": "Consola de Kapkan: tres ataques activos, cada uno mitigado mediante descarte en el kernel (XDP)",
    "shotCaption": "Tres detecciones en vivo, cada una descartada en el kernel — no anunciada a un router."
  },
  "contrast": {
    "heading": "Anunciar o descartar.",
    "sub": "Kapkan siempre ha convertido una detección en un anuncio BGP — una ruta blackhole, o una regla FlowSpec quirúrgica — y ha dejado el descarte a tus routers. El plano de datos añade una segunda respuesta: hazlo tú mismo.",
    "announce": {
      "title": "Anunciar (RTBH / FlowSpec)",
      "body": "Kapkan le dice a un router qué descartar. El router hace el trabajo, dondequiera que se encuentre en tu red.",
      "points": [
        "Alcanza cada prefijo que transportan tus routers, mucho más arriba que cualquier equipo individual.",
        "Necesita un router que hable el protocolo, y una sesión en la que confíe.",
        "FlowSpec coincide con cabeceras; no puede limitar la tasa de cada origen por separado."
      ]
    },
    "drop": {
      "title": "Descartar (XDP en el kernel)",
      "body": "Kapkan descarta el paquete por sí mismo, en el kernel del equipo que lo ejecuta, antes de que la pila de red lo vea.",
      "points": [
        "Sin router, sin sesión, sin protocolo — la regla es una entrada de un mapa del kernel.",
        "Se ejecuta en el punto más temprano en que el software puede tocar un paquete: la ruta de recepción del controlador.",
        "Da a cada origen atacante su propio presupuesto, algo que FlowSpec no puede expresar."
      ]
    }
  },
  "how": {
    "heading": "De la detección al paquete descartado.",
    "sub": "El plano de datos se sitúa por debajo de la misma costura que usa cualquier otra mitigación, de modo que una detección llega a él tras haber superado ya cada comprobación de seguridad. Lo que cambia es el último paso: en lugar de un anuncio, las reglas se convierten en entradas de mapas del kernel.",
    "steps": [
      {
        "title": "El detector se dispara",
        "body": "Los mismos umbrales corregidos por muestreo, las líneas base aprendidas y el clasificador de siempre. Nada de la detección cambia porque cambie la mitigación."
      },
      {
        "title": "Se generan las reglas",
        "body": "La detección produce las mismas reglas que habría anunciado como FlowSpec — ancladas a la víctima, como mucho un puñado por ataque — a través de un segundo codificador en lugar de uno BGP."
      },
      {
        "title": "Se escriben los mapas",
        "body": "Las reglas codificadas se escriben en los mapas del kernel del programa XDP, con doble búfer para que una recarga intercambie toda una generación de forma atómica, sin ninguna ventana en la que el tráfico quede sin coincidir."
      },
      {
        "title": "El kernel decide",
        "body": "Para cada paquete el programa recorre un orden fijo — lista de permitidos, reglas estáticas, coincidencia de víctima, presupuesto por origen — y devuelve pasar o descartar. El veredicto predeterminado siempre es pasar."
      }
    ],
    "diagram": {
      "detect": "Detección",
      "compile": "Codificador de reglas",
      "maps": "Mapas del kernel",
      "verdict": "Programa XDP",
      "pass": "PASAR (predet.)",
      "drop": "DESCARTAR (coincide)",
      "caption": "Cada paquete de la interfaz toma este camino. Todo lo que las reglas no hacen coincidir se deja pasar, intacto."
    }
  },
  "ratelimit": {
    "heading": "Limitación de tasa por origen — lo que FlowSpec no puede expresar.",
    "body": "Una regla FlowSpec hace coincidir un flujo y lo descarta, o lo controla a una única tasa compartida. No tiene forma de decir «mantén cada origen individual en N». El plano de datos sí: cada origen atacante obtiene su propio token bucket en un mapa del kernel. Un límite de N mantiene cada origen en N, en lugar de dejar que mil orígenes y tus clientes legítimos peleen por un único techo agregado.",
    "aside": "Esta es la única capacidad que no es una versión más rápida de algo que el anunciador ya hacía — es algo que el anunciador estructuralmente no podía hacer en absoluto."
  },
  "safety": {
    "heading": "Seguro por construcción.",
    "sub": "El plano de datos hereda cada propiedad de seguridad que Kapkan ya tenía, porque se sitúa por debajo de la misma costura — y añade una que el kernel impone por sí mismo.",
    "cards": [
      {
        "title": "Dry-run sigue siendo el valor predeterminado",
        "body": "Sin activarlo en vivo, el programa se adjunta, hace coincidir y cuenta exactamente como lo haría en producción — pero cada veredicto de descarte se reescribe como pasar. Ves lo que haría antes de que haga nada."
      },
      {
        "title": "Las reglas expiran dentro del kernel",
        "body": "Cada regla generada lleva su propio plazo, y el programa trata una regla expirada como ausente. Un Kapkan que se detiene, se cuelga o se reinicia no puede dejar el tráfico de una víctima descartado: el kernel olvida según lo previsto, sin ningún daemon en el bucle."
      },
      {
        "title": "La lista blanca se aplica en el kernel",
        "body": "Tu lista blanca protegida se comprueba en el propio programa, tanto en el eje de origen como en el de destino — de modo que un host protegido dentro de un prefijo baneado en bloque sigue recibiendo tráfico, sin un viaje de ida y vuelta al espacio de usuario."
      },
      {
        "title": "El veredicto predeterminado es pasar",
        "body": "Todo lo que las reglas no hacen coincidir explícitamente se reenvía. No hay ninguna denegación por defecto escondida en un analizador: incluso la única forma de paquete que el programa no puede inspeccionar por completo se deja pasar y se cuenta, no se descarta."
      }
    ]
  },
  "measured": {
    "heading": "Medido, no afirmado.",
    "sub": "Dieciocho capturas de ataques se ejecutan de extremo a extremo en cada cambio — telemetría sintética hacia el detector real, sus reglas generadas compiladas en mapas del kernel reales, y luego las tramas capturadas reproducidas a través del programa, con tráfico legítimo intercalado en todo momento.",
    "stats": [
      {
        "value": "18",
        "label": "capturas de ataques, en cada build"
      },
      {
        "value": "100 %",
        "label": "del tráfico de ataque descartado en 17 de 18 (98,5 % en la captura de límite de tasa por origen)"
      },
      {
        "value": "0",
        "label": "tramas legítimas descartadas · 0 tramas en lista de permitidos descartadas"
      },
      {
        "value": "5.15–6.12",
        "label": "kernels sobre los que se ejecuta la suite completa en CI (5.15, 6.1, 6.6, 6.12)"
      }
    ],
    "caveat": "Estas son tasas de bloqueo, no de rendimiento. Una tasa de bloqueo dice qué fracción de un ataque capturan las reglas; no dice nada sobre cuántos paquetes puede absorber un equipo dado, lo cual depende de tu NIC, controlador, CPU y de si el programa se adjuntó en modo nativo o genérico. Dimensiona un despliegue sobre tu propio hardware."
  },
  "limits": {
    "heading": "Los límites honestos.",
    "sub": "Dos cosas que conviene saber antes de desplegarlo, expuestas aquí en lugar de descubiertas más tarde.",
    "items": [
      {
        "title": "Una forma de paquete IPv6 se deja pasar sin inspeccionar",
        "body": "Un paquete IPv6 que lleva más de ocho cabeceras de extensión se reenvía sin que se evalúe ninguna regla — recorrer una cadena más larga le costaría al programa un presupuesto del kernel del que no dispone. Esto es deliberado: un límite de análisis que descartara paquetes sería una denegación por defecto escondida en un analizador. Ningún tráfico legítimo encadena ocho, así que se cuenta y se expone — la CLI y la consola señalan cualquier movimiento en ese contador — en lugar de enterrarse."
      },
      {
        "title": "El adjuntado nativo y el genérico difieren en capacidad",
        "body": "En un controlador con soporte XDP nativo el programa se ejecuta en la ruta de recepción del controlador, antes de que se construya un skb. Sin él, el kernel recurre al modo genérico, que es correcto pero hace mucho menos por núcleo. Kapkan informa de qué modo obtuvo cada interfaz; planifica la capacidad en torno al modo nativo, y trata el genérico como un fallback funcional, no como el objetivo."
      }
    ]
  },
  "requirements": {
    "heading": "Qué necesita.",
    "sub": "Sin agente, sin sidecar, sin compilador en el equipo. El programa se distribuye como bytecode verificado dentro del binario.",
    "items": [
      "Linux 5.15 o posterior, con BTF (CONFIG_DEBUG_INFO_BTF=y — todo kernel de distribución mayoritaria lo tiene).",
      "CAP_BPF y CAP_NET_ADMIN, y un bpffs escribible en /sys/fs/bpf.",
      "Una interfaz a la que adjuntarse. XDP nativo si el controlador lo soporta; genérico en caso contrario.",
      "Nada que compilar. El objeto XDP se compila con antelación y se incrusta en el binario de Kapkan."
    ]
  },
  "showcaseCaption": "La tarjeta del plano de datos en la consola, en vivo: el programa adjuntado a eth0, tres detecciones instaladas como tres reglas del kernel, y la memoria de mapas que reservó por adelantado.",
  "cta": {
    "heading": "Descártalo tú mismo.",
    "sub": "Añade un bloque dataplane, deja dry-run activado, y observa lo que descartaría antes de que descarte nada.",
    "primary": "Lee la documentación del plano de datos",
    "secondary": "Crea una configuración"
  }
};

// Locale table. English is authored above; ru/de/fr/es were translated and
// adversarially verified (workflow xdp-landing-fanout), then hand-fixed:
// a German causal that had inverted, a French "par cœur" idiom clash, and
// comma-decimal number formatting for de/fr/es.
export const xdp: Record<Locale, XdpDict> = { en, ru, de, fr, es };
