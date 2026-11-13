"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CityState } from "./types";
import type { Truck } from "./fleet";

export type ClientState = CityState & { ai: boolean };

/** Қала күйін 3 секунд сайын жаңартып отырады — барлық экран «тірі» */
export function useCity(intervalMs = 3000) {
  const [state, setState] = useState<ClientState | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (res.ok) setState(await res.json());
    } catch {
      /* желі үзілсе — келесі жолы */
    }
  }, []);
  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, intervalMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh, intervalMs]);
  return { state, refresh };
}

/** Қоқыс көліктерінің GPS позициялары (әр 2 секунд) */
export function useFleet(intervalMs = 2000, enabled = true) {
  const [fleet, setFleet] = useState<{ source: string; live: boolean; trucks: Truck[] } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/fleet", { cache: "no-store" });
        if (r.ok && !stop) setFleet(await r.json());
      } catch {}
    };
    load();
    const id = setInterval(load, intervalMs);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [intervalMs, enabled]);
  return fleet;
}

/**
 * Телефонда панель тақырыптың дәл астынан басталуы үшін: тақырыптың төменгі шетін өлшейміз.
 * Панельде CSS zoom (A+/A++) болса, top мәні де үлкейеді — сондықтан zoom-ға бөлеміз.
 */
export function useHeaderBottom(ref: React.RefObject<HTMLElement | null>) {
  const [top, setTop] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const calc = () => {
      const zoom = parseFloat(getComputedStyle(el).zoom || "1") || 1;
      setTop(Math.round((el.getBoundingClientRect().bottom + 8) / zoom));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    addEventListener("resize", calc);
    return () => {
      ro.disconnect();
      removeEventListener("resize", calc);
    };
  }, [ref]);
  return top;
}

export async function post<T = unknown>(url: string, body: unknown): Promise<T> {
  const lang = typeof document !== "undefined" && document.documentElement.lang === "ru" ? "ru" : "kk";
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-lang": lang }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j as { error?: string }).error || "Қате");
  return j as T;
}

/** Фотоны 1024 px-ке дейін кішірейтіп, JPEG dataURL қайтарады */
export function compressImage(file: File, max = 1024, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Сурет оқылмады"));
    img.src = url;
  });
}

export function getGeo(timeout = 6000): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 30000 },
    );
  });
}

const STREETS = ["Әйтеке би к-сі", "Жібек жолы к-сі", "Абай даңғылы", "Қорқыт Ата к-сі", "Тоқмағамбетов к-сі", "Желтоқсан к-сі", "Қайнарбаев к-сі"];
/** Жуық мекенжай (сыртқы сервиске координата жібермей) */
export function approxAddress(lat: number, lng: number) {
  const i = Math.abs(Math.floor(lat * 1000 + lng * 1000)) % STREETS.length;
  return `${STREETS[i]} маңы`;
}

/** Қызылорда шегінде бе? Болмаса — демо нүкте (қала орталығы маңы) */
export function inCity(p: { lat: number; lng: number } | null) {
  return !!p && p.lat > 44.78 && p.lat < 44.92 && p.lng > 65.4 && p.lng < 65.62;
}

/** GPS дәлдігімен бірге (метр) */
export function getGeoAcc(timeout = 8000): Promise<{ lat: number; lng: number; acc: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 15000 },
    );
  });
}

export type GeoFix = { lat: number; lng: number; acc: number } | { error: "denied" | "unavailable" | "timeout" | "unsupported" };
/**
 * Ең дәл орын: бірнеше секунд бойы GPS-ті тыңдап, дәлдігі ең жақсы нүктені аламыз
 * (бірінші нүкте көбіне Wi-Fi/ұялы мұнара бойынша өрескел болады). ±25 м-ге жетсе — бірден тоқтаймыз.
 */
export function getBestGeo(maxMs = 7000): Promise<GeoFix> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ error: "unsupported" });
    let best: { lat: number; lng: number; acc: number } | null = null;
    let done = false;
    const finish = (r: GeoFix) => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(id);
      clearTimeout(t);
      resolve(r);
    };
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const acc = Math.round(p.coords.accuracy);
        if (!best || acc < best.acc) best = { lat: p.coords.latitude, lng: p.coords.longitude, acc };
        if (acc <= 25) finish(best);
      },
      (e) => finish(best ?? { error: e.code === 1 ? "denied" : e.code === 3 ? "timeout" : "unavailable" }),
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxMs },
    );
    const t = setTimeout(() => finish(best ?? { error: "timeout" }), maxMs);
  });
}

export async function searchAddress(q: string): Promise<{ lat: number; lng: number; address: string; area: string | null }[]> {
  try {
    const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    return r.ok ? (await r.json()).results ?? [] : [];
  } catch {
    return [];
  }
}

/** Фотоның EXIF ішінен GPS координатасын оқу (камера жазған болса). Кітапханасыз, тек JPEG. */
export async function readExifGps(file: File): Promise<{ lat: number; lng: number } | null> {
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xffd8) return null;
    let off = 2;
    while (off < v.byteLength - 4) {
      const marker = v.getUint16(off);
      const size = v.getUint16(off + 2);
      if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) {
        const tiff = off + 10;
        const le = v.getUint16(tiff) === 0x4949;
        const u16 = (o: number) => v.getUint16(o, le);
        const u32 = (o: number) => v.getUint32(o, le);
        const ifd0 = tiff + u32(tiff + 4);
        let gpsPtr = 0;
        for (let i = 0; i < u16(ifd0); i++) {
          const e = ifd0 + 2 + i * 12;
          if (u16(e) === 0x8825) gpsPtr = tiff + u32(e + 8);
        }
        if (!gpsPtr) return null;
        const tags: Record<number, number[] | string> = {};
        for (let i = 0; i < u16(gpsPtr); i++) {
          const e = gpsPtr + 2 + i * 12;
          const tag = u16(e);
          const type = u16(e + 2);
          if (type === 2) tags[tag] = String.fromCharCode(v.getUint8(e + 8));
          if (type === 5) {
            const p = tiff + u32(e + 8);
            tags[tag] = [0, 1, 2].map((k) => u32(p + k * 8) / (u32(p + k * 8 + 4) || 1));
          }
        }
        const dms = (a: number[] | string | undefined) => (Array.isArray(a) ? a[0] + a[1] / 60 + a[2] / 3600 : NaN);
        let lat = dms(tags[2]);
        let lng = dms(tags[4]);
        if (tags[1] === "S") lat = -lat;
        if (tags[3] === "W") lng = -lng;
        return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : null;
      }
      if ((marker & 0xff00) !== 0xff00) break;
      off += 2 + size;
    }
  } catch {}
  return null;
}

export type GeoAddress = { address: string; street: string | null; house: string | null; area: string | null; city: string | null; source: string };
export async function reverseGeocode(lat: number, lng: number): Promise<GeoAddress | null> {
  try {
    const r = await fetch(`/api/geocode?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}
