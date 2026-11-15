// Қалалар: бір платформа — бірнеше қала. Әр қаланың өз картасы, аудандары, деректері және баптаулары бар.
// Бұл файл клиентте де, серверде де қолданылады (тек деректер, тәуелділік жоқ).

export type CityId = "kyzylorda" | "almaty";
export const CITY_IDS: CityId[] = ["kyzylorda", "almaty"];
export const DEFAULT_CITY: CityId = "kyzylorda";
export const CITY_COOKIE = "ts_city";

export interface CityConf {
  id: CityId;
  name: string; // Қызылорда
  nameRu: string; // Кызылорда
  loc: string; // Қызылордада (жатыс септік)
  abl: string; // Қызылордадан (шығыс септік)
  center: [number, number]; // [lng, lat]
  zoom: number;
  bounds: { s: number; w: number; n: number; e: number };
  weather: { lat: number; lng: number };
  demoPoint: { lat: number; lng: number }; // GPS қаладан тыс болса — демо нүкте
  depot: { lat: number; lng: number }; // су тасушы көліктер депосы
  population: string;
  responsible: string;
  plateRegion: string;
  dbId: number; // дерекқордағы күй жолы
  codeBase: number; // шағым нөмірлері осыдан басталады (қалалар арасында қайталанбауы үшін)
  climate: string; // ЖИ-ге: ағаш күйін бағалау үшін
}

export const CITIES: Record<CityId, CityConf> = {
  kyzylorda: {
    id: "kyzylorda",
    name: "Қызылорда",
    nameRu: "Кызылорда",
    loc: "Қызылордада",
    abl: "Қызылордадан",
    center: [65.5092, 44.8488],
    zoom: 13.2,
    bounds: { s: 44.78, w: 65.4, n: 44.92, e: 65.62 },
    weather: { lat: 44.85, lng: 65.51 },
    demoPoint: { lat: 44.8487, lng: 65.5023 },
    depot: { lat: 44.852, lng: 65.512 },
    population: "~250 мың",
    responsible: "Қызылорда қаласының тазалық қызметі",
    plateRegion: "11",
    dbId: 1,
    codeBase: 1000,
    climate: "Қызылорда — шөлейт аймақ: жазы өте ыстық (+40°), қысы суық, жауын-шашын аз, топырағы тұзды. Ағаштар: қарағаш, тал, үйеңкі, шаған, ақ акация, гледичия, айлант, терек.",
  },
  almaty: {
    id: "almaty",
    name: "Алматы",
    nameRu: "Алматы",
    loc: "Алматыда",
    abl: "Алматыдан",
    center: [76.915, 43.248],
    zoom: 12.1,
    bounds: { s: 43.13, w: 76.7, n: 43.4, e: 77.12 },
    weather: { lat: 43.24, lng: 76.93 },
    demoPoint: { lat: 43.2604, lng: 76.9452 },
    depot: { lat: 43.26, lng: 76.9 },
    population: "2,37 млн",
    responsible: "Алматы қаласының тазалық қызметі",
    plateRegion: "02",
    dbId: 2,
    codeBase: 5000,
    climate: "Алматы — Іле Алатауының бөктеріндегі мегаполис: жазы ыстық, қысы суық әрі қарлы, қыста ауасы ластанады (смог). Ағаштар: қарағаш, терек, үйеңкі, жаңғақ, қайың, емен, шырша, қарағай.",
  },
};

export function isCity(v: unknown): v is CityId {
  return typeof v === "string" && (CITY_IDS as string[]).includes(v);
}

/** Cookie жолынан қаланы оқу: «a=1; ts_city=almaty» → almaty */
export function cityFromCookieHeader(header: string | null | undefined): CityId {
  const m = /(?:^|;\s*)ts_city=([a-z]+)/.exec(header ?? "");
  return m && isCity(m[1]) ? m[1] : DEFAULT_CITY;
}

export function inBounds(c: CityConf, p: { lat: number; lng: number } | null | undefined) {
  return !!p && p.lat > c.bounds.s && p.lat < c.bounds.n && p.lng > c.bounds.w && p.lng < c.bounds.e;
}
