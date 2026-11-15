"use client";
// Мемлекеттік сайттардағыдай жоғарғы жолақ: мекеме, байланыс, әріп өлшемі, контраст, тіл
import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { applyA11y, readA11y, type A11y } from "./A11yPanel";
import { CitySwitch } from "./CitySwitch";

export function GovStrip() {
  const [a, setA] = useState<A11y>({ fs: 0, contrast: false, lang: "kk" });
  useEffect(() => setA(readA11y()), []);
  function update(p: Partial<A11y>) {
    const n = { ...a, ...p };
    setA(n);
    try {
      localStorage.setItem("ts-a11y", JSON.stringify(n));
    } catch {}
    applyA11y(n);
    if (p.lang && p.lang !== a.lang) location.reload();
  }
  const ru = a.lang === "ru";
  return (
    <div data-no-translate className="no-print relative z-50 bg-ink text-[12px] text-salt">
      <div className="flex h-12 items-center gap-1.5 px-[var(--gutter)] sm:h-10 sm:gap-3">
        <span className="sm:hidden">
          <CitySwitch variant="strip" ru={ru} compact />
        </span>
        <span className="hidden sm:inline-flex">
          <CitySwitch variant="strip" ru={ru} />
        </span>
        <span className="hidden truncate font-medium text-stone-300 lg:inline">
          {ru ? "цифровая платформа службы чистоты" : "тазалық қызметінің цифрлық платформасы"}
        </span>
        <span className="hidden rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-stone-300 sm:inline">
          {ru ? "пилот · демо" : "пилот · демо"}
        </span>
        <a href="tel:109" aria-label={ru ? "Позвонить 109" : "109-ға қоңырау шалу"} className="ml-auto inline-flex h-10 items-center gap-1.5 px-1 font-semibold text-salt hover:underline sm:h-7">
          <Phone size={13} /> <span className="hidden min-[400px]:inline">109</span>
        </a>
        <span className="h-4 w-px bg-white/20" />
        <div className="flex items-center gap-0.5" role="group" aria-label={ru ? "Размер шрифта" : "Әріп өлшемі"}>
          {([0, 1, 2] as const).map((f) => (
            <button
              key={f}
              onClick={() => update({ fs: f })}
              aria-pressed={a.fs === f}
              aria-label={`${ru ? "Размер шрифта" : "Әріп өлшемі"} ${f + 1}`}
              className={`flex h-10 min-w-9 items-center justify-center rounded px-1 font-bold sm:h-7 sm:min-w-7 sm:px-1.5 ${a.fs === f ? "bg-salt text-ink" : "text-stone-300 hover:bg-white/10"}`}
              style={{ fontSize: [12, 14, 16][f] }}
            >
              A{"+".repeat(f)}
            </button>
          ))}
        </div>
        <button
          onClick={() => update({ contrast: !a.contrast })}
          aria-pressed={a.contrast}
          className={`hidden h-7 items-center rounded px-2 font-semibold sm:flex ${a.contrast ? "bg-salt text-ink" : "text-stone-300 hover:bg-white/10"}`}
        >
          {ru ? "Контраст" : "Контраст"}
        </button>
        <span className="h-4 w-px bg-white/20" />
        <div className="flex items-center gap-0.5" role="group" aria-label={ru ? "Язык" : "Тіл"}>
          {(
            [
              ["kk", "ҚАЗ"],
              ["ru", "РУС"],
            ] as const
          ).map(([l, n]) => (
            <button key={l} onClick={() => update({ lang: l })} aria-pressed={a.lang === l} className={`h-10 min-w-10 rounded px-1.5 font-bold sm:h-7 sm:min-w-0 sm:px-2 ${a.lang === l ? "bg-qyzyl text-white" : "text-stone-300 hover:bg-white/10"}`}>
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
