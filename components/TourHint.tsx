"use client";
// Демо нұсқаушы: әр қадамда «не басу керек» карточкасы. Тек демо жүргізуші (әкімдік) аккаунтында.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lightbulb, X } from "lucide-react";
import { useMe } from "./UserChip";
import { TOUR_KEY, tourCode } from "@/lib/demo";

type Hint = { step: string; title: string; text: string; next?: { href: string; label: string } };

function hintFor(path: string, search: string, code: string | null): Hint | null {
  const q = code ? `?open=${code}` : "";
  if (path === "/citizen" && search.includes("tab=mine"))
    return { step: "4/5", title: "Тұрғын нәтижені көреді", text: "Шағымды ашыңыз: «дейін» және «кейін» фотолары. Тазалықшыны бағалап, рақмет айтыңыз.", next: { href: "/dashboard", label: "5-қадам: Әкімдік" } };
  if (path === "/citizen")
    return { step: "1/5", title: "Тұрғын шағым жібереді", text: "«Демо фотомен байқау» батырмасын басыңыз — ЖИ қоқыстың түрін, көлемін, қауіптілігін бірнеше секундта анықтайды. Сосын «Жіберу».", next: { href: `/ops${q}`, label: "2-қадам: Оператор" } };
  if (path === "/ops")
    return { step: "2/5", title: "Оператор бір басумен жібереді", text: "Шағымыңыз ашық тұр. «Ең жақын қоқыс көлігі» тұсындағы «Жіберу →» — GPS бойынша ең жақын қоқыс көлігі мен бригада бір басумен тағайындалады.", next: { href: `/worker${q}`, label: "3-қадам: Тазалықшы" } };
  if (path === "/worker")
    return { step: "3/5", title: "Тапсырма тек дәлелмен жабылады", text: "«Жолға шықтым» → «Демо: таза жер фотосымен». Байқап көріңіз: төмендегі «Демо баптауы» → «Басқа жер» — жалған есепті жүйе қабылдамайды.", next: { href: "/citizen?tab=mine", label: "4-қадам: Тұрғын нәтижесі" } };
  if (path === "/dashboard")
    return { step: "5/5", title: "Басшы бәрін бір экраннан көреді", text: "Кешіккен тапсырмалар, жасыл қор, көліктердің маршруты, экономикалық тиімділік. Жоғарғы жолақтан Алматыға ауысып көріңіз.", next: { href: "/green", label: "Қосымша: Жасыл қор" } };
  if (path === "/green") return { step: "+", title: "Жасыл қор", text: "Ағашты басып, күйін тіркеңіз және күтім тапсырмасын беріңіз. ЖИ ағаштың фотосынан күйін анықтайды.", next: { href: "/public#feed", label: "Қала жаңалығы" } };
  if (path === "/public") return { step: "+", title: "Ашық лента", text: "Тек фото мен GPS расталған жұмыстар: суретті жылжытып, дейін мен кейінді салыстырыңыз.", next: { href: "/family", label: "«Таза ұрпақ»" } };
  if (path === "/family") return { step: "+", title: "Таза ұрпақ", text: "Ата-ана балаға қауіпсіз экологиялық тапсырма береді, бала фотомен орындап, еңбекпен ақша табады (демо әмиян)." };
  return null;
}

export function TourHint() {
  const me = useMe();
  const path = usePathname();
  const [search, setSearch] = useState("");
  const [on, setOn] = useState(false);
  const [closed, setClosed] = useState<string | null>(null);
  const [, bump] = useState(0);
  useEffect(() => {
    const on = () => bump((n) => n + 1);
    window.addEventListener("ts-tour-code", on);
    return () => window.removeEventListener("ts-tour-code", on);
  }, []);

  useEffect(() => {
    try {
      setOn(localStorage.getItem(TOUR_KEY) === "on");
      setClosed(localStorage.getItem(`${TOUR_KEY}-hidden`));
    } catch {}
    // қойынды ауысқанда (мысалы, ?tab=mine) URL-дің іздеу бөлігі өзгереді
    const tick = () => setSearch(location.search);
    tick();
    const id = setInterval(tick, 600);
    return () => clearInterval(id);
  }, [path]);

  if (me?.role !== "akimat" || !on) return null;
  // нөмірді әр рендерде тікелей оқимыз: шағым жіберілген сәтте сілтеме дайын болсын
  const h = hintFor(path, search, tourCode());
  if (!h) return null;
  const key = `${path}${search.includes("tab=mine") ? "?mine" : ""}`;
  if (closed === key) return null;

  function hide() {
    setClosed(key);
    try {
      localStorage.setItem(`${TOUR_KEY}-hidden`, key);
    } catch {}
  }
  function off() {
    setOn(false);
    try {
      localStorage.setItem(TOUR_KEY, "off");
    } catch {}
  }

  return (
    <aside
      role="note"
      aria-label="Демо нұсқаушы"
      className="no-print fixed inset-x-2 top-2 z-[65] mx-auto max-w-[420px] rounded-[14px] border border-amber-300 bg-amber-50 p-3.5 text-ink shadow-2xl lg:inset-x-auto lg:bottom-20 lg:right-5 lg:top-auto"
    >
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-ink px-1.5 text-[12px] font-bold text-white">{h.step}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[15px] font-extrabold leading-snug">
            <Lightbulb size={16} className="shrink-0 text-amber-600" /> {h.title}
          </div>
          <p className="mt-1 text-[14px] leading-snug text-stone-700">{h.text}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {h.next && (
              <Link href={h.next.href} className="text-[14px] font-bold text-qyzyl hover:underline">
                {`${h.next.label} →`}
              </Link>
            )}
            <button onClick={off} className="text-[12px] text-stone-500 hover:underline">
              Нұсқауды өшіру
            </button>
          </div>
        </div>
        <button onClick={hide} aria-label="Жабу" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-amber-100">
          <X size={16} />
        </button>
      </div>
    </aside>
  );
}
