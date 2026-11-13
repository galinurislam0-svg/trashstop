import type { Category, Source, Status, TreeHealth } from "./types";

export const CITY_CENTER: [number, number] = [65.5092, 44.8488]; // [lng, lat] Қызылорда

export const CATEGORY: Record<Category, { label: string; short: string; color: string; emoji: string; slaHours: number }> = {
  household: { label: "Тұрмыстық қоқыс", short: "Тұрмыстық", color: "#F59E0B", emoji: "🗑️", slaHours: 24 },
  bulky: { label: "Ірі көлемді қоқыс", short: "Ірі көлемді", color: "#A855F7", emoji: "🛋️", slaHours: 48 },
  construction: { label: "Құрылыс қалдығы", short: "Құрылыс", color: "#F97316", emoji: "🧱", slaHours: 72 },
  container: { label: "Толған контейнер", short: "Контейнер", color: "#38BDF8", emoji: "🚮", slaHours: 12 },
  car: { label: "Көліктен тасталған", short: "Көліктен", color: "#F43F5E", emoji: "🚗", slaHours: 24 },
  tree: { label: "Ағаш / жасыл аймақ", short: "Жасыл аймақ", color: "#22C55E", emoji: "🌳", slaHours: 72 },
  burning: { label: "Қоқыс / шөп өртеу, түтін", short: "Өртеу, түтін", color: "#64748B", emoji: "🔥", slaHours: 2 },
};

export const STATUS: Record<Status, { label: string; color: string; bg: string }> = {
  new: { label: "Жаңа", color: "#F87171", bg: "rgba(248,113,113,.14)" },
  assigned: { label: "Тағайындалды", color: "#FBBF24", bg: "rgba(251,191,36,.14)" },
  in_progress: { label: "Орындалуда", color: "#60A5FA", bg: "rgba(96,165,250,.14)" },
  done: { label: "Орындалды", color: "#34D399", bg: "rgba(52,211,153,.14)" },
  rejected: { label: "Қабылданбады", color: "#94A3B8", bg: "rgba(148,163,184,.14)" },
};

export const SOURCE: Record<Source, string> = {
  app: "TrashSTOP",
  egov: "eGov «Таза Қазақстан»",
  bot: "TazaQazBot",
  "109": "109 орталығы",
  ai: "ЖИ анықтады",
  plan: "Жоспарлы күтім (көгалдандыру маманы)",
};

/** Жасыл қор: күтім тапсырмаларының түрлері */
export const CARE_KINDS = {
  water: { label: "Суару", emoji: "💧" },
  prune: { label: "Санитарлық кесу", emoji: "✂️" },
  clean: { label: "Аумақты тазалау", emoji: "🧹" },
  replant: { label: "Қайта отырғызу", emoji: "🌱" },
  treat: { label: "Зиянкестен өңдеу", emoji: "🧪" },
} as const;
export type CareKind = keyof typeof CARE_KINDS;

export const HEALTH: Record<TreeHealth, { label: string; color: string }> = {
  good: { label: "Сау", color: "#22C55E" },
  weak: { label: "Әлсіз", color: "#EAB308" },
  dry: { label: "Қураған", color: "#EF4444" },
};

export const VOLUME = { small: "Аз", medium: "Орташа", large: "Көп" } as const;
export const HAZARD = { low: "Төмен", medium: "Орташа", high: "Жоғары" } as const;

/** ҚР ӘҚБтК — абаттандыру қағидаларын бұзу. Нақты тармақ пен айыппұл мөлшерін adilet.zan.kz-тен тексеру керек. */
export const LAW_REF = "ҚР ӘҚБтК 505-бабы (абаттандыру қағидаларын бұзу)";

export function isOverdue(r: { status: Status; deadline: number | null }, now: number) {
  return r.deadline !== null && r.status !== "done" && r.status !== "rejected" && now > r.deadline;
}

export function timeAgo(ts: number, now = Date.now()) {
  const m = Math.max(0, Math.round((now - ts) / 60000));
  if (m < 1) return "қазір ғана";
  if (m < 60) return `${m} мин бұрын`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} сағ бұрын`;
  return `${Math.round(h / 24)} күн бұрын`;
}

export function timeLeft(deadline: number, now = Date.now()) {
  const m = Math.round((deadline - now) / 60000);
  const abs = Math.abs(m);
  const txt = abs < 60 ? `${abs} мин` : abs < 1440 ? `${Math.round(abs / 60)} сағ` : `${Math.round(abs / 1440)} күн`;
  return m >= 0 ? `${txt} қалды` : `${txt} кешікті`;
}

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function fmtTime(ts: number) {
  return new Date(ts).toLocaleString("kk-KZ", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

const WD = ["Жс", "Дс", "Сс", "Ср", "Бс", "Жм", "Сн"];
/** Апта күнінің қазақша қысқартуы (браузерде kk локалі болмаса да) */
export function kzWeekday(d: Date | string) {
  return WD[new Date(d).getDay()];
}

// ── eOtinish логикасындағы өтініш кезеңдері ──
export const APPEAL_STEPS = [
  { key: "registered", label: "Тіркелді", hint: "Өтініш нөмір алып, жүйеге түсті" },
  { key: "assigned", label: "Орындаушыға жіберілді", hint: "Жауапты бригада тағайындалды" },
  { key: "in_progress", label: "Орындалуда", hint: "Бригада орынға шықты" },
  { key: "done", label: "Орындалды", hint: "Фото мен геоорын арқылы расталды" },
  { key: "rated", label: "Бағаланды", hint: "Өтініш беруші нәтижені бағалады" },
] as const;

/** Өтініштің қазіргі кезеңі: 0..4 */
export function appealStage(r: { status: string; rating?: number | null; rated?: boolean }) {
  if (r.status === "done") return r.rating || r.rated ? 4 : 3;
  if (r.status === "in_progress") return 2;
  if (r.status === "assigned") return 1;
  return 0;
}

export const RESPONSIBLE = "Қызылорда қаласының тазалық қызметі";
export const LEGAL_TERM = "Заң бойынша жауап беру мерзімі — 15 жұмыс күніне дейін. TrashSTOP ішкі мерзімі әлдеқайда қысқа.";
