// Қоқыс көліктерінің GPS деректері.
// Провайдер интерфейсі: демода — нақты көшелермен жүретін симуляция (OSRM маршруттары),
// пилотта — мекеменің GPS жүйесі (мыс. Wialon / Omnicomm) API арқылы. Ауыстыру үшін тек провайдер өзгереді.
import ROUTES_KZO from "./truck-routes.json";
import ROUTES_ALA from "./truck-routes-almaty.json";
import { serverCity } from "./city-server";
import type { CityId } from "./cities";
import { distanceM } from "./meta";

export interface Truck {
  id: string;
  name: string; // «№3 көлік»
  brigadeId: string;
  vehicle: string;
  lat: number;
  lng: number;
  heading: number; // градус
  speedKmh: number;
  state: "moving" | "collecting";
  routeKm: number;
  doneKm: number; // бүгін жүрген
  stopsDone: number;
  stopsTotal: number;
  missedStops: number; // маршрутта тоқтамай өтіп кеткен контейнерлер
  updatedAt: number;
}

export interface FleetProvider {
  name: string;
  live: boolean; // нақты GPS па, симуляция ма
  list(now?: number): Promise<Truck[]>;
}

type Route = { coords: [number, number][]; lengthM: number };
// Әр қаланың маршруттары (OpenStreetMap көшелері, OSRM арқылы салынған)
const ROUTES: Record<CityId, Record<string, Route>> = {
  kyzylorda: ROUTES_KZO as unknown as Record<string, Route>,
  almaty: ROUTES_ALA as unknown as Record<string, Route>,
};
function routesOf(): Record<string, Route> {
  return ROUTES[serverCity()];
}

// Көліктердің паспорты (тестілік)
const FLEET = [
  { id: "t1", name: "№1 көлік", brigadeId: "b1", vehicle: "Қоқыс тасушы КамАЗ", v: 19, offset: 0 },
  { id: "t2", name: "№2 көлік", brigadeId: "b2", vehicle: "Қоқыс тасушы КамАЗ", v: 17, offset: 900 },
  { id: "t3", name: "№3 көлік", brigadeId: "b3", vehicle: "Шағын жүк көлігі", v: 21, offset: 1800 },
  { id: "t4", name: "№4 көлік", brigadeId: "b4", vehicle: "Қоқыс тасушы КамАЗ", v: 18, offset: 400 },
  { id: "t5", name: "№5 көлік", brigadeId: "b5", vehicle: "Шағын жүк көлігі", v: 20, offset: 1300 },
  { id: "t6", name: "№6 көлік", brigadeId: "b6", vehicle: "Қоқыс тасушы КамАЗ", v: 18, offset: 2200 },
];

const STOP_EVERY_M = 450; // әр 450 м сайын контейнерде тоқтайды
const STOP_SEC = 35;

/** Маршрут бойындағы қашықтықтарды бір рет есептейміз */
const CUM: Record<string, number[]> = {};
function cum(id: string) {
  const ck = `${serverCity()}:${id}`;
  if (CUM[ck]) return CUM[ck];
  const c = routesOf()[id].coords;
  const out = [0];
  for (let i = 1; i < c.length; i++) out.push(out[i - 1] + distanceM({ lat: c[i - 1][1], lng: c[i - 1][0] }, { lat: c[i][1], lng: c[i][0] }));
  CUM[ck] = out;
  return out;
}

function pointAt(id: string, d: number) {
  const c = routesOf()[id].coords;
  const cs = cum(id);
  const L = cs[cs.length - 1];
  const x = ((d % L) + L) % L;
  let i = 1;
  while (i < cs.length - 1 && cs[i] < x) i++;
  const seg = cs[i] - cs[i - 1] || 1;
  const k = Math.min(1, Math.max(0, (x - cs[i - 1]) / seg));
  const [x0, y0] = c[i - 1];
  const [x1, y1] = c[i];
  const heading = (Math.atan2((x1 - x0) * Math.cos((y0 * Math.PI) / 180), y1 - y0) * 180) / Math.PI;
  return { lng: x0 + (x1 - x0) * k, lat: y0 + (y1 - y0) * k, heading: (heading + 360) % 360 };
}

/** Уақыт бойынша анықталған позиция: барлық сервер даналарында бірдей */
function simulate(f: (typeof FLEET)[number], now: number): Truck {
  const L = cum(f.id)[cum(f.id).length - 1];
  const v = (f.v * 1000) / 3600; // м/с
  const blockT = STOP_EVERY_M / v + STOP_SEC;
  const t = now / 1000 + f.offset;
  const k = Math.floor(t / blockT);
  const tau = t - k * blockT;
  const moving = tau < STOP_EVERY_M / v;
  const d = k * STOP_EVERY_M + (moving ? v * tau : STOP_EVERY_M);
  const p = pointAt(f.id, d);
  // Ауысым: Қызылорда уақытымен (UTC+5) 07:00–19:00. Түнде — кешегі ауысымның қорытындысы.
  const KZ = 5 * 3600e3;
  const local = now + KZ;
  const dayStart = Math.floor(local / 864e5) * 864e5 + 7 * 3600e3;
  const SHIFT = 12 * 3600e3;
  const frac = local < dayStart ? 1 : Math.min(1, (local - dayStart) / SHIFT);
  const stopsTotal = 72 + Number(f.id.slice(1)) * 7;
  const passed = Math.floor(stopsTotal * frac); // маршрут бойынша өткен контейнерлер
  const doneM = passed * STOP_EVERY_M * 1.6; // контейнерлер арасы + полигонға бару
  const dayN = Math.floor(local / 864e5) + Number(f.id.slice(1)) * 3;
  const missedStops = passed > 6 ? [0, 2, 0, 1, 0, 0, 3][dayN % 7] : 0;
  const stopsDone = passed - missedStops; // нақты тоқтап, босатқандары
  return {
    id: f.id,
    name: f.name,
    brigadeId: f.brigadeId,
    vehicle: f.vehicle,
    lat: p.lat,
    lng: p.lng,
    heading: p.heading,
    speedKmh: moving ? f.v : 0,
    state: moving ? "moving" : "collecting",
    routeKm: Math.round((L / 1000) * 10) / 10,
    doneKm: Math.round((doneM / 1000) * 10) / 10,
    stopsDone,
    stopsTotal,
    missedStops,
    updatedAt: now,
  };
}

export const SimulatedProvider: FleetProvider = {
  name: "GPS симуляциясы (OpenStreetMap көшелері)",
  live: false,
  async list(now = Date.now()) {
    return FLEET.filter((f) => routesOf()[f.id]).map((f) => simulate(f, now));
  },
};

/**
 * Нақты GPS (пилот): Wialon Remote API — https://sdk.wialon.com
 * WIALON_TOKEN орнатылса, көліктердің соңғы позициясы core/search_items арқылы алынады.
 * Әзірге қосылмаған — симуляция қолданылады.
 */
export function provider(): FleetProvider {
  return SimulatedProvider;
}

/** Көліктің маршруты бойынша нүктеге дейінгі қашықтық (алға қарай) */
function aheadDistance(f: (typeof FLEET)[number], truckD: number, target: { lat: number; lng: number }) {
  const c = routesOf()[f.id].coords;
  const cs = cum(f.id);
  const L = cs[cs.length - 1];
  let best = { idx: -1, gap: Infinity };
  for (let i = 0; i < c.length; i++) {
    const g = distanceM({ lat: c[i][1], lng: c[i][0] }, target);
    if (g < best.gap) best = { idx: i, gap: g };
  }
  const here = ((truckD % L) + L) % L;
  let ahead = cs[best.idx] - here;
  if (ahead < 0) ahead += L;
  return { ahead, gap: best.gap, point: { lat: c[best.idx][1], lng: c[best.idx][0] } };
}

/** Тұрғынның орнына ең жақын келетін көлік және келу уақыты (минут) */
export function etaFor(target: { lat: number; lng: number }, now = Date.now()) {
  const res = FLEET.filter((f) => routesOf()[f.id]).map((f) => {
    const v = (f.v * 1000) / 3600;
    const blockT = STOP_EVERY_M / v + STOP_SEC;
    const t = now / 1000 + f.offset;
    const k = Math.floor(t / blockT);
    const tau = t - k * blockT;
    const d = k * STOP_EVERY_M + Math.min(v * tau, STOP_EVERY_M);
    const a = aheadDistance(f, d, target);
    const stops = Math.floor(a.ahead / STOP_EVERY_M);
    const etaSec = a.ahead / v + stops * STOP_SEC;
    return { truckId: f.id, name: f.name, etaMin: Math.max(1, Math.round(etaSec / 60)), gapM: Math.round(a.gap), point: a.point };
  });
  // маршруты тұрғыннан 600 м-ден алыс өтетін көліктер есепке алынбайды
  const near = res.filter((r) => r.gapM <= 600).sort((a, b) => a.etaMin - b.etaMin);
  return near[0] ?? null;
}

/** Шағымға ең жақын көліктер (түзу қашықтық + жол коэффициенті) */
export async function nearestTrucks(target: { lat: number; lng: number }, now = Date.now()) {
  const list = await provider().list(now);
  return list
    .map((t) => {
      const dist = Math.round(distanceM(t, target) * 1.35); // көше бойынша шамамен
      const etaMin = Math.max(1, Math.round(dist / ((18 * 1000) / 60)));
      return { ...t, distM: dist, etaMin };
    })
    .sort((a, b) => a.distM - b.distM);
}
