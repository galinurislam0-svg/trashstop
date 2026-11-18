// Іріктеушілер мен қазыларға: демоны тіркелусіз бір басумен бастау
// (демо аккаунттың деректері кіру бетінде онсыз да көрсетілген — бұл жасырын кілт емес).
import { DEMO_CLEAN } from "./demo-photos";

export const TOUR_KEY = "ts-tour";

export async function startDemo(next = "/citizen") {
  try {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: "akimat", password: "akimat2026" }),
    });
    if (!r.ok) throw new Error();
    try {
      localStorage.setItem(TOUR_KEY, "on");
      localStorage.removeItem(`${TOUR_KEY}-hidden`);
    } catch {}
    location.href = next;
  } catch {
    location.href = "/login";
  }
}

/** Демо фото: сайттағы ашық лицензиялы суретті File ретінде аламыз (фотосы жоқ адам да байқай алады) */
export async function demoFile(src: string, name = "demo.jpg"): Promise<File> {
  const blob = await (await fetch(src)).blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

/** Демо фотомен жіберілген шағым: кейін тазалықшы демо «кейін» фотосын дұрыс таңдауы үшін */
export function rememberDemoSrc(code: string, src: string) {
  try {
    localStorage.setItem(`ts-demo-src-${code}`, src);
  } catch {}
}
/** Осы шағымға сәйкес демо «кейін» фотосы (болмаса — null, демо батырмасы көрсетілмейді) */
export function demoAfterFor(r: { code: string; photo: string | null }): string | null {
  let src = r.photo && r.photo.startsWith("/demo/") ? r.photo : null;
  if (!src) {
    try {
      src = localStorage.getItem(`ts-demo-src-${r.code}`);
    } catch {}
  }
  return (src && DEMO_CLEAN[src]) || null;
}

/** Демо нұсқаушы: соңғы жіберілген шағым нөмірі (келесі қадамдар соны тікелей ашады) */
export function rememberTourCode(code: string) {
  try {
    localStorage.setItem(`${TOUR_KEY}-code`, code);
  } catch {}
  window.dispatchEvent(new Event("ts-tour-code"));
}
export function tourCode(): string | null {
  try {
    return localStorage.getItem(`${TOUR_KEY}-code`);
  } catch {
    return null;
  }
}
/** URL-дегі ?open=TS-1101 → шағымның id-і (бір рет) */
export function openParam(): string | null {
  if (typeof location === "undefined") return null;
  return new URLSearchParams(location.search).get("open");
}
