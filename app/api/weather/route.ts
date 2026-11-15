import { NextResponse } from "next/server";
import { serverCityConf, withCity } from "@/lib/city-server";

// Таңдалған қаланың нақты ауа райы болжамы (Open-Meteo, кілтсіз). Интернет болмаса — тестілік болжам.
async function GET_() {
  try {
    const w = serverCityConf().weather;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&current=temperature_2m,wind_speed_10m&timezone=Asia%2FAlmaty&forecast_days=7`;
    const res = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    const days = (j.daily.time as string[]).map((d, i) => ({
      date: d,
      tmax: j.daily.temperature_2m_max[i] as number,
      tmin: j.daily.temperature_2m_min[i] as number,
      rain: j.daily.precipitation_sum[i] as number,
      wind: j.daily.wind_speed_10m_max[i] as number,
    }));
    return NextResponse.json({ live: true, current: j.current?.temperature_2m ?? days[0].tmax, days });
  } catch {
    const base = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base.getTime() + i * 864e5);
      return { date: d.toISOString().slice(0, 10), tmax: 9 + (i % 3) * 2, tmin: -2 + (i % 2), rain: i === 4 ? 2.1 : 0, wind: 14 + i };
    });
    return NextResponse.json({ live: false, current: 8, days });
  }
}

export const GET = withCity(GET_);
