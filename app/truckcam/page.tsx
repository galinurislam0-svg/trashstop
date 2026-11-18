"use client";
// 🚛 Көлік — қала сканері: қоқыс көлігіндегі камера (жүргізушінің телефоны) көшені түсіреді,
// ЖИ қоқысты тапса — GPS орны бойынша шағымды өзі ашады. Ешкім шағымданбаса да қала күн сайын тексеріледі.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, ImagePlus, Loader2, Radio, ScanSearch, TriangleAlert, VideoOff } from "lucide-react";
import { Rail } from "@/components/Rail";
import { Logo } from "@/components/Logo";
import { TestDataBadge } from "@/components/ui";
import { post, reverseGeocode, useFleet } from "@/lib/client";
import { CATEGORY } from "@/lib/meta";
import type { AiResult } from "@/lib/types";
import type { Vehicle } from "@/components/MapView";

import MapView from "@/components/LazyMap";

type Scan = {
  id: number;
  at: number;
  thumb: string;
  kind: "found" | "merged" | "clean" | "unsure" | "noai" | "error";
  text: string;
  code?: string;
  emoji?: string;
};

/** Кадрды 1024 px-ке дейін кішірейтіп, JPEG ретінде аламыз */
function toJpeg(src: HTMLVideoElement | HTMLImageElement, w: number, h: number) {
  const k = Math.min(1, 1024 / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}
function fileToJpeg(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      res(toJpeg(img, img.naturalWidth, img.naturalHeight));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => rej(new Error("Суретті оқу мүмкін болмады"));
    img.src = URL.createObjectURL(f);
  });
}

export default function TruckCamPage() {
  const fleet = useFleet(2000);
  const [truckId, setTruckId] = useState("t2");
  const [cam, setCam] = useState<"off" | "starting" | "on" | "denied">("off");
  const [busy, setBusy] = useState(false);
  const [scans, setScans] = useState<Scan[]>([]);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const truck = fleet?.trucks.find((t) => t.id === truckId) ?? fleet?.trucks[0] ?? null;
  const vehicles = useMemo<Vehicle[]>(
    () => (truck ? [{ id: truck.id, lat: truck.lat, lng: truck.lng, kind: "truck", collecting: truck.state === "collecting", busy: false, label: truck.name.replace(" көлік", "") }] : []),
    [truck],
  );

  async function startCam() {
    setCam("starting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
      stream.current = s;
      setCam("on");
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => {});
        }
      });
    } catch {
      setCam("denied");
    }
  }
  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  /** Бір кадрды тексеру: ЖИ → қоқыс болса, көліктің GPS орны бойынша шағым ашылады */
  async function check(photo: string) {
    if (!truck || busy) return;
    setBusy(true);
    const id = ++seq.current;
    const add = (s: Omit<Scan, "id" | "at" | "thumb">) => setScans((l) => [{ id, at: Date.now(), thumb: photo, ...s }, ...l].slice(0, 12));
    try {
      const pos = { lat: truck.lat, lng: truck.lng }; // кадр түсірілген сәттегі GPS
      const ai = await post<AiResult & { is_trash: boolean }>("/api/ai/analyze", { photo });
      if (ai.demo) return add({ kind: "noai", text: "ЖИ қазір қолжетімсіз — кадр тексерілмеді, шағым ашылмады" });
      if (!ai.is_trash || ai.needsRetake) return add({ kind: "clean", text: "Қоқыс жоқ — шағым ашылмады" });
      if (ai.confidence < 0.6) return add({ kind: "unsure", text: `ЖИ сенімсіз (${Math.round(ai.confidence * 100)}%) — шағым ашылмады` });
      const addr = await reverseGeocode(pos.lat, pos.lng);
      const r = await post<{ code: string; mergedInto: string | null }>("/api/reports", {
        lat: pos.lat,
        lng: pos.lng,
        address: addr?.address,
        description: `${ai.summary} (${truck.name} камерасы)`,
        category: ai.category,
        photo,
        source: "ai",
        ai: { category: ai.category, volume: ai.volume, hazard: ai.hazard, confidence: ai.confidence, summary: ai.summary, items: ai.items, volumeM3: ai.volumeM3, reason: ai.reason },
      });
      const c = CATEGORY[ai.category];
      if (r.mergedInto) add({ kind: "merged", code: r.mergedInto, emoji: c.emoji, text: `${c.short}: бұл жер бұрын тіркелген — ${r.mergedInto} шағымына біріктірілді` });
      else add({ kind: "found", code: r.code, emoji: c.emoji, text: `${c.short}: ${ai.summary}` });
    } catch (e) {
      add({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function shoot() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    check(toJpeg(v, v.videoWidth, v.videoHeight));
  }
  async function onFile(f?: File) {
    if (!f) return;
    try {
      await check(await fileToJpeg(f));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const found = scans.filter((s) => s.kind === "found").length;

  return (
    <>
      <Rail />
      <main id="main" className="a11y-zoom min-h-dvh bg-ink text-stone-200 lg:ml-[68px]">
        <h1 className="sr-only">Көлік камерасы: ЖИ көшедегі қоқысты өзі табады</h1>
        <div className="mx-auto max-w-5xl px-4 pb-[170px] pt-5 lg:pb-10">
          <header className="flex flex-wrap items-center gap-3">
            <Logo sub="Көлік камерасы · ЖИ сканер" />
            <span className="ml-auto">
              <TestDataBadge />
            </span>
          </header>

          <div className="mt-4 rounded-[6px] border border-clean/40 bg-clean/10 p-4 text-[15px] leading-snug text-stone-100">
            <b>Көлік — қала сканері.</b> Қоқыс көлігі күн сайын бүкіл қаланы аралайды. Камера көшені түсіреді, ЖИ қоқыс үйіндісін тапса — GPS орны бойынша шағымды өзі ашады. Ешкім шағымданбаса да, қоқыс табылады.
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
            <section className="min-w-0">
              {/* Көлікті таңдау */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="Көлік">
                {(fleet?.trucks ?? []).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTruckId(t.id)}
                    aria-pressed={truck?.id === t.id}
                    className={`min-h-[44px] shrink-0 rounded-[4px] px-3.5 text-[14px] font-bold transition ${truck?.id === t.id ? "bg-salt text-ink" : "bg-white/5 text-stone-300 hover:bg-white/10"}`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>

              {/* Камера */}
              <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-[6px] border border-line-d bg-black">
                {cam === "on" ? (
                  <video ref={video} playsInline muted className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                    {cam === "denied" ? <VideoOff size={40} className="text-stone-500" /> : <Camera size={40} className="text-stone-500" />}
                    <div className="max-w-xs text-[15px] text-stone-400">
                      {cam === "denied" ? "Камераға рұқсат берілмеді. Төмендегі «Фото жүктеу» арқылы кадр жіберуге болады." : "Камераны қосыңыз немесе дайын кадрды жүктеңіз."}
                    </div>
                    {cam !== "denied" && (
                      <button onClick={startCam} disabled={cam === "starting"} className="flex min-h-[48px] items-center gap-2 rounded-[4px] bg-white px-5 text-[15px] font-bold text-ink disabled:opacity-60">
                        {cam === "starting" ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />} Камераны қосу
                      </button>
                    )}
                  </div>
                )}
                {truck && (
                  <div className="mono absolute left-2 top-2 rounded bg-black/65 px-2 py-1 text-[11px] text-salt backdrop-blur">
                    {`● ${truck.name} · ${truck.lat.toFixed(5)}, ${truck.lng.toFixed(5)}`}
                  </div>
                )}
                {busy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-sm">
                    <div className="flex items-center gap-2 rounded-[4px] bg-ink px-4 py-3 text-[15px] font-semibold text-salt">
                      <Loader2 size={18} className="animate-spin" /> ЖИ кадрды тексеруде…
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={shoot}
                  disabled={cam !== "on" || busy || !truck}
                  className="flex min-h-[60px] items-center justify-center gap-2 rounded-[6px] bg-qyzyl px-2 text-[16px] font-extrabold leading-tight text-white transition active:scale-[0.98] disabled:opacity-40"
                >
                  <ScanSearch size={22} /> Кадрды тексеру
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={busy || !truck}
                  className="flex min-h-[60px] items-center justify-center gap-2 rounded-[6px] border-2 border-white/20 px-2 text-[16px] font-bold leading-tight text-salt transition hover:bg-white/5 active:scale-[0.98] disabled:opacity-40"
                >
                  <ImagePlus size={22} /> Фото жүктеу
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              </div>
              <p className="mt-2 flex items-start gap-2 text-[12px] leading-snug text-stone-500">
                <Radio size={14} className="mt-0.5 shrink-0" />
                <span>Демода кадр батырмамен жіберіледі, орын — GPS симуляциясы. Пилотта көлікке бекітілген телефон кадрды автоматты түрде жібереді, орын мекеменің GPS жүйесінен алынады.</span>
              </p>
            </section>

            <aside className="min-w-0 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="glass rounded-[6px] p-3">
                  <div className="text-2xl font-extrabold tabular-nums text-white">{scans.length}</div>
                  <div className="text-[11px] text-stone-400">Кадр тексерілді</div>
                </div>
                <div className="glass rounded-[6px] p-3">
                  <div className="text-2xl font-extrabold tabular-nums text-[#6fd39c]">{found}</div>
                  <div className="text-[11px] text-stone-400">Шағым өзі ашылды</div>
                </div>
              </div>
              <div className="h-44 overflow-hidden rounded-[6px] border border-line-d">
                {truck && <MapView points={[]} vehicles={vehicles} focus={{ lat: truck.lat, lng: truck.lng, zoom: 15, key: truck.id }} zoom={15} controls={false} basemapSwitch={false} interactive={false} />}
              </div>

              <div className="glass rounded-[6px] p-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Соңғы кадрлар</div>
                {scans.length === 0 && <div className="mt-2 text-[13px] text-stone-500">Әзірге кадр жоқ.</div>}
                <ul className="mt-2 space-y-2" aria-live="polite">
                  {scans.map((s) => (
                    <li key={s.id} className="flex gap-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.thumb} alt="" className="h-12 w-12 shrink-0 rounded-[4px] object-cover" />
                      <div className="min-w-0 text-[13px] leading-snug">
                        <div className={`flex items-center gap-1 font-bold ${s.kind === "found" ? "text-[#6fd39c]" : s.kind === "merged" ? "text-violet-300" : s.kind === "clean" ? "text-stone-300" : "text-amber-300"}`}>
                          {s.kind === "found" ? <CheckCircle2 size={14} /> : s.kind === "noai" || s.kind === "error" || s.kind === "unsure" ? <TriangleAlert size={14} /> : null}
                          {s.kind === "found" ? `${s.code} ашылды` : s.kind === "merged" ? "Біріктірілді" : s.kind === "clean" ? "Таза" : s.kind === "unsure" ? "Күмәнді" : "Тексерілмеді"}
                        </div>
                        <div className="text-stone-400">
                          {s.emoji ? `${s.emoji} ` : ""}
                          {s.text}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                {found > 0 && (
                  <Link href="/ops" className="mt-3 flex min-h-[44px] items-center justify-center rounded-[4px] bg-white/10 text-[14px] font-bold text-salt hover:bg-white/15">
                    Оператор картасынан көру →
                  </Link>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
