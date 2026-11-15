"use client";
// Тұрғынға: «Қоқыс көлігі қайда?» — ең жақын көлік қашан көшеңізге жетеді + хабарлама
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellRing, Loader2, MapPin, Radio, Truck } from "lucide-react";
import { getGeoAcc, inCity, reverseGeocode, useFleet } from "@/lib/client";
import type { Vehicle } from "./MapView";
import { activeCity } from "@/lib/city-client";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

// Тұрғын қаладан тыс болса — демо нүкте (Әйтеке би көшесі маңы)
const NOTIFY_MIN = 5;

type Eta = { truckId: string; name: string; etaMin: number; gapM: number; point: { lat: number; lng: number } } | null;

function chime() {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.start(t);
      o.stop(t + 0.32);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch {}
}

export function TruckWhere() {
  const [me, setMe] = useState<{ lat: number; lng: number; demo: boolean } | null>(null);
  const [street, setStreet] = useState<string>("");
  const [eta, setEta] = useState<Eta | undefined>(undefined);
  const [watch, setWatch] = useState(false);
  const [alerted, setAlerted] = useState(false);
  const fleet = useFleet(2000);
  const notified = useRef(false);

  // 1. Орын: GPS, қаладан тыс болса — демо нүкте
  useEffect(() => {
    let off = false;
    getGeoAcc(6000).then((g) => {
      if (off) return;
      const p = g && inCity(g) ? { lat: g.lat, lng: g.lng, demo: false } : { ...activeCity().demoPoint, demo: true };
      setMe(p);
      reverseGeocode(p.lat, p.lng).then((a) => !off && a?.street && setStreet(a.street));
    });
    return () => {
      off = true;
    };
  }, []);

  // 2. ETA: әр 5 секунд
  useEffect(() => {
    if (!me) return;
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/fleet/eta?lat=${me.lat}&lng=${me.lng}`, { cache: "no-store" });
        if (r.ok && !stop) setEta((await r.json()).eta);
      } catch {}
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [me]);

  // 3. Хабарлама: көлік 5 минутқа жақындағанда
  useEffect(() => {
    if (!watch || !eta || notified.current || eta.etaMin > NOTIFY_MIN) return;
    notified.current = true;
    setAlerted(true);
    chime();
    navigator.vibrate?.([200, 100, 200]);
    const ru = document.documentElement.lang === "ru";
    const n = eta.name.replace(/\D/g, "");
    const text = ru ? `Машина №${n} будет на вашей улице через ~${eta.etaMin} мин. Выносите мусор.` : `${eta.name} ~${eta.etaMin} минутта көшеңізде болады. Қоқысты шығарыңыз.`;
    try {
      if ("Notification" in window && Notification.permission === "granted") new Notification(ru ? "TrashSTOP · Мусоровоз подъезжает" : "TrashSTOP · Қоқыс көлігі келе жатыр", { body: text });
    } catch {}
  }, [watch, eta]);

  async function toggleWatch() {
    if (watch) {
      setWatch(false);
      notified.current = false;
      setAlerted(false);
      return;
    }
    try {
      if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    } catch {}
    notified.current = false;
    setAlerted(false);
    setWatch(true);
  }

  const vehicles = useMemo<Vehicle[]>(
    () =>
      (fleet?.trucks ?? []).map((t) => ({
        id: t.id,
        lat: t.lat,
        lng: t.lng,
        kind: "truck",
        collecting: t.state === "collecting",
        busy: false,
        label: t.id === eta?.truckId ? `${t.name.replace(" көлік", "")} · сізге` : t.name.replace(" көлік", ""),
      })),
    [fleet, eta?.truckId],
  );
  const soon = eta && eta.etaMin <= 10;
  const advice = !eta ? "" : soon ? "Қоқысты дәл қазір шығарыңыз" : `Қоқысты ~${eta.etaMin - NOTIFY_MIN} минуттан кейін шығарыңыз`;

  return (
    <div className="space-y-4 px-4 pb-32 pt-2">
      <div>
        <div className="display text-[34px] leading-none">Қоқыс көлігі қайда?</div>
        <p className="mt-2 text-[15px] leading-snug text-stone-600">Қоқысты көлік келгенде ғана шығарыңыз — контейнер толып, көшеде қалмайды.</p>
      </div>

      {/* Негізгі жауап */}
      <div className={`rounded-[10px] p-5 ${soon ? "bg-clean text-white" : "bg-ink text-salt"}`} aria-live="polite">
        {!me || eta === undefined ? (
          <div className="flex items-center gap-3 text-[17px] font-semibold">
            <Loader2 className="animate-spin" /> Орныңыз анықталуда…
          </div>
        ) : !eta ? (
          <div className="text-[18px] font-bold leading-snug">Жақын маңнан бүгін көлік өтпейді. Контейнерге апарыңыз немесе 109-ға хабарласыңыз.</div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[13px] font-semibold opacity-80">
              <Truck size={16} /> {eta.name}
            </div>
            <div className="mt-1 text-[22px] font-bold leading-tight">
              <span className="display text-[64px] leading-none">{`~${eta.etaMin}`}</span> {"минутта сіздің көшеңізде болады"}
            </div>
            <div className={`mt-3 rounded-[8px] px-4 py-3 text-[18px] font-extrabold ${soon ? "bg-white text-clean" : "bg-white/10"}`}>{advice}</div>
          </>
        )}
        {me && (
          <div className="mt-3 flex items-center gap-1.5 text-[13px] opacity-80">
            <MapPin size={14} /> {me.demo ? "Демо орын (қала орталығы)" : street || "Сіздің орныңыз"}
          </div>
        )}
      </div>

      {/* Хабарлама */}
      <button
        onClick={toggleWatch}
        disabled={!eta}
        className={`flex min-h-[64px] w-full items-center justify-center gap-3 rounded-[10px] border-2 px-4 text-[17px] font-bold transition active:scale-[0.98] disabled:opacity-50 ${watch ? "border-clean bg-clean/10 text-clean" : "border-ink bg-white text-ink"}`}
      >
        {watch ? <BellRing size={22} /> : <Bell size={22} />}
        {watch ? (alerted ? "Хабарланды · өшіру" : `Көлік ${NOTIFY_MIN} минутта жеткенде хабарлаймын`) : `${NOTIFY_MIN} минут қалғанда хабарлау`}
      </button>
      {alerted && eta && (
        <div role="alert" className="rounded-[10px] bg-qyzyl p-4 text-[17px] font-bold leading-snug text-white">
          {`🔔 ${eta.name} жақындап қалды — қоқысты шығаратын уақыт!`}
        </div>
      )}

      {/* Карта */}
      <div className="relative h-[340px] overflow-hidden rounded-[10px] border border-line">
        {me && (
          <MapView theme="light" points={[]} pin={me} vehicles={vehicles} focus={{ lat: me.lat, lng: me.lng, zoom: 13.6, key: "me" }} zoom={13.6} controls={false} basemapSwitch={false} />
        )}
      </div>
      <div className="flex items-start gap-2 text-[13px] leading-snug text-stone-500">
        <Radio size={16} className="mt-0.5 shrink-0" />
        <span>{fleet?.live ? "Көліктердің нақты GPS деректері." : "GPS симуляциясы: көліктер нақты көшелермен жүреді. Пилотта мекеменің GPS жүйесіне қосылады."}</span>
      </div>
    </div>
  );
}
