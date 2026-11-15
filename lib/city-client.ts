// Клиентте: белсенді қала (CityProvider орнатады). Тек оқиға өңдеушілері мен эффектілерде қолданыңыз —
// бет мәтінін көрсету үшін useCityConf() хугын пайдаланыңыз.
import { CITIES, DEFAULT_CITY, cityFromCookieHeader, type CityConf, type CityId } from "./cities";

let active: CityId | null = null;

export function setActiveCity(c: CityId) {
  active = c;
}

export function activeCity(): CityConf {
  if (active) return CITIES[active];
  if (typeof document !== "undefined") return CITIES[cityFromCookieHeader(document.cookie)];
  return CITIES[DEFAULT_CITY];
}
