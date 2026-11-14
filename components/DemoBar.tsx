"use client";
// Қорғауға арналған «Демо жүргізуші» панелі: әкімдік аккаунтымен кіргенде бүкіл цикл ретімен бір басумен ашылады
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "./UserChip";

const STEPS = [
  { href: "/citizen", t: "Тұрғын", d: "фото жіберу" },
  { href: "/ops", t: "Оператор", d: "бригада тағайындау" },
  { href: "/worker", t: "Тазалықшы", d: "фотомен растау" },
  { href: "/citizen", t: "Тұрғын", d: "нәтиже + баға", q: "?tab=mine" },
  { href: "/dashboard", t: "Әкімдік", d: "есеп" },
];

export function DemoBar() {
  const me = useMe();
  const path = usePathname();
  if (me?.role !== "akimat" || path === "/" || path === "/login" || path === "/qr") return null;
  return (
    // Телефонда: тек нөмірлер, төменгі мәзірлердің үстінде оң жақта — ештеңені жаппайды
    <nav
      aria-label="Демо қадамдары"
      className="no-print fixed bottom-[calc(84px+env(safe-area-inset-bottom))] right-2 z-[60] flex max-w-[calc(100vw-16px)] items-center gap-0.5 overflow-x-auto rounded-full border border-white/15 bg-ink/95 p-1 shadow-2xl backdrop-blur [scrollbar-width:none] lg:bottom-3 lg:left-0 lg:right-0 lg:mx-auto lg:w-fit lg:gap-1"
    >
      <span className="mono shrink-0 px-1.5 text-[10px] uppercase tracking-wider text-mist lg:px-2.5">Демо</span>
      {STEPS.map((s, i) => {
        const on = path === s.href && (s.q ? false : true);
        return (
          <Link
            key={i}
            href={s.href + (s.q ?? "")}
            aria-label={`${i + 1}. ${s.t}: ${s.d}`}
            className={`flex shrink-0 items-center gap-1.5 rounded-full p-1 text-[12px] font-semibold transition lg:px-3 lg:py-1.5 ${on ? "bg-qyzyl text-white" : "text-salt hover:bg-white/10"}`}
          >
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] lg:h-5 lg:w-5 lg:text-[10px] ${on ? "bg-white text-qyzyl" : "bg-white/15"}`}>{i + 1}</span>
            <span className={on ? "pr-1.5 lg:pr-0" : "hidden lg:inline"}>{s.t}</span>
            <span className="hidden text-[10px] font-medium opacity-70 min-[1400px]:inline">· {s.d}</span>
          </Link>
        );
      })}
    </nav>
  );
}
