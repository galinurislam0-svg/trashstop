"use client";
// Қала ауыстырғышы: бір платформа — бірнеше қала. Таңдау cookie-де сақталады, бет қайта жүктеледі.
import { MapPin } from "lucide-react";
import { CITIES, CITY_IDS, type CityId } from "@/lib/cities";
import { switchCity, useCityConf } from "./CityProvider";

const SHORT: Record<CityId, string> = { kyzylorda: "ҚЗО", almaty: "АЛМ" };
const SHORT_RU: Record<CityId, string> = { kyzylorda: "КЗО", almaty: "АЛМ" };

export function CitySwitch({ variant = "light", ru = false, compact = false }: { variant?: "strip" | "light" | "dark" | "rail"; ru?: boolean; compact?: boolean }) {
  const city = useCityConf();

  if (variant === "rail") {
    // Тар бүйір мәзір: басқа қалаға бір басумен
    const next = CITY_IDS[(CITY_IDS.indexOf(city.id) + 1) % CITY_IDS.length];
    return (
      <button
        type="button"
        onClick={() => switchCity(next)}
        title={`Қала: ${city.name}. Ауыстыру: ${CITIES[next].name}`}
        aria-label={`Қала: ${city.name}. ${CITIES[next].name} қаласына ауысу`}
        className="flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-[4px] bg-white/5 text-salt transition hover:bg-white/10"
      >
        <MapPin size={16} className="text-qyzyl" />
        <span className="text-[9px] font-bold leading-none">{SHORT[city.id]}</span>
      </button>
    );
  }

  if (compact) {
    // Тар экран: көзге тек «АЛМ», ал басқанда — толық атаулар (жасырын select үстінде тұрады)
    const tc = variant === "strip" ? "h-10 border-white/20 bg-white/5 text-salt" : "h-10 border-black/10 bg-white text-ink shadow-sm";
    return (
      <label className={`relative inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 text-[12px] font-bold ${tc}`} title={ru ? "Выбор города" : "Қаланы таңдау"}>
        <MapPin size={14} className="shrink-0 text-qyzyl" aria-hidden />
        <span aria-hidden>{ru ? SHORT_RU[city.id] : SHORT[city.id]}</span>
        <select
          value={city.id}
          onChange={(e) => switchCity(e.target.value as CityId)}
          aria-label={ru ? "Выбор города" : "Қаланы таңдау"}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          {CITY_IDS.map((id) => (
            <option key={id} value={id}>
              {ru ? CITIES[id].nameRu : CITIES[id].name}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const tone =
    variant === "strip"
      ? "h-10 border-white/20 bg-white/5 text-salt sm:h-7"
      : variant === "dark"
        ? "h-10 border-white/15 bg-white/5 text-salt"
        : "h-10 border-black/10 bg-white text-ink shadow-sm";
  return (
    <label className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-full border pl-2.5 pr-1 font-bold ${tone}`} title={ru ? "Выбор города" : "Қаланы таңдау"}>
      <MapPin size={14} className="shrink-0 text-qyzyl" aria-hidden />
      <span className="sr-only">{ru ? "Город" : "Қала"}</span>
      <select
        value={city.id}
        onChange={(e) => switchCity(e.target.value as CityId)}
        aria-label={ru ? "Выбор города" : "Қаланы таңдау"}
        className="cursor-pointer appearance-none bg-transparent pr-5 text-[13px] font-bold outline-none"
        style={{ backgroundImage: "none" }}
      >
        {CITY_IDS.map((id) => (
          <option key={id} value={id} className="text-ink">
            {ru ? CITIES[id].nameRu : CITIES[id].name}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 text-[10px] opacity-60" aria-hidden>
        ▼
      </span>
    </label>
  );
}
