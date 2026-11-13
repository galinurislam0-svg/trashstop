import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/ratelimit";

// Координатадан нақты мекенжай (OpenStreetMap Nominatim, резерв — Photon). Кэш + секундына 1 сұрау (OSM ережесі).
const cache = new Map<string, Addr>();
let lastCall = 0;
const UA = "TrashSTOP/1.0 (GovTech Hackathon 2026, Kyzylorda)";

type Addr = { address: string; street: string | null; house: string | null; area: string | null; city: string | null; source: string };

/** Орысша көше түрлерін қазақшаға: «Жаркынбаева улица» → «Жаркынбаева көшесі» */
function kzStreet(s: string) {
  return s
    .replace(/^улица\s+(.+)$/i, "$1 көшесі")
    .replace(/\s+улица$/i, " көшесі")
    .replace(/^проспект\s+(.+)$/i, "$1 даңғылы")
    .replace(/\s+проспект$/i, " даңғылы")
    .replace(/^переулок\s+(.+)$/i, "$1 тұйық көшесі")
    .replace(/\s+переулок$/i, " тұйық көшесі")
    .replace(/^микрорайон\s+(.+)$/i, "$1 шағын ауданы")
    .replace(/\s+микрорайон$/i, " шағын ауданы")
    .replace(/^площадь\s+(.+)$/i, "$1 алаңы")
    .replace(/\s+площадь$/i, " алаңы")
    .replace(/^бульвар\s+(.+)$/i, "$1 бульвары")
    .replace(/\s+шоссе$/i, " тас жолы");
}

function compose(street: string | null, house: string | null, area: string | null, city: string | null) {
  const s = street ? kzStreet(street) : null;
  const main = s ? (house ? `${s}, ${house}` : s) : area || city || "Белгісіз орын";
  return { address: main, street: s, house, area, city };
}

async function nominatim(lat: number, lng: number): Promise<Addr | null> {
  const wait = Math.max(0, lastCall + 1100 - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=kk,ru`;
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5000) });
  if (!r.ok) return null;
  const j = await r.json();
  const a = j.address ?? {};
  const street = a.road ?? a.pedestrian ?? a.footway ?? null;
  const area = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.residential ?? null;
  return { ...compose(street, a.house_number ?? null, area, a.city ?? a.town ?? a.village ?? null), source: "OpenStreetMap" };
}

async function photon(lat: number, lng: number): Promise<Addr | null> {
  const r = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5000) });
  if (!r.ok) return null;
  const p = (await r.json()).features?.[0]?.properties;
  if (!p) return null;
  return { ...compose(p.street ?? null, p.housenumber ?? null, p.district ?? null, p.city ?? null), source: "OpenStreetMap" };
}

/** Мекенжайды іздеу (тек Қызылорда шегінде): «Әйтеке би 25» → координата */
const BBOX = { w: 65.4, s: 44.78, e: 65.62, n: 44.92 };
async function search(q: string) {
  const out: { lat: number; lng: number; address: string; area: string | null }[] = [];
  try {
    const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&bbox=${BBOX.w},${BBOX.s},${BBOX.e},${BBOX.n}&limit=6`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(5000),
    });
    if (r.ok)
      for (const f of (await r.json()).features ?? []) {
        const p = f.properties ?? {};
        const [lng, lat] = f.geometry?.coordinates ?? [];
        if (!Number.isFinite(lat) || lat < BBOX.s || lat > BBOX.n || lng < BBOX.w || lng > BBOX.e) continue;
        const c = compose(p.street ?? (p.osm_key === "highway" ? p.name : null), p.housenumber ?? null, p.district ?? null, p.city ?? null);
        const label = p.name && p.osm_key !== "highway" && p.name !== p.street ? `${p.name}${c.street ? `, ${c.address}` : ""}` : c.address;
        out.push({ lat, lng, address: label, area: p.district ?? null });
      }
  } catch {}
  if (!out.length) {
    try {
      const wait = Math.max(0, lastCall + 1100 - Date.now());
      if (wait) await new Promise((r) => setTimeout(r, wait));
      lastCall = Date.now();
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&viewbox=${BBOX.w},${BBOX.n},${BBOX.e},${BBOX.s}&bounded=1&addressdetails=1&limit=6&accept-language=kk,ru`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5000) },
      );
      if (r.ok)
        for (const j of await r.json()) {
          const a = j.address ?? {};
          const c = compose(a.road ?? null, a.house_number ?? null, a.suburb ?? null, a.city ?? null);
          out.push({ lat: Number(j.lat), lng: Number(j.lon), address: c.street ? c.address : String(j.display_name).split(",")[0], area: c.area });
        }
    } catch {}
  }
  // қайталанатын мекенжайларды алып тастаймыз
  return out.filter((x, i) => out.findIndex((y) => y.address === x.address) === i).slice(0, 5);
}

export async function GET(req: Request) {
  if (rateLimited(req, "geo", 40)) return NextResponse.json({ error: "Тым жиі" }, { status: 429 });
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim();
  if (q) {
    if (q.length < 3 || q.length > 80) return NextResponse.json({ results: [] });
    return NextResponse.json({ results: await search(q) }, { headers: { "Cache-Control": "public, max-age=3600" } });
  }
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return NextResponse.json({ error: "Координата қате" }, { status: 400 });
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`; // ~1 м дәлдік
  const hit = cache.get(key);
  if (hit) return NextResponse.json(hit);
  let out: Addr | null = null;
  try {
    out = await nominatim(lat, lng);
  } catch {}
  if (!out) {
    try {
      out = await photon(lat, lng);
    } catch {}
  }
  if (!out) return NextResponse.json({ error: "Мекенжай анықталмады" }, { status: 502 });
  cache.set(key, out);
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  return NextResponse.json(out, { headers: { "Cache-Control": "public, max-age=86400" } });
}
