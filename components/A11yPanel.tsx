"use client";
// Арнайы мүмкіндіктер (мемлекеттік сайттардағыдай): әріп өлшемі, жоғары контраст, тіл
import { useEffect, useState } from "react";
import { Eye, X } from "lucide-react";
import { usePathname } from "next/navigation";

export type A11y = { fs: 0 | 1 | 2; contrast: boolean; lang: "kk" | "ru" };
const KEY = "ts-a11y";

export function readA11y(): A11y {
  try {
    return { fs: 0, contrast: false, lang: "kk", ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { fs: 0, contrast: false, lang: "kk" };
  }
}
export function applyA11y(a: A11y) {
  const h = document.documentElement;
  h.dataset.fs = String(a.fs);
  if (a.contrast) h.dataset.contrast = "1";
  else delete h.dataset.contrast;
  h.lang = a.lang;
  h.dataset.lang = a.lang;
  window.dispatchEvent(new CustomEvent("ts-lang", { detail: a.lang }));
}

/** Бет жүктелмей тұрып қолданылатын скрипт (жыпылықтамау үшін) */
export const A11Y_BOOT = `try{var a=JSON.parse(localStorage.getItem("${KEY}")||"{}");var h=document.documentElement;h.dataset.fs=String(a.fs||0);if(a.contrast)h.dataset.contrast="1";if(a.lang==="ru"){h.lang="ru";h.dataset.lang="ru"}}catch(e){}`;

const T = {
  kk: { title: "Арнайы мүмкіндіктер", size: "Әріп өлшемі", contrast: "Контраст", normal: "Қалыпты", high: "Жоғары", lang: "Тіл", open: "Арнайы мүмкіндіктер", close: "Жабу" },
  ru: { title: "Специальные возможности", size: "Размер шрифта", contrast: "Контраст", normal: "Обычный", high: "Высокий", lang: "Язык", open: "Специальные возможности", close: "Закрыть" },
};

export function A11yPanel() {
  const [a, setA] = useState<A11y>({ fs: 0, contrast: false, lang: "kk" });
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setA(readA11y()), []);
  // Телефондағы төменгі мәзірден ашу
  useEffect(() => {
    const t = () => setOpen((o) => !o);
    window.addEventListener("ts-a11y-toggle", t);
    return () => window.removeEventListener("ts-a11y-toggle", t);
  }, []);
  function update(p: Partial<A11y>) {
    const n = { ...a, ...p };
    setA(n);
    try {
      localStorage.setItem(KEY, JSON.stringify(n));
    } catch {}
    applyA11y(n);
    if (p.lang && p.lang !== a.lang) location.reload(); // тіл ауысқанда — карта мен бәрі бірден дұрыс тілде
  }
  const t = T[a.lang];
  const withRail = ["/ops", "/green", "/inspector", "/dashboard", "/truckcam"].includes(path);
  // Жоғарғы жолағы бар беттерде қалқымалы батырма керек емес
  if (["/", "/track", "/public", "/login", "/citizen", "/worker", "/family"].includes(path)) return null;
  return (
    <div data-no-translate className={`no-print fixed z-[70] ${withRail ? "bottom-[calc(80px+env(safe-area-inset-bottom))] left-3 lg:bottom-3 lg:left-[80px]" : "bottom-3 left-3"}`}>
      {open && (
        <div role="dialog" aria-label={t.title} className="mb-2 w-[290px] rounded-[10px] border border-black/10 bg-white p-4 text-[#0e0e0d] shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="text-[16px] font-bold">{t.title}</div>
            <button onClick={() => setOpen(false)} aria-label={t.close} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5">
              <X size={18} />
            </button>
          </div>
          <div className="mt-3 text-[13px] font-semibold text-[#5c5b55]">{t.size}</div>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {([0, 1, 2] as const).map((f) => (
              <button
                key={f}
                onClick={() => update({ fs: f })}
                aria-pressed={a.fs === f}
                className={`h-12 rounded-[6px] border-2 font-bold ${a.fs === f ? "border-[#0e0e0d] bg-[#0e0e0d] text-white" : "border-black/10"}`}
                style={{ fontSize: [16, 20, 24][f] }}
              >
                A{"+".repeat(f)}
              </button>
            ))}
          </div>
          <div className="mt-3 text-[13px] font-semibold text-[#5c5b55]">{t.contrast}</div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            {[false, true].map((c) => (
              <button
                key={String(c)}
                onClick={() => update({ contrast: c })}
                aria-pressed={a.contrast === c}
                className={`h-12 rounded-[6px] border-2 text-[15px] font-bold ${a.contrast === c ? "border-[#0e0e0d] bg-[#0e0e0d] text-white" : "border-black/10"}`}
              >
                {c ? t.high : t.normal}
              </button>
            ))}
          </div>
          <div className="mt-3 text-[13px] font-semibold text-[#5c5b55]">{t.lang}</div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            {(
              [
                ["kk", "Қазақша"],
                ["ru", "Русский"],
              ] as const
            ).map(([l, n]) => (
              <button
                key={l}
                onClick={() => update({ lang: l })}
                aria-pressed={a.lang === l}
                className={`h-12 rounded-[6px] border-2 text-[15px] font-bold ${a.lang === l ? "border-[#0e0e0d] bg-[#0e0e0d] text-white" : "border-black/10"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t.open}
        title={t.open}
        className={`h-12 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-[14px] font-bold text-[#0e0e0d] shadow-lg transition hover:bg-[#f2f1ed] ${withRail ? "hidden lg:flex" : "flex"}`}
      >
        <Eye size={20} /> <span className={withRail ? "hidden" : "hidden sm:inline"}>{a.lang === "ru" ? "Версия для слабовидящих" : "Арнайы мүмкіндік"}</span>
        <span className="rounded-full bg-[#0e0e0d] px-2 py-0.5 text-[11px] text-white">{a.lang === "ru" ? "РУС" : "ҚАЗ"}</span>
      </button>
    </div>
  );
}
