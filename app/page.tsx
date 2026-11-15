"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import QRCode from "qrcode";
import { ArrowRight, ArrowUpRight, BarChart3, Camera, Map as MapIcon, Search, Sprout } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { Device } from "@/components/Devices";
import { GovStrip } from "@/components/GovStrip";
import { useCity } from "@/lib/client";
import { useCityConf } from "@/components/CityProvider";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const CHAPTERS = [
  {
    k: "01",
    t: "Тұрғын түсіреді",
    d: "Қосымша орнатпайды: QR арқылы ашады, бір фото жібереді. ЖИ қоқыстың түрін, көлемін және қауіптілігін анықтайды, орны GPS бойынша қойылады.",
    img: "/shots/citizen-m.jpg",
    phone: true,
    href: "/citizen",
  },
  {
    k: "02",
    t: "Оператор бір басумен жібереді",
    d: "eGov, TazaQazBot, 109 және TrashSTOP шағымдары бір картаға түседі. Қайталанғандары біріктіріледі, ЖИ ең жақын әрі бос бригаданы ұсынады.",
    img: "/shots/ops.jpg",
    href: "/ops",
  },
  {
    k: "03",
    t: "Жұмыс фотомен дәлелденеді",
    d: "Тазалықшы «кейін» фотосын жүктейді. Фото шағым нүктесінен 100 метрден алыс түсірілсе немесе қоқыс әлі көрінсе, тапсырма жабылмайды.",
    img: "/shots/worker-m.jpg",
    phone: true,
    href: "/worker",
  },
  {
    k: "04",
    t: "Әкімдік бәрін көреді",
    d: "Мерзімінде орындау, кешіккен тапсырмалар, аудандардың индексі және премияға лайық тазалықшылар. Апталық есепті ЖИ жазады.",
    img: "/shots/dashboard.jpg",
    href: "/dashboard",
  },
];

const SERVICES = [
  { href: "/citizen", t: "Өтініш беру", d: "Қоқысты суретке түсіріңіз: түрін, көлемін және мекенжайын жүйе өзі анықтайды.", cta: "Өтініш беру", icon: Camera },
  { href: "/track", t: "Өтінішті тексеру", d: "Өтініш нөмірі бойынша мәртебесін, орындаушысын және мерзімін біліңіз.", cta: "Тексеру", icon: Search },
  { href: "/public#map", t: "Қала картасы", d: "Қай жерде шағым бар, қай жер тазаланды — бүкіл қала бір картада.", cta: "Картаны ашу", icon: MapIcon },
  { href: "/family", t: "Таза ұрпақ", d: "Ата-ана балаға аула тазалау тапсырмасын береді, бала еңбекпен ақша табады. Нәтиже — фотомен.", cta: "Отбасымен бастау", icon: Sprout },
  { href: "/public#feed", t: "Қала жаңалығы", d: "Фото мен GPS арқылы расталған жұмыстар: дейін → кейін. Аудандардың индексі және қала батырлары.", cta: "Лентаны ашу", icon: BarChart3 },
];

// Әр қаланың фактілері — тек дереккөзі бар сандар
const FACTS_ALMATY = [
  { n: "2,37 млн", u: "тұрғын", l: "Алматыда тұрады — Қазақстандағы ең үлкен қала.", s: "stat.gov.kz, 2026" },
  { n: "8 590", u: "бұзушылық", l: "абаттандыру қағидалары бойынша (ӘҚБтК 505-бап) 2026 жылы анықталды.", s: "Kazlenta, 2026" },
  { n: "100 000+", u: "нысан", l: "қоқыс шығару бойынша толық цифрлық бақылаусыз қызмет алады.", s: "vapress.kz, 2026" },
  { n: "4 млн+", u: "ағаш", l: "қалада өседі. Жасыл аймақ — қала аумағының 33%-ы.", s: "inform.kz, 2026" },
];

const FACTS = [
  { n: "100 000", u: "ағаш", l: "соңғы үш жылда қалада отырғызылды. Жартысынан көбі қурап қалды.", s: "24.kz, 2024" },
  { n: "150-160", u: "тонна", l: "қоқыс Қызылордадан күн сайын шығарылады.", s: "Tengrinews / Massaget.kz" },
  { n: "25 000+", u: "өтініш", l: "2025 жылы TazaQazBot-қа түсті. Қабылдау бар, орындалуын дәлелдеу жоқ.", s: "24.kz, 2025" },
  { n: "2026", u: "жыл", l: "әкімдіктер абаттандыру бойынша хаттаманы өздері толтыра алатын болды.", s: "Tengrinews, 2026" },
];

const ROLES = [
  { href: "/citizen", t: "Тұрғын", d: "Фото → ЖИ → шағым, бақылау, тазалықшыға рақмет", tag: "Телефон", img: "/shots/citizen-m.jpg", phone: true },
  { href: "/ops", t: "Оператор", d: "Тірі карта, ЖИ кезегі, диспетчер, ошақтар болжамы", tag: "Басқару", img: "/shots/ops.jpg" },
  { href: "/worker", t: "Тазалықшы", d: "Екі үлкен батырма, фото мен геоорын арқылы растау", tag: "Телефон", img: "/shots/worker-m.jpg", phone: true },
  { href: "/inspector", t: "Инспектор", d: "Көліктен тастау, қоқыс өртеу: дәлелдер, хаттама жобасы", tag: "ЖИ", img: "/shots/inspector.jpg" },
  { href: "/green", t: "Жасыл қор", d: "320 ағаш, тірі қалу пайызы, ауа райы бойынша суару", tag: "Көгалдандыру", img: "/shots/green.jpg" },
  { href: "/dashboard", t: "Әкімдік", d: "KPI, бригадалар рейтингі, ЖИ апталық есебі", tag: "Басшы", img: "/shots/dashboard.jpg" },
];

export default function Home() {
  const city = useCityConf();
  const almaty = city.id === "almaty";
  const { state } = useCity(5000);
  const root = useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState("");
  const [qr, setQr] = useState("");
  const [hover, setHover] = useState(0);

  // Бүгінгі «сыпырылған» үлес: соңғы 24 сағатта түскен сигналдардың қаншасы жабылды
  const ratio = useMemo(() => {
    if (!state) return 0.6;
    const day = state.reports.filter((r) => state.now - r.createdAt < 864e5 || (r.doneAt && state.now - r.doneAt < 864e5));
    const done = day.filter((r) => r.status === "done").length;
    return day.length ? Math.max(0.2, Math.min(0.92, done / day.length)) : 0.6;
  }, [state]);
  const ratioRef = useRef(ratio);
  ratioRef.current = ratio;

  const points = useMemo(
    () =>
      (state?.reports ?? [])
        .filter((r) => r.status !== "rejected")
        .map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, color: r.status === "done" ? "#0e0e0d" : "#e2231a", size: r.status === "done" ? 2.6 : 4.4, stroke: "#f2f1ed" })),
    [state],
  );
  const pulse = useMemo(() => (state?.reports ?? []).filter((r) => r.status === "new").slice(0, 5).map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, color: "#e2231a" })), [state]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Qyzylorda" }));
    tick();
    const id = setInterval(tick, 1000);
    QRCode.toDataURL(`${location.origin}/citizen`, { margin: 0, width: 280, color: { dark: "#0e0e0d", light: "#f2f1ed" } }).then(setQr);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = root.current!;
    const sweep = { p: 0 };
    const label = el.querySelector<HTMLElement>("[data-pct]");
    const apply = () => {
      el.style.setProperty("--p", String(sweep.p));
      if (label) label.textContent = `${Math.round(Math.min(1, Math.max(0, sweep.p)) * 100)}% сыпырылды`;
    };
    if (reduce) {
      sweep.p = ratioRef.current;
      apply();
      return;
    }

    const ctx = gsap.context(() => {
      // Интро: сыпыру сызығы бүгінгі нақты үлеске дейін өтеді
      const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
      intro
        .from("[data-corner]", { opacity: 0, y: 12, duration: 0.9, stagger: 0.06 }, 0.1)
        .from("[data-hero-line]", { clipPath: "inset(0 100% 0 0)", duration: 1.1, stagger: 0.08 }, 0)
        .to(sweep, { p: ratioRef.current, duration: 1.8, onUpdate: apply }, 0.35);

      // Скролл: бет қалыпты айналады (бекітусіз), сыпыру hero кеткен сайын 100%-ға жетеді
      ScrollTrigger.create({
        trigger: "[data-hero]",
        start: "top top",
        end: "bottom 30%",
        invalidateOnRefresh: true,
        onUpdate: (st) => {
          if (intro.isActive()) return;
          sweep.p = ratioRef.current + (1 - ratioRef.current) * st.progress;
          apply();
        },
      });

      // Idle: сызық баяу тыныс алады (тек жоғарыда тұрғанда)
      let t = 0;
      const breathe = () => {
        t += gsap.ticker.deltaRatio() / 60;
        if (intro.isActive() || window.scrollY > 4) return;
        sweep.p = ratioRef.current + Math.sin(t * 1.1) * 0.012;
        apply();
      };
      gsap.ticker.add(breathe);

      gsap.utils.toArray<HTMLElement>("[data-sweep]").forEach((n) => {
        gsap.from(n, { clipPath: "inset(0 100% 0 0)", duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: n, start: "top 85%" } });
      });

      // Тараулар: sticky сурет тарауға қарай ауысады
      gsap.utils.toArray<HTMLElement>("[data-chapter]").forEach((n, i) => {
        ScrollTrigger.create({
          trigger: n,
          start: "top 55%",
          end: "bottom 55%",
          onToggle: (st) => {
            if (!st.isActive) return;
            el.querySelectorAll<HTMLElement>("[data-shot]").forEach((s, j) => {
              gsap.to(s, { clipPath: j <= i ? "inset(0 0% 0 0)" : "inset(0 0% 0 100%)", duration: 0.9, ease: "expo.inOut" });
            });
            el.querySelectorAll<HTMLElement>("[data-chapter]").forEach((c, j) => c.setAttribute("data-active", String(j === i)));
          },
        });
      });

      // Hero-дан төмен түскенде — жабысқақ жоғарғы навигация шығады
      ScrollTrigger.create({
        trigger: "[data-hero]",
        start: "bottom 72px",
        onEnter: () => el.querySelector("[data-sticky]")?.setAttribute("data-on", "true"),
        onLeaveBack: () => el.querySelector("[data-sticky]")?.setAttribute("data-on", "false"),
      });

      return () => gsap.ticker.remove(breathe);
    }, el);

    return () => {
      ctx.revert();
    };
  }, []);

  const pct = Math.round(ratio * 100);

  return (
    <div ref={root} className="light-page" style={{ ["--p" as string]: "0" }}>
      <GovStrip />
      {/* Жабысқақ навигация: кез келген жерден рөлге бір басумен өту */}
      <div
        data-sticky
        data-on="false"
        className="fixed inset-x-0 top-0 z-50 -translate-y-full border-b border-line bg-salt/95 backdrop-blur transition-transform duration-500 ease-[var(--ease-sweep)] data-[on=true]:translate-y-0"
      >
        <div className="flex items-center gap-4 px-[var(--gutter)] py-2.5">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="TrashSTOP басты бет">
            <LogoMark size={26} />
            <span className="display hidden text-[18px] tracking-normal sm:inline">
              Trash<span className="text-qyzyl">Stop</span>
            </span>
          </Link>
          <nav aria-label="Рөлдер" className="flex flex-1 gap-1 overflow-x-auto text-[13px] font-semibold [scrollbar-width:none]">
            {ROLES.map((r) => (
              <Link key={r.href} href={r.href} className="shrink-0 rounded-full px-3 py-1.5 transition hover:bg-ink hover:text-salt">
                {r.t}
              </Link>
            ))}
          </nav>
          <Link href="/citizen" className="sweep-btn hidden shrink-0 rounded-full bg-qyzyl px-4 py-2 text-[13px] font-semibold text-white md:inline-flex" style={{ ["--sweep" as string]: "#0e0e0d" }}>
            Сигнал жіберу
          </Link>
        </div>
      </div>
      {/* ── HERO: ҚЫЗЫЛ → ТАЗА ── */}
      <section data-hero className="relative h-dvh min-h-[620px] overflow-hidden bg-salt">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.55] [mask-image:linear-gradient(90deg,transparent_0%,#000_45%)]">
          <MapView theme="mono" points={points} pulse={pulse} zoom={13.4} pitch={45} controls={false} interactive={false} />
        </div>

        <header className="relative z-10 flex items-start justify-between px-[var(--gutter)] pt-[var(--gutter)]">
          <Link href="/" data-corner className="flex items-center gap-2.5" aria-label="TrashSTOP басты бет">
            <LogoMark size={30} />
            <span className="display text-[22px] tracking-normal">
              Trash<span className="text-qyzyl">Stop</span>
            </span>
          </Link>
          <nav data-corner aria-label="Негізгі" className="hidden items-center gap-7 text-[14px] font-medium md:flex">
            <a href="#cycle" className="sweep-line pb-0.5">
              Цикл
            </a>
            <a href="#facts" className="sweep-line pb-0.5">
              Фактілер
            </a>
            <a href="#roles" className="sweep-line pb-0.5">
              Рөлдер
            </a>
            <Link href="/public" className="sweep-line pb-0.5">
              Ашық қала
            </Link>
            <Link href="/login" className="sweep-btn rounded-full border border-ink px-4 py-1.5 font-semibold" style={{ ["--sweep" as string]: "#0e0e0d", ["--sweep-ink" as string]: "#f2f1ed" }}>
              Кіру
            </Link>
          </nav>
          <Link href="/login" data-corner className="sweep-btn rounded-full border border-ink px-4 py-2 text-[13px] font-semibold md:hidden" style={{ ["--sweep" as string]: "#0e0e0d", ["--sweep-ink" as string]: "#f2f1ed" }}>
            Кіру
          </Link>
        </header>

        <div className="pointer-events-none absolute inset-x-0 top-[19vh] z-10 px-[var(--gutter)] md:top-[15vh]">
          <h1 className="sr-only">{almaty ? "TrashSTOP: Алматыны таза қалаға айналдыратын жүйе" : "TrashSTOP: Қызылорданы қызылдан тазаға сыпыратын жүйе"}</h1>
          <div aria-hidden="true" data-no-translate className="display select-none text-[29vw] leading-[0.84] md:text-[length:var(--t-mega)]">
            <div data-hero-line className="relative w-fit">
              {/* қызыл қабат: сыпыру сызығынан оңға қарай қалады */}
              <span className="block text-qyzyl" style={{ clipPath: "inset(0 0 0 calc(var(--p) * 100%))" }}>
                {almaty ? "Қоқыс" : "Қызыл"}
              </span>
              {/* таза қабат: сызықтың сол жағы */}
              <span className="absolute inset-0 block text-ink" style={{ clipPath: "inset(0 calc((1 - var(--p)) * 100%) 0 0)" }}>
                Таза
              </span>
              {/* сыпырғыш сызығы */}
              <span className="absolute -bottom-[6%] -top-[6%] w-[3px] bg-ink" style={{ left: "calc(var(--p) * 100%)" }}>
                <span data-pct className="mono absolute left-3 top-1 whitespace-nowrap bg-ink px-1.5 py-0.5 text-[11px] font-semibold tracking-normal text-salt normal-case">
                  {Math.round(Number(pct))}% сыпырылды
                </span>
              </span>
            </div>
            <div data-hero-line className="-mt-[0.02em] text-ink" style={almaty ? { fontSize: "0.66em", marginTop: "0.04em" } : undefined}>
              {almaty ? "Алматы" : "Орда"}
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 grid grid-cols-12 items-end gap-[var(--gutter)] px-[var(--gutter)] pb-[calc(var(--gutter)+22px)]">
          {/* Рөлдерге жылдам кіру — бірінші экранда */}
          <nav aria-label="Жүйеге кіру" data-corner className="col-span-12 -mb-1">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {ROLES.map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  className="sweep-btn shrink-0 rounded-full border border-ink/80 bg-salt/85 px-4 py-2.5 text-[14px] font-semibold text-ink"
                  style={{ ["--sweep" as string]: "#0e0e0d", ["--sweep-ink" as string]: "#f2f1ed" }}
                >
                  {r.t}
                </Link>
              ))}
            </div>
          </nav>
          <p data-corner className="col-span-12 max-w-[34rem] text-[17px] leading-[1.5] text-ink md:col-span-6">
            Қаладағы әр қызыл нүкте шешілмеген сигнал. TrashSTOP оны тұрғынның фотосынан бастап тазалықшының дәлеліне дейін алып барады және
            жұмыс фотомен расталғанда ғана жабады.
          </p>
          <div data-corner className="mono col-span-6 text-[12px] leading-relaxed text-muted md:col-span-3">
            {`${city.center[1].toFixed(2)}° N · ${city.center[0].toFixed(2)}° E`}
            <br />
            {city.name} · <span className="text-ink">{clock}</span>
            <br />
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-qyzyl" /> тірі деректер (тестілік)
            </span>
          </div>
          <div data-corner className="col-span-6 flex flex-col items-end gap-2 md:col-span-3">
            <Link href="/citizen" className="sweep-btn inline-flex items-center gap-3 rounded-full bg-ink px-6 py-4 text-[15px] font-semibold text-salt" style={{ ["--sweep" as string]: "#e2231a" }}>
              Сигнал жіберу <ArrowRight size={18} />
            </Link>
            <Link href="/ops" className="sweep-line text-[13px] font-semibold">
              Басқару орталығына өту
            </Link>
          </div>
        </div>
      </section>

      <main id="main">
        {/* ── ҚЫЗМЕТТЕР: мемлекеттік порталдағыдай — не істеуге болатыны бірден көрінеді ── */}
        <section aria-labelledby="services-h" className="a11y-zoom border-b border-line bg-white px-[var(--gutter)] py-14">
          <div className="grid grid-cols-12 gap-[var(--gutter)]">
            <div className="col-span-12 lg:col-span-4">
              <h2 id="services-h" className="display text-[clamp(2.2rem,1.4rem+3vw,3.6rem)]">
                Қызметтер
              </h2>
              <p className="mt-3 max-w-sm text-[17px] leading-relaxed text-muted">Тіркелусіз, қарапайым тілмен. Әр қызмет бір-екі қадамнан тұрады.</p>
              <form action="/track" className="mt-6 max-w-sm">
                <label htmlFor="hero-code" className="mb-1.5 block text-[14px] font-semibold text-ink">
                  Өтінішіңізді тексеріңіз
                </label>
                <div className="flex gap-2">
                  <input id="hero-code" name="code" placeholder="TS-1101" className="mono min-h-[52px] min-w-0 flex-1 rounded-[6px] border-2 border-ink/20 bg-white px-4 text-[18px] outline-none focus:border-ink" />
                  <button type="submit" className="sweep-btn min-h-[52px] rounded-[6px] bg-ink px-5 text-[16px] font-bold text-salt">
                    Тексеру
                  </button>
                </div>
              </form>
            </div>
            <ul className="col-span-12 grid gap-3 sm:grid-cols-2 lg:col-span-8">
              {SERVICES.map((sv) => (
                <li key={sv.href}>
                  <Link href={sv.href} className="sweep-row group flex h-full items-start gap-4 rounded-[8px] border border-line bg-salt p-5 transition hover:border-ink sm:p-6">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[8px] bg-ink text-salt transition group-hover:bg-qyzyl">
                      <sv.icon size={26} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[20px] font-bold leading-tight text-ink">{sv.t}</span>
                      <span className="mt-1 block text-[15px] leading-snug text-muted">{sv.d}</span>
                      <span className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold text-qyzyl">
                        {sv.cta} <ArrowRight size={15} className="transition group-hover:translate-x-1" />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── STATEMENT ── */}
        <section className="grid grid-cols-12 gap-[var(--gutter)] px-[var(--gutter)] py-[18vh]">
          <p className="mono col-span-12 text-[12px] text-muted md:col-span-3">Неге тағы бір жүйе?</p>
          <p data-sweep className="col-span-12 text-[length:var(--t-l)] font-medium leading-[1.12] tracking-[-0.02em] md:col-span-9">
            Шағым қабылдайтын арналар бар: eGov, TazaQazBot, 109. Бірақ қоқыстың шынымен шығарылғанын ешкім дәлелдемейді. TrashSTOP тапсырманы тек{" "}
            <span className="text-qyzyl">фото мен геоорын сәйкес келгенде</span> ғана жабады.
          </p>
        </section>

        {/* ── CYCLE: sticky narrative ── */}
        <section id="cycle" className="grid grid-cols-12 gap-[var(--gutter)] border-t border-line px-[var(--gutter)] pb-[12vh] pt-[10vh]">
          <div className="col-span-12 md:col-span-5">
            <h2 className="display mb-[8vh] text-[length:var(--t-xl)]">Бір шағымның жолы</h2>
            {CHAPTERS.map((c) => (
              <article key={c.k} data-chapter data-active="false" className="sweep-row border-t border-line py-8 pl-6 md:min-h-[44vh]">
                <div className="mono text-[13px] text-qyzyl">{c.k} / 04</div>
                <h3 className="mt-3 text-[length:var(--t-m)] font-semibold leading-tight">{c.t}</h3>
                <p className="mt-3 max-w-[30rem] text-[17px] leading-[1.55] text-muted">{c.d}</p>
                <Link href={c.href} className="sweep-line mt-5 inline-flex items-center gap-1.5 text-[14px] font-semibold">
                  Өзіңіз көріңіз <ArrowUpRight size={15} />
                </Link>
                {/* телефонда: сурет тараудың ішінде */}
                <div className={`mt-7 md:hidden ${c.phone ? "px-[14%]" : ""}`}>
                  <Device src={c.img} phone={c.phone} alt={`${c.t}: TrashSTOP экраны`} />
                </div>
              </article>
            ))}
          </div>
          <div className="relative col-span-7 col-start-6 hidden md:block">
            <div className="sticky top-[10vh] h-[80vh] overflow-hidden rounded-[6px] bg-salt-2">
              {CHAPTERS.map((c, i) => (
                <div
                  key={c.k}
                  data-shot
                  className="absolute inset-0 flex items-center justify-center bg-salt-2 p-[6%]"
                  style={{ clipPath: i === 0 ? "inset(0 0% 0 0)" : "inset(0 0% 0 100%)" }}
                >
                  <div className={c.phone ? "h-full max-h-[620px] [&>figure]:h-full [&>figure]:w-auto [&>figure]:max-w-none" : "w-full max-w-[760px]"}>
                    <Device src={c.img} phone={c.phone} alt={`${c.t}: TrashSTOP экраны`} eager={i === 0} />
                  </div>
                  <span className="mono absolute bottom-5 left-6 text-[12px] text-muted">
                    {c.k} / 04 · {c.t}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FACTS ── */}
        <section id="facts" className="bg-ink px-[var(--gutter)] py-[14vh] text-salt">
          <div className="grid grid-cols-12 gap-[var(--gutter)]">
            <h2 className="display col-span-12 text-[length:var(--t-xl)] md:col-span-4">
              Қала
              <br />
              сандармен
            </h2>
            <div className="col-span-12 grid gap-x-[var(--gutter)] gap-y-14 sm:grid-cols-2 md:col-span-8">
              {(almaty ? FACTS_ALMATY : FACTS).map((f) => (
                <div key={f.n} data-sweep className="border-t border-line-d pt-5">
                  <div className="display text-[clamp(3.2rem,2rem+4vw,6rem)] tabular-nums">
                    {f.n}
                    <span className="ml-2 align-top text-[0.32em] text-qyzyl">{f.u}</span>
                  </div>
                  <p className="mt-3 max-w-[24rem] text-[16px] leading-[1.5] text-[#c9c8c1]">{f.l}</p>
                  <p className="mono mt-2 text-[11px] text-mist">Дереккөз: {f.s}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ROLES: index list with preview ── */}
        <section id="roles" className="grid grid-cols-12 gap-[var(--gutter)] px-[var(--gutter)] py-[14vh]">
          <div className="col-span-12 md:col-span-7">
            <h2 className="display mb-10 text-[length:var(--t-xl)]">Алты экран, бір жүйе</h2>
            {/* телефонда: экрандар галереясы (саусақпен сырғытылады) */}
            <div className="-mx-[var(--gutter)] mb-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-[var(--gutter)] pb-2 [scrollbar-width:none] md:hidden">
              {ROLES.map((r) => (
                <Link key={r.href} href={r.href} className={`shrink-0 snap-center ${r.phone ? "w-[46vw]" : "w-[80vw]"}`}>
                  <Device src={r.img} phone={r.phone} alt={`${r.t} экраны`} />
                  <div className="mt-3 text-center text-[13px] font-semibold">{r.t}</div>
                </Link>
              ))}
            </div>
            <ul className="border-b border-line">
              {ROLES.map((r, i) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    data-active={hover === i}
                    className="sweep-row group grid grid-cols-[3rem_1fr_auto] items-baseline gap-4 border-t border-line py-5 pl-5 pr-1"
                  >
                    <span className="mono text-[12px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <span className="display block pb-[0.12em] text-[clamp(1.9rem,1.2rem+2.2vw,3.4rem)] leading-[1] transition-[translate] duration-500 ease-[var(--ease-sweep)] group-hover:translate-x-2">
                        {r.t}
                      </span>
                      <span className="mt-1 block text-[15px] text-muted">{r.d}</span>
                    </span>
                    <span className="mono hidden text-[11px] uppercase text-muted sm:block">{r.tag}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-5 hidden md:block">
            <div className="sticky top-[12vh] mt-[7.5rem] aspect-[4/4] overflow-hidden rounded-[6px] bg-salt-2">
              {ROLES.map((r, i) => (
                <div
                  key={r.href}
                  className="absolute inset-0 flex items-center justify-center bg-salt-2 p-[7%] transition-[clip-path] duration-700 ease-[var(--ease-sweep)]"
                  style={{ clipPath: hover === i ? "inset(0 0% 0 0)" : hover > i ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)" }}
                >
                  <div className={r.phone ? "h-full [&>figure]:h-full [&>figure]:w-auto [&>figure]:max-w-none" : "w-full"}>
                    <Device src={r.img} phone={r.phone} alt={`${r.t} экраны`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER finale ── */}
      <footer className="bg-qyzyl px-[var(--gutter)] pb-[var(--gutter)] pt-[12vh] text-white">
        <div className="grid grid-cols-12 items-end gap-[var(--gutter)]">
          <div className="col-span-12 md:col-span-8">
            <p className="mono text-[12px] text-white/80">Телефон камерасымен сканерлеңіз</p>
            <p className="mt-3 max-w-[30rem] text-[length:var(--t-m)] font-medium leading-snug">
              Кез келген затты суретке түсіріңіз. Ол үш секундта оператордың картасында пайда болады.
            </p>
          </div>
          <div className="col-span-12 md:col-span-4 md:justify-self-end">
            {qr && <img src={qr} alt="TrashSTOP тұрғын бетіне апаратын QR код" className="h-36 w-36 bg-salt p-2" />}
          </div>
        </div>
        <div aria-hidden="true" data-no-translate className={`display mt-[8vh] leading-[0.8] ${almaty ? "text-[clamp(3.6rem,0.5rem+13vw,16rem)]" : "text-[clamp(5rem,1rem+18vw,22rem)]"}`}>
          {almaty ? "Таза Алматы" : "Таза орда"}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/30 pt-5 text-[13px]">
          <span>GovTech Hackathon 2026 · 1-орын · Kyzylorda Hub</span>
          <span className="mono text-[12px] text-white/85">Демодағы шағымдар, адамдар мен ағаштар тестілік деректер</span>
          <Link href="/public" className="sweep-line font-semibold">
            Ашық деректер
          </Link>
        </div>
      </footer>
    </div>
  );
}
