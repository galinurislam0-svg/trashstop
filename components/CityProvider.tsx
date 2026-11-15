"use client";
// Таңдалған қала: сервер cookie-ден оқып береді, сондықтан алғашқы кадрда да дұрыс қала көрінеді.
import { createContext, useContext } from "react";
import { CITIES, CITY_COOKIE, DEFAULT_CITY, type CityConf, type CityId } from "@/lib/cities";
import { setActiveCity } from "@/lib/city-client";

const Ctx = createContext<CityId>(DEFAULT_CITY);

export function CityProvider({ city, children }: { city: CityId; children: React.ReactNode }) {
  setActiveCity(city); // оқиға өңдеушілері мен эффектілер үшін (клиентте)
  return <Ctx.Provider value={city}>{children}</Ctx.Provider>;
}

export function useCityConf(): CityConf {
  return CITIES[useContext(Ctx)];
}

/** Қаланы ауыстыру: cookie жазып, бетті қайта жүктейміз (карта, деректер, мәтіндер — бәрі жаңа қалаға) */
export function switchCity(id: CityId) {
  document.cookie = `${CITY_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
  location.reload();
}
