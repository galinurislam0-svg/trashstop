"use client";
import { GovStrip } from "@/components/GovStrip";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });
import QRCode from "qrcode";
import { Logo } from "@/components/Logo";
import { Avatar, PhotoBox, Stars, TestDataBadge } from "@/components/ui";
import { useCity } from "@/lib/client";
import { CATEGORY, isOverdue, timeAgo } from "@/lib/meta";

export default function PublicPage() {
  const { state } = useCity(6000);
  const [qr, setQr] = useState("");
  useEffect(() => {
    QRCode.toDataURL(`${location.origin}/citizen`, { margin: 1, width: 360, color: { dark: "#0f172a", light: "#ffffff" } }).then(setQr);
  }, []);
  const reports = state?.reports ?? [];
  const now = state?.now ?? Date.now();

  const districts = useMemo(() => {
    const m = new Map<string, { open: number; over: number; done: number }>();
    for (const r of reports) {
      const x = m.get(r.district) ?? { open: 0, over: 0, done: 0 };
      if (r.status === "done") x.done++;
      else if (r.status !== "rejected") x.open++;
      if (isOverdue(r, now)) x.over++;
      m.set(r.district, x);
    }
    return [...m.entries()].map(([name, v]) => ({ name, ...v, index: Math.max(0, Math.round(100 - v.open * 6 - v.over * 10)) })).sort((a, b) => b.index - a.index);
  }, [reports, now]);

  const mapPoints = useMemo(
    () =>
      reports
        .filter((r) => r.status !== "rejected")
        .map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, color: r.status === "done" ? "#1e7a4c" : "#e2231a", size: r.status === "done" ? 3.5 : 5.5, label: CATEGORY[r.category].label, sub: r.status === "done" ? "орындалды" : "ашық" })),
    [reports],
  );
  const recent = reports.filter((r) => r.status === "done").slice(0, 8);
  const heroes = [...(state?.workers ?? [])].sort((a, b) => b.thanks - a.thanks).slice(0, 8);
  const done7 = reports.filter((r) => r.doneAt && now - r.doneAt < 7 * 864e5).length;

  return (
    <>
    <GovStrip />
    <main id="main" className="a11y-zoom light-page min-h-dvh">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="flex items-center justify-between">
          <Logo light sub="Ашық деректер · Тұрғындарға" />
          <TestDataBadge light />
        </header>

        <section className="mt-8 grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
              Қала тазалығы <span className="text-qyzyl">ашық</span>.
            </h1>
            <p className="mt-3 max-w-xl text-stone-500">Әр шағым, әр тазаланған жер және оны тазалаған адам, бәрі көрініп тұр. Өткен аптада {done7} жер тазартылды.</p>
          </div>
          {qr && (
            <div className="flex items-center gap-4 rounded-3xl bg-[#fbfaf7] p-4 shadow-sm">
              <img src={qr} alt="QR" className="h-32 w-32" />
              <div className="max-w-[150px] text-sm font-semibold text-stone-700">
                Қоқыс көрдіңіз бе? <span className="text-qyzyl">Сканерлеңіз</span>, қосымша орнатудың қажеті жоқ
              </div>
            </div>
          )}
        </section>

        <h2 id="map" className="mt-10 scroll-mt-6 text-lg font-extrabold text-ink">Қала картасы</h2>
        <p className="text-sm text-stone-500">Қызыл — ашық өтініштер, жасыл — орындалғандары. Жеке деректер көрсетілмейді.</p>
        <div className="mt-3 h-[min(60vh,520px)] overflow-hidden rounded-2xl border border-line">
          <MapView theme="light" points={mapPoints} zoom={13} pitch={40} />
        </div>

        <h2 className="mt-10 display text-[26px] text-ink">Аудандардың тазалық индексі</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {districts.map((d) => (
            <div key={d.name} className="rounded-[6px] bg-[#fbfaf7] p-4 shadow-sm">
              <div className={`text-3xl font-extrabold ${d.index >= 75 ? "text-qyzyl" : d.index >= 50 ? "text-amber-500" : "text-red-500"}`}>{d.index}</div>
              <div className="mt-1 text-sm font-semibold text-stone-700">{d.name}</div>
              <div className="text-xs text-stone-400">{d.open} ашық · {d.done} тазаланды</div>
            </div>
          ))}
        </div>

        <h2 className="mt-10 display text-[26px] text-ink">Соңғы тазаланған жерлер</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {recent.map((r) => (
            <div key={r.id} className="overflow-hidden rounded-[6px] bg-[#fbfaf7] shadow-sm">
              <div className="grid grid-cols-2">
                <PhotoBox src={r.photo} category={r.category} className="aspect-square w-full" />
                <PhotoBox src={r.afterPhoto} category={r.category} className="aspect-square w-full" />
              </div>
              <div className="p-3">
                <div className="text-xs font-bold text-qyzyl">✓ {CATEGORY[r.category].short} · {r.district}</div>
                <div className="text-[11px] text-stone-400">{r.doneAt ? timeAgo(r.doneAt, now) : ""}</div>
              </div>
            </div>
          ))}
        </div>

        <h2 className="mt-10 display text-[26px] text-ink">🏆 Қала батырлары</h2>
        <p className="text-sm text-stone-500">Тұрғындардан ең көп алғыс алған тазалықшылар</p>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {heroes.map((w, i) => (
            <div key={w.id} className="flex flex-col items-center rounded-[6px] bg-[#fbfaf7] p-5 text-center shadow-sm">
              <Avatar name={w.name} size={56} ring={i < 3 ? "#FBBF24" : undefined} />
              <div className="mt-2 text-sm font-bold text-stone-800">{w.name}</div>
              <div className="mt-1">
                <Stars value={w.rating} size={12} />
              </div>
              <div className="mt-1 text-xs font-semibold text-rose-500">❤️ {w.thanks} алғыс</div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-3xl bg-ink p-6 text-center text-white">
          <div className="text-xl font-extrabold">«Олар тазалайды» деп шашпайық 🌈</div>
          <div className="mt-1 text-sm text-stone-300">Қаланы күн сайын біздің ата-әжелеріміз тазалайды. Олардың еңбегін құрметтейік.</div>
        </div>
      </div>
    </main>
    </>
  );
}
