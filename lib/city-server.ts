// Серверде: әр сұрау қай қалаға тиесілі екенін AsyncLocalStorage арқылы сақтаймыз.
// Қатар келген сұраулар (бір серверде) бір-бірінің қаласын шатастырмайды.
import { AsyncLocalStorage } from "node:async_hooks";
import { CITIES, DEFAULT_CITY, cityFromCookieHeader, isCity, type CityId } from "./cities";

const als = new AsyncLocalStorage<CityId>();

export function serverCity(): CityId {
  return als.getStore() ?? DEFAULT_CITY;
}
export function serverCityConf() {
  return CITIES[serverCity()];
}

/** Сұраудан қала: ?city= параметрі, болмаса cookie */
export function cityOfRequest(req: Request): CityId {
  try {
    const q = new URL(req.url).searchParams.get("city");
    if (isCity(q)) return q;
  } catch {}
  return cityFromCookieHeader(req.headers.get("cookie"));
}

export function runInCity<T>(city: CityId, fn: () => T): T {
  return als.run(city, fn);
}

/**
 * API өңдеушісін қала контекстіне орау.
 * fixed берілсе — сұраудағы қалаға қарамай сол қала (мысалы, аккаунттар әрқашан бір жерде сақталады).
 */
export function withCity<A extends unknown[], R>(fn: (req: Request, ...rest: A) => R, fixed?: CityId) {
  return (req: Request, ...rest: A): R => als.run(fixed ?? cityOfRequest(req), () => fn(req, ...rest));
}
