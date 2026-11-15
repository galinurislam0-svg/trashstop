// Іріктеушілер мен қазыларға: демоны тіркелусіз бір басумен бастау
// (демо аккаунттың деректері кіру бетінде онсыз да көрсетілген — бұл жасырын кілт емес).
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
