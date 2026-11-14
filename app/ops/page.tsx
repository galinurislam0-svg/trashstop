"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Flame, Layers, Play, Maximize2, Sparkles, X, Truck, Clock3, MapPin, Ban, CheckCircle2, AlertTriangle, Bell, Radio, Merge, Search } from "lucide-react";
import { Rail } from "@/components/Rail";
import { Logo } from "@/components/Logo";
import { CategoryChip, PhotoBox, StatusPill, TestDataBadge } from "@/components/ui";
import { post, useCity, useFleet, useHeaderBottom } from "@/lib/client";
import type { Truck as GpsTruck } from "@/lib/fleet";
import { CATEGORY, SOURCE, distanceM, isOverdue, timeAgo, timeLeft, fmtTime, VOLUME, HAZARD } from "@/lib/meta";
import type { Category, Report } from "@/lib/types";

const MAP_STATUS: Record<string, string> = { new: "#e2231a", assigned: "#f5a524", in_progress: "#4aa3ff", done: "#3ecf7a", rejected: "#6b6a64" };
const STATUS_LABEL: Record<string, string> = { new: "жаңа", assigned: "тағайындалды", in_progress: "орындалуда", done: "орындалды", rejected: "қабылданбады" };

import type { MapPoint, Vehicle } from "@/components/MapView";
import { HEALTH, kzWeekday } from "@/lib/meta";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type Filter = "active" | "new" | "overdue" | "done" | "all";

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.start();
    o.stop(ctx.currentTime + 0.4);
    setTimeout(() => ctx.close(), 600);
  } catch {}
}

export default function OpsPage() {
  const { state, refresh } = useCity(2500);
  const [filter, setFilter] = useState<Filter>("active");
  const [cats, setCats] = useState<Category[]>([]);
  const [heat, setHeat] = useState(false);
  const [layers, setLayers] = useState({ reports: true, hex: false, trucks: true, brigades: true, trees: false });
  const [layersOpen, setLayersOpen] = useState(false);
  const [playT, setPlayT] = useState<number | null>(null);
  const [present, setPresent] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // ⏱ Уақыт сызғышы: соңғы 7 күн 14 секундта ойнатылады
  function playWeek() {
    const start = Date.now() - 7 * 864e5;
    const t0 = performance.now();
    setSelected(null);
    setPlayT(start);
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 14000);
      setPlayT(start + k * 7 * 864e5);
      if (k < 1) playRaf.current = requestAnimationFrame(step);
      else setTimeout(() => setPlayT(null), 2500);
    };
    cancelAnimationFrame(playRaf.current);
    playRaf.current = requestAnimationFrame(step);
  }
  const playRaf = useRef(0);

  // ⛶ Презентация режимі: толық экран + камера айналады
  async function togglePresent() {
    if (!present) {
      setSelected(null);
      setLayers((l) => ({ ...l, hex: true, brigades: true }));
      try {
        await document.documentElement.requestFullscreen?.();
      } catch {}
      setPresent(true);
    } else {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      setPresent(false);
    }
  }
  useEffect(() => {
    const onFs = () => !document.fullscreenElement && setPresent(false);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number; key?: number } | null>(null);
  const [toast, setToast] = useState<Report | null>(null);
  const [q, setQ] = useState("");
  const [mobileMap, setMobileMap] = useState(false);
  const [desk, setDesk] = useState(true);
  const hdr = useRef<HTMLElement>(null);
  const hdrBottom = useHeaderBottom(hdr);
  const below = !desk && hdrBottom ? { top: hdrBottom } : undefined;
  useEffect(() => {
    const mq = matchMedia("(min-width: 1024px)");
    const on = () => setDesk(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const [view, setView] = useState<"map" | "table">("map");
  const seen = useRef<Set<string> | null>(null);

  const now = state?.now ?? Date.now();
  const reports = state?.reports ?? [];

  // Жаңа сигнал келгенде — дыбыс, хабарлама, картаға ұшу
  useEffect(() => {
    if (!state) return;
    const ids = new Set(state.reports.map((r) => r.id));
    if (seen.current) {
      const fresh = state.reports.find((r) => !seen.current!.has(r.id));
      if (fresh) {
        setToast(fresh);
        beep();
        setFocus({ lat: fresh.lat, lng: fresh.lng, zoom: 15.5, key: Date.now() });
        setTimeout(() => setToast((t) => (t?.id === fresh.id ? null : t)), 7000);
      }
    }
    seen.current = ids;
  }, [state]);

  const counts = useMemo(
    () => ({
      active: reports.filter((r) => r.status !== "done" && r.status !== "rejected").length,
      new: reports.filter((r) => r.status === "new").length,
      overdue: reports.filter((r) => isOverdue(r, now)).length,
      done: reports.filter((r) => r.status === "done").length,
      all: reports.length,
    }),
    [reports, now],
  );

  const list = useMemo(() => {
    let l = reports;
    if (filter === "active") l = l.filter((r) => r.status !== "done" && r.status !== "rejected");
    if (filter === "new") l = l.filter((r) => r.status === "new");
    if (filter === "overdue") l = l.filter((r) => isOverdue(r, now));
    if (filter === "done") l = l.filter((r) => r.status === "done");
    if (cats.length) l = l.filter((r) => cats.includes(r.category));
    if (q) l = l.filter((r) => (r.code + r.address + r.district + r.description).toLowerCase().includes(q.toLowerCase()));
    const rank = (r: Report) => (isOverdue(r, now) ? 0 : r.status === "new" ? 1 : 2);
    return [...l].sort((a, b) => rank(a) - rank(b) || b.priority - a.priority || b.createdAt - a.createdAt);
  }, [reports, filter, cats, q, now]);

  const points = useMemo(() => {
    const out: MapPoint[] = [];
    if (playT !== null) {
      // уақыт сызғышы: сол сәттегі қала күйі
      for (const r of reports) {
        if (r.createdAt > playT) continue;
        const closed = r.doneAt !== null && r.doneAt <= playT;
        out.push({
          id: r.id,
          lat: r.lat,
          lng: r.lng,
          color: closed ? "#3ecf7a" : "#e2231a",
          size: closed ? 3.4 : 8,
          weight: closed ? 0.2 : 1 + r.merged,
          icon: closed ? "" : CATEGORY[r.category].emoji,
        });
      }
      return out;
    }
    if (layers.reports)
      for (const r of list)
        out.push({
          id: r.id,
          lat: r.lat,
          lng: r.lng,
          color: isOverdue(r, now) ? "#ff5a3c" : MAP_STATUS[r.status],
          size: r.status === "done" ? 3.6 : 7 + r.priority,
          weight: r.status === "done" ? 0.3 : 1 + r.merged,
          icon: r.status === "done" ? "" : CATEGORY[r.category].emoji,
          label: `${r.code} · ${r.description}`,
          sub: `${CATEGORY[r.category].short} · ${isOverdue(r, now) ? "мерзімі өтті" : STATUS_LABEL[r.status]} · ${r.district}`,
        });
    if (layers.trees)
      for (const t of state?.trees ?? [])
        out.push({ id: t.id, lat: t.lat, lng: t.lng, color: HEALTH[t.health].color, size: 3, weight: 0, label: `${t.species} · ${HEALTH[t.health].label}`, sub: t.zone });
    return out;
  }, [list, now, playT, reports, layers.reports, layers.trees, state?.trees]);

  const playStats = useMemo(() => {
    if (playT === null) return null;
    let open = 0,
      closed = 0;
    for (const r of reports) {
      if (r.createdAt > playT) continue;
      if (r.doneAt !== null && r.doneAt <= playT) closed++;
      else open++;
    }
    return { open, closed };
  }, [playT, reports]);

  // 🚛 Бригада көліктері: тағайындалса — оқиға орнына қарай жүреді (4 мин), орындалуда — орнында тұрады
  const vehicles = useMemo<Vehicle[]>(() => {
    if (!layers.brigades || !state) return [];
    void tick;
    const t = Date.now();
    return state.brigades.map((b) => {
      const job = state.reports
        .filter((r) => r.brigadeId === b.id && (r.status === "assigned" || r.status === "in_progress"))
        .sort((a, c) => (c.assignedAt ?? 0) - (a.assignedAt ?? 0))[0];
      if (!job) return { id: b.id, lat: b.lat, lng: b.lng, label: b.name.replace("-бригада", " бр."), busy: false };
      const k = job.status === "in_progress" ? 1 : Math.min(1, (t - (job.assignedAt ?? t)) / 240000);
      return { id: b.id, lat: b.lat + (job.lat - b.lat) * k, lng: b.lng + (job.lng - b.lng) * k, label: `${b.name.replace("-бригада", " бр.")} → ${job.code}`, busy: true };
    });
  }, [layers.brigades, state, tick]);
  // 🛰 Қоқыс көліктері: GPS провайдерінен (демода — көшелермен жүретін симуляция)
  const fleet = useFleet(2000, layers.trucks);
  const allVehicles = useMemo<Vehicle[]>(() => {
    const trucks: Vehicle[] =
      layers.trucks && fleet
        ? fleet.trucks.map((t) => ({ id: t.id, lat: t.lat, lng: t.lng, kind: "truck", collecting: t.state === "collecting", busy: false, label: `${t.name.replace(" көлік", "")} · ${t.state === "collecting" ? "жинап жатыр" : `${t.speedKmh} км/сағ`}` }))
        : [];
    return [...vehicles, ...trucks];
  }, [vehicles, fleet, layers.trucks]);
  const pulse = useMemo(
    () => reports.filter((r) => r.status === "new" && now - r.createdAt < 15 * 60000).map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, color: "#FF3B4F" })),
    [reports, now],
  );

  // Болжам: соңғы 7 күндегі сигналдар тығыздығы бойынша «ертеңгі қауіпті аймақтар» (аудан бойынша)
  const hotspots = useMemo(() => {
    const m = new Map<string, { n: number; lat: number; lng: number; pts: number }>();
    for (const r of reports) {
      if (now - r.createdAt > 7 * 864e5) continue;
      const x = m.get(r.district) ?? { n: 0, lat: 0, lng: 0, pts: 0 };
      x.n += 1 + r.merged;
      x.lat += r.lat;
      x.lng += r.lng;
      x.pts += 1;
      m.set(r.district, x);
    }
    const arr = [...m.entries()].map(([district, x]) => ({ district, n: x.n, lat: x.lat / x.pts, lng: x.lng / x.pts })).sort((a, b) => b.n - a.n);
    const max = arr[0]?.n || 1;
    return arr.slice(0, 3).map((h) => ({ ...h, risk: Math.round(55 + 37 * (h.n / max)) }));
  }, [reports, now]);

  const sel = reports.find((r) => r.id === selected) ?? null;
  const selBrigade = sel?.brigadeId ? state?.brigades.find((b) => b.id === sel.brigadeId) : null;
  const routeLine = sel && selBrigade && sel.status !== "done" ? { from: { lat: selBrigade.lat, lng: selBrigade.lng }, to: { lat: sel.lat, lng: sel.lng } } : null;

  return (
    <>
    <Rail />
    <main id="main" className="lg:ml-[68px] relative h-dvh overflow-hidden bg-ink text-stone-200">
      <h1 className="sr-only">TrashSTOP басқару орталығы</h1>
      <div className="absolute inset-0">
        <MapView
          points={points}
          heat={heat && playT === null}
          selectedId={selected}
          onSelect={(id) => {
            setSelected(id);
            const r = reports.find((x) => x.id === id);
            if (r) setFocus({ lat: r.lat, lng: r.lng, zoom: 15.2, key: Date.now() });
          }}
          focus={focus}
          pulse={pulse}
          pitch={50}
          controlsPos="top-right"
          className="ctrl-offset"
          zoom={13.8}
          padding={desk ? { left: 380, top: 70, right: sel ? 400 : 0 } : { top: 120, bottom: 90 }}
          route={playT === null ? routeLine : null}
          cluster
          hex3d={layers.hex}
          vehicles={allVehicles}
          autoRotate={present}
        />
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-4 rounded-[4px] bg-ink/90 px-4 py-2 text-[11px] font-semibold text-stone-300 lg:flex">
          {[["#e2231a", "Жаңа"], ["#f5a524", "Тағайындалды"], ["#4aa3ff", "Орындалуда"], ["#3ecf7a", "Орындалды"], ["#ff5a3c", "Мерзімі өтті"]].map(([c, l]) => (
            <span key={l} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border border-white/60" style={{ background: c }} />
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* Жоғарғы панель */}
      <header ref={hdr} className="a11y-zoom glass absolute left-3 right-3 top-3 z-20 flex flex-wrap items-center gap-3 rounded-[6px] px-4 py-2.5 lg:left-4 lg:right-4">
        <Logo sub="Басқару орталығы · Оператор" />
        <div className="mx-1 hidden h-8 w-px bg-white/10 min-[1400px]:block" />
        {/* KPI: тар экранда сүзгі қойындыларында сандар бар */}
        <div className="hidden items-center gap-1.5 min-[1400px]:flex">
          <Kpi label="Белсенді" value={counts.active} color="#60A5FA" />
          <Kpi label="Жаңа" value={counts.new} color="#F87171" />
          <Kpi label="Мерзімі өтті" value={counts.overdue} color="#EF4444" pulse={counts.overdue > 0} />
          <span className="hidden min-[1600px]:contents">
            <Kpi label="Жабылды" value={counts.done} color="#f2f1ed" />
          </span>
        </div>
        <div className="flex w-full items-center gap-2 lg:ml-auto lg:w-auto">
          <span className="hidden lg:contents">
            <TestDataBadge />
          </span>
          {/* Телефонда: Тізім / Карта / Кесте — бір ауыстырғыш */}
          <div className="flex flex-1 rounded-[4px] bg-white/5 p-0.5 text-[13px] font-semibold lg:hidden" role="group" aria-label="Көрініс">
            {(
              [
                ["list", "Тізім"],
                ["map", "Карта"],
                ["table", "Кесте"],
              ] as const
            ).map(([k, l]) => {
              const on = k === "table" ? view === "table" : view === "map" && (k === "map") === mobileMap;
              return (
                <button
                  key={k}
                  onClick={() => {
                    setView(k === "table" ? "table" : "map");
                    setMobileMap(k === "map");
                  }}
                  aria-pressed={on}
                  className={`min-h-[40px] flex-1 rounded-[3px] px-2 transition ${on ? "bg-salt text-ink" : "text-stone-300"}`}
                >
                  {l}
                </button>
              );
            })}
          </div>
          <span className="hidden items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-stone-300 min-[1700px]:inline-flex">
            <Radio size={13} className="text-salt" /> eGov · TazaQazBot · 109 · TrashSTOP
          </span>
          <div className="hidden rounded-[4px] bg-white/5 p-0.5 text-xs font-semibold lg:flex" role="group" aria-label="Көрініс">
            {(
              [
                ["map", "Карта"],
                ["table", "Кесте"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} onClick={() => setView(k)} aria-pressed={view === k} className={`rounded-[3px] px-3 py-1.5 transition ${view === k ? "bg-salt text-ink" : "text-stone-300 hover:text-white"}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="relative">
            <button
              onClick={() => setLayersOpen((o) => !o)}
              aria-expanded={layersOpen}
              aria-label="Қабаттар"
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-xs font-semibold transition lg:min-h-0 ${layersOpen ? "bg-salt text-ink" : "bg-white/5 text-stone-300 hover:bg-white/10"}`}
            >
              <Layers size={16} /> <span className="hidden sm:inline">Қабаттар</span>
            </button>
            {layersOpen && (
              <div className="absolute right-0 top-10 z-40 w-64 rounded-[6px] border border-line-d bg-ink-2 p-2 shadow-2xl">
                {(
                  [
                    ["reports", "Шағымдар (белгішелер, кластерлер)"],
                    ["hex", "3D ошақ бағандары"],
                    ["trucks", "Қоқыс көліктері (GPS)"],
                    ["brigades", "Бригада көліктері"],
                    ["trees", "Ағаштар (жасыл қор)"],
                  ] as [keyof typeof layers, string][]
                ).map(([k, l]) => (
                  <label key={k} className="flex cursor-pointer items-center justify-between gap-3 rounded-[4px] px-2.5 py-2 text-[13px] text-stone-200 hover:bg-white/5">
                    {l}
                    <input type="checkbox" checked={layers[k]} onChange={() => setLayers((x) => ({ ...x, [k]: !x[k] }))} className="h-4 w-4 accent-[#e2231a]" />
                  </label>
                ))}
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[4px] px-2.5 py-2 text-[13px] text-stone-200 hover:bg-white/5">
                  Жылу картасы
                  <input type="checkbox" checked={heat} onChange={() => setHeat((h) => !h)} className="h-4 w-4 accent-[#e2231a]" />
                </label>
              </div>
            )}
          </div>
          <button
            onClick={playWeek}
            className="hidden items-center gap-1.5 rounded-[4px] bg-white/5 px-3 py-1.5 text-xs font-semibold text-stone-300 transition hover:bg-white/10 lg:inline-flex"
          >
            <Play size={13} /> Апта
          </button>
          <button
            onClick={togglePresent}
            className={`hidden items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-xs font-semibold transition lg:inline-flex ${present ? "bg-qyzyl text-white" : "bg-white/5 text-stone-300 hover:bg-white/10"}`}
          >
            <Maximize2 size={13} /> {present ? "Шығу" : "Презентация"}
          </button>
        </div>
      </header>

      {/* Сол жақ: кезек */}
      <aside className={`a11y-zoom glass absolute bottom-[84px] left-3 top-[128px] lg:bottom-3 lg:top-[84px] z-10 w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-[6px] lg:left-4 ${present || playT !== null ? "!hidden" : "lg:flex"} ${mobileMap ? "hidden" : "flex"}`} style={below}>
        <div className="border-b border-white/5 p-3">
          <div className="mb-2 lg:hidden">
            <TestDataBadge />
          </div>
          <div className="flex items-center gap-2 rounded-[4px] bg-white/5 px-3 py-2">
            <Search size={15} className="text-stone-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Код, көше, аудан…" className="w-full bg-transparent text-sm outline-none placeholder:text-stone-500" />
          </div>
          <div className="mt-2.5 flex gap-1 overflow-x-auto scroll-thin pb-0.5">
            {(
              [
                ["active", "Белсенді"],
                ["new", "Жаңа"],
                ["overdue", "Кешіккен"],
                ["done", "Жабылған"],
                ["all", "Барлығы"],
              ] as [Filter, string][]
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`min-h-[40px] shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition lg:min-h-0 lg:px-2.5 ${filter === k ? "bg-white text-stone-900" : "bg-white/5 text-stone-400 hover:text-white"}`}
              >
                {l} <span className="opacity-60">{counts[k]}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(Object.keys(CATEGORY) as Category[]).map((c) => {
              const on = cats.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => setCats((x) => (on ? x.filter((y) => y !== c) : [...x, c]))}
                  className={`inline-flex min-h-[36px] items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-semibold transition lg:min-h-0 lg:px-2 lg:text-[11px] ${on ? "bg-white/15 text-white" : "text-stone-500 hover:text-stone-300"}`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY[c].color }} />
                  {CATEGORY[c].short}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
          <span>
            <Sparkles size={11} className="mr-1 inline text-salt" />
            ЖИ басымдығы бойынша реттелген
          </span>
          <span>{list.length}</span>
        </div>
        <div className="flex-1 space-y-1.5 overflow-y-auto scroll-thin px-2 pb-2">
          {list.slice(0, 120).map((r) => (
            <QueueItem
              key={r.id}
              r={r}
              now={now}
              active={selected === r.id}
              onClick={() => {
                setSelected(r.id);
                setFocus({ lat: r.lat, lng: r.lng, zoom: 15.2, key: Date.now() });
              }}
            />
          ))}
        </div>
      </aside>

      {/* Болжам */}
      {!sel && !present && playT === null && (
        <div className="glass absolute bottom-3 right-3 z-10 hidden w-[300px] rounded-[6px] p-4 lg:right-4 lg:block">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-300">
            <AlertTriangle size={14} /> Ертеңгі қауіпті аймақтар
          </div>
          <div className="mt-1 text-[11px] text-stone-500">ЖИ болжамы: соңғы 7 күндегі қайталанулар бойынша</div>
          <div className="mt-3 space-y-2">
            {hotspots.map((h, i) => (
              <button
                key={i}
                onClick={() => {
                  setLayers((l) => ({ ...l, hex: true }));
                  setFocus({ lat: h.lat, lng: h.lng, zoom: 15.8, key: Date.now() });
                }}
                className="flex w-full items-center gap-3 rounded-[4px] bg-white/5 p-2.5 text-left transition hover:bg-white/10"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-sm font-extrabold text-orange-300">{h.risk}%</div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{h.district}</div>
                  <div className="text-[11px] text-stone-400">{h.n} сигнал · белгі мен контейнер қою ұсынылады</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Оң жақ: толық ақпарат */}
      <AnimatePresence>
        {sel && !present && playT === null && <Detail key={sel.id} r={sel} now={now} trucks={fleet?.trucks ?? []} gpsLive={!!fleet?.live} onClose={() => setSelected(null)} onChanged={refresh} />}
      </AnimatePresence>

      {/* Жаңа сигнал хабарламасы */}
      <AnimatePresence>
        {toast && (
          <motion.button
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            onClick={() => {
              setSelected(toast.id);
              setToast(null);
            }}
            className="absolute left-1/2 top-[88px] z-30 flex w-[min(420px,calc(100vw-24px))] -transtone-x-1/2 items-center gap-3 rounded-[6px] border border-red-400/30 bg-ink-2 p-3 text-left shadow-2xl backdrop-blur"
          >
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] bg-red-500/20 text-red-300">
              <Bell size={20} />
              <span className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-red-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold uppercase tracking-wider text-red-300">Жаңа сигнал · {toast.code}</div>
              <div className="truncate text-sm font-semibold text-white">{toast.ai?.summary ?? toast.description}</div>
              <div className="text-[11px] text-stone-400">
                {toast.district} · {SOURCE[toast.source]}
              </div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>
          {/* ▦ Кесте режимі: шенеуніктерге арналған ірі әріпті кесте */}
      {view === "table" && !present && (
        <section
          aria-label="Өтініштер кестесі"
          className={`a11y-zoom absolute bottom-[84px] left-3 right-3 top-[128px] z-[15] flex flex-col overflow-hidden rounded-[6px] border border-line-d bg-ink-2 lg:bottom-3 lg:top-[84px] lg:left-4 ${sel ? "lg:right-[420px]" : "lg:right-4"}`}
          style={below}
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
            {(
              [
                ["active", "Белсенді"],
                ["new", "Жаңа"],
                ["overdue", "Мерзімі өткен"],
                ["done", "Орындалған"],
                ["all", "Барлығы"],
              ] as [Filter, string][]
            ).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={`rounded-[4px] px-3.5 py-2 text-[15px] font-semibold ${filter === k ? "bg-salt text-ink" : "bg-white/5 text-stone-300 hover:bg-white/10"}`}>
                {l} <span className="opacity-60">{counts[k]}</span>
              </button>
            ))}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Іздеу: нөмір, көше, аудан" className="ml-auto min-w-[220px] rounded-[4px] bg-white/5 px-3.5 py-2 text-[15px] text-salt outline-none placeholder:text-stone-500 focus:bg-white/10" />
          </div>
          <div className="flex-1 overflow-auto scroll-thin">
            <table className="w-full min-w-[860px] border-collapse text-left text-[15px]">
              <thead className="sticky top-0 z-10 bg-ink-2 text-[12px] uppercase tracking-wider text-mist">
                <tr>
                  {["№", "Санаты", "Мекенжайы", "Аудан", "Мәртебесі", "Мерзімі", "Орындаушы"].map((h) => (
                    <th key={h} scope="col" className="border-b border-white/10 px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.slice(0, 200).map((r) => {
                  const over = isOverdue(r, now);
                  const br = state?.brigades.find((b) => b.id === r.brigadeId);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r.id)}
                      className={`cursor-pointer border-b border-white/5 transition hover:bg-white/5 ${selected === r.id ? "bg-white/10" : over ? "bg-qyzyl/[0.06]" : ""}`}
                    >
                      <td className="mono px-4 py-3.5 text-salt">{r.code}</td>
                      <td className="px-4 py-3.5 text-stone-200">
                        {CATEGORY[r.category].emoji} {CATEGORY[r.category].short}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-salt">{r.address}</td>
                      <td className="px-4 py-3.5 text-stone-300">{r.district}</td>
                      <td className="px-4 py-3.5">
                        <StatusPill status={r.status} overdue={over} />
                      </td>
                      <td className={`px-4 py-3.5 ${over ? "font-semibold text-qyzyl" : "text-stone-300"}`}>{r.deadline && r.status !== "done" ? timeLeft(r.deadline, now) : r.doneAt ? "орындалды" : "—"}</td>
                      <td className="px-4 py-3.5 text-stone-300">{br?.name ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!list.length && <div className="p-10 text-center text-[17px] text-mist">Сүзгіге сәйкес өтініш жоқ</div>}
          </div>
        </section>
      )}

      {/* ⏱ Уақыт сызғышы панелі */}
      {playT !== null && playStats && (
        <div className="absolute bottom-16 left-1/2 z-30 w-[min(560px,calc(100vw-24px))] -translate-x-1/2 rounded-[6px] border border-line-d bg-ink-2/95 p-4 shadow-2xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="mono text-[11px] text-mist">Соңғы 7 күн · қаланың күйі</div>
              <div className="display mt-1 text-[34px] text-salt">
                {kzWeekday(new Date(playT))} {new Date(playT).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}{" "}
                <span className="text-mist">{new Date(playT).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
            <div className="flex gap-5 text-right">
              <div>
                <div className="display text-[30px] text-qyzyl tabular-nums">{playStats.open}</div>
                <div className="text-[11px] text-mist">ашық</div>
              </div>
              <div>
                <div className="display text-[30px] text-[#3ecf7a] tabular-nums">{playStats.closed}</div>
                <div className="text-[11px] text-mist">жабылды</div>
              </div>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-qyzyl" style={{ width: `${Math.min(100, ((playT - (Date.now() - 7 * 864e5)) / (7 * 864e5)) * 100)}%` }} />
          </div>
          <button
            onClick={() => {
              cancelAnimationFrame(playRaf.current);
              setPlayT(null);
            }}
            className="mt-3 text-[12px] font-semibold text-mist hover:text-salt"
          >
            Тоқтату
          </button>
        </div>
      )}

      {/* ⛶ Презентация экраны */}
      {present && (
        <div className="pointer-events-none absolute bottom-8 left-8 z-30 max-w-[620px]">
          <div className="mono text-[13px] text-mist">Қызылорда · тірі режим · {new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</div>
          <div className="display mt-2 text-[clamp(3rem,6vw,6rem)] leading-[0.9] text-salt">
            Қызыл <span className="text-qyzyl">{counts.active}</span>
            <br />
            Таза <span className="text-[#3ecf7a]">{counts.done}</span>
          </div>
          <div className="mt-3 text-[15px] text-stone-300">Бағандар биіктігі — соңғы аптадағы шағымдар саны. Көліктер — бригадалардың нақты жағдайы.</div>
        </div>
      )}

    </main>
    </>
  );
}

function Kpi({ label, value, color, pulse }: { label: string; value: number; color: string; pulse?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-[4px] bg-white/[0.04] px-3 py-1.5">
      <span className={`h-2 w-2 rounded-full ${pulse ? "animate-pulse" : ""}`} style={{ background: color }} />
      <span className="text-lg font-extrabold tabular-nums text-white">{value}</span>
      <span className="text-[11px] font-medium text-stone-400">{label}</span>
    </div>
  );
}

function QueueItem({ r, now, active, onClick }: { r: Report; now: number; active: boolean; onClick: () => void }) {
  const over = isOverdue(r, now);
  return (
    <button
      onClick={onClick}
      className={`flex w-full gap-3 rounded-[4px] p-2.5 text-left transition ${active ? "bg-white/12 ring-1 ring-white/20" : over ? "bg-red-500/[0.07] hover:bg-red-500/[0.12]" : "hover:bg-white/[0.05]"}`}
    >
      <div className="relative">
        <PhotoBox src={r.photo} category={r.category} className="h-12 w-12 rounded-lg" />
        {r.priority === 3 && r.status !== "done" && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#171715] bg-red-500" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-stone-500">{r.code}</span>
          <StatusPill status={r.status} overdue={over} />
          {r.merged > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">
              <Merge size={10} />×{r.merged + 1}
            </span>
          )}
        </div>
        <div className="mt-1 truncate text-[13px] font-semibold text-stone-100">{r.description}</div>
        <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-stone-500">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CATEGORY[r.category].color }} />
          {r.district} · {r.deadline && r.status !== "done" ? timeLeft(r.deadline, now) : timeAgo(r.createdAt, now)}
        </div>
      </div>
    </button>
  );
}

function Detail({ r, now, trucks, gpsLive, onClose, onChanged }: { r: Report; now: number; trucks: GpsTruck[]; gpsLive: boolean; onClose: () => void; onChanged: () => void }) {
  // Ең жақын қоқыс көліктері: көше бойынша қашықтық ≈ түзу × 1,35, орташа жылдамдық 18 км/сағ
  const near = useMemo(
    () =>
      trucks
        .map((t) => {
          const distM = Math.round((distanceM(t, r) * 1.35) / 10) * 10;
          return { ...t, distM, etaMin: Math.max(1, Math.round(distM / 300)) };
        })
        .sort((a, b) => a.distM - b.distM)
        .slice(0, 2),
    [trucks, r],
  );
  const [sugg, setSugg] = useState<{ id: string; name: string; load: number; distM: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const over = isOverdue(r, now);

  useEffect(() => {
    if (r.status !== "new") return;
    fetch(`/api/reports/${r.id}`)
      .then((x) => x.json())
      .then((j) => setSugg(j.suggestions ?? []))
      .catch(() => {});
  }, [r.id, r.status]);

  async function doAct(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await post(`/api/reports/${r.id}`, body);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.aside
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="glass absolute bottom-[84px] left-3 right-3 top-3 z-30 flex flex-col overflow-hidden rounded-[6px] lg:bottom-3 lg:left-auto lg:right-4 lg:top-[84px] lg:z-20 lg:w-[400px]"
    >
      <div className="relative h-48 shrink-0">
        <PhotoBox src={r.photo} category={r.category} className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#171715] via-transparent to-black/30" />
        <button onClick={onClose} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70">
          <X size={16} />
        </button>
        <div className="absolute bottom-3 left-4 right-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-stone-300">{r.code}</span>
            <StatusPill status={r.status} overdue={over} />
          </div>
          <div className="mt-1 text-lg font-bold leading-snug text-white">{r.description}</div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto scroll-thin p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-400">
          <CategoryChip category={r.category} />
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} /> {r.address}, {r.district}
          </span>
          <a
            href={`https://2gis.kz/kyzylorda/geo/${r.lng}%2C${r.lat}`}
            target="_blank"
            rel="noreferrer"
            className="sweep-line text-[11px] font-semibold text-salt"
          >
            2GIS-те ашу ↗
          </a>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Mini l="Көзі" v={SOURCE[r.source]} />
          <Mini l="Түсті" v={timeAgo(r.createdAt, now)} />
          <Mini l="Мерзім" v={r.deadline ? timeLeft(r.deadline, now) : "—"} warn={over} />
        </div>

        <div className="rounded-[4px] border border-line-d bg-white/[0.03] p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-salt">
            <Sparkles size={13} /> ЖИ талдауы
          </div>
          <div className="mt-1.5 text-sm text-stone-200">
            Басымдық: <b className={r.priority === 3 ? "text-red-400" : r.priority === 2 ? "text-amber-300" : "text-stone-300"}>{["", "төмен", "орташа", "жоғары"][r.priority]}</b>
          </div>
          <div className="text-xs text-stone-400">{r.priorityReason}</div>
          {r.ai && (
            <div className="mt-2 text-xs text-stone-400">
              Көлемі: {r.ai.volumeM3 ? `≈${r.ai.volumeM3} м³` : VOLUME[r.ai.volume]} · Қауіп: {HAZARD[r.ai.hazard]} · Сенім: {Math.round(r.ai.confidence * 100)}%{r.ai.items?.length ? ` · ${r.ai.items.join(", ")}` : ""}
            </div>
          )}
          {r.merged > 0 && <div className="mt-1 text-xs text-violet-300">{r.merged} қайталанған шағым осы тапсырмаға біріктірілді</div>}
        </div>

        {r.status === "new" && near.length > 0 && (
          <div className="rounded-[4px] border border-clean/50 bg-clean/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#6fd39c]">
                <Radio size={13} /> Ең жақын қоқыс көлігі
              </span>
              <span className="mono text-[10px] text-stone-400">{gpsLive ? "GPS · тірі" : "GPS симуляциясы"}</span>
            </div>
            {near.map((t, i) => (
              <button
                key={t.id}
                disabled={busy}
                onClick={() => doAct({ action: "assign", brigadeId: t.brigadeId })}
                className={`mt-2 flex w-full items-center gap-3 rounded-[4px] p-3 text-left transition disabled:opacity-50 ${i === 0 ? "bg-clean text-white hover:brightness-110" : "bg-white/5 hover:bg-white/10"}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">
                    {t.name}
                    {` · ${t.distM < 1000 ? `${t.distM} м` : `${(t.distM / 1000).toFixed(1)} км`} · ~${t.etaMin} мин`}
                  </div>
                  <div className={`text-[11px] ${i === 0 ? "text-white/80" : "text-stone-400"}`}>
                    {t.state === "collecting" ? "Қазір контейнерде" : `Жолда, ${t.speedKmh} км/сағ`}
                    {` · `}
                    {`${t.brigadeId.replace("b", "")}-бригада`}
                  </div>
                </div>
                <span className="text-xs font-bold">{i === 0 ? "Жіберу →" : "Таңдау"}</span>
              </button>
            ))}
          </div>
        )}

        {r.status === "new" && (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-400">
              <Truck size={13} /> ЖИ диспетчер ұсынысы
            </div>
            <div className="space-y-1.5">
              {sugg.map((s, i) => (
                <button
                  key={s.id}
                  disabled={busy}
                  onClick={() => doAct({ action: "assign", brigadeId: s.id })}
                  className={`flex w-full items-center gap-3 rounded-[4px] p-3 text-left transition disabled:opacity-50 ${i === 0 ? "bg-qyzyl text-white hover:bg-qyzyl-2" : "bg-white/5 hover:bg-white/10"}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{s.name}</div>
                    <div className={`text-[11px] ${i === 0 ? "text-white/80" : "text-stone-400"}`}>
                      {(s.distM / 1000).toFixed(1)} км · жүктемесі {s.load} тапсырма
                    </div>
                  </div>
                  <span className="text-xs font-bold">{i === 0 ? "Тағайындау →" : "Таңдау"}</span>
                </button>
              ))}
            </div>
            <div className="mt-1.5 text-[11px] text-stone-500">Мерзім санатқа қарай автоматты қойылады ({CATEGORY[r.category].slaHours} сағ; жоғары басымдықта — екі есе қысқа)</div>
          </div>
        )}

        {r.verification && (
          <div className={`rounded-[4px] p-3 ${r.verification.ok ? "bg-white/[0.04]" : "bg-red-500/10"}`}>
            <div className={`flex items-center gap-1.5 text-xs font-bold ${r.verification.ok ? "text-salt" : "text-red-300"}`}>
              {r.verification.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {r.verification.ok ? "Фотомен расталды" : "Растау сәтсіз — тапсырма жабылмады"}
            </div>
            <div className="mt-1 text-xs text-stone-400">
              Геоорын: шағым нүктесінен {r.verification.distanceM} м · {r.verification.minutesAfterAssign} мин ішінде
            </div>
            {r.verification.reasons.map((x) => (
              <div key={x} className="mt-1 text-xs text-red-300">
                • {x}
              </div>
            ))}
          </div>
        )}

        {r.status === "done" && (r.photo || r.afterPhoto) && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase text-stone-500">Дейін</div>
              <PhotoBox src={r.photo} category={r.category} className="aspect-square w-full rounded-lg" />
            </div>
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase text-salt">Кейін</div>
              <PhotoBox src={r.afterPhoto} category={r.category} className="aspect-square w-full rounded-lg" />
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-400">
            <Clock3 size={13} /> Тарих
          </div>
          <ol className="space-y-2 border-l border-white/10 pl-4">
            {[...r.timeline].reverse().map((t, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-stone-500" />
                <div className="text-[13px] text-stone-200">{t.text}</div>
                <div className="text-[11px] text-stone-500">{fmtTime(t.at)}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {r.status === "new" && (
        <div className="border-t border-white/5 p-3">
          <button
            disabled={busy}
            onClick={() => doAct({ action: "reject" })}
            className="flex w-full items-center justify-center gap-1.5 rounded-[4px] bg-white/5 py-2.5 text-xs font-semibold text-stone-400 hover:bg-white/10"
          >
            <Ban size={14} /> Жалған / қайталанған деп белгілеу
          </button>
        </div>
      )}
    </motion.aside>
  );
}

function Mini({ l, v, warn }: { l: string; v: string; warn?: boolean }) {
  return (
    <div className="rounded-[4px] bg-white/[0.04] px-2 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">{l}</div>
      <div className={`mt-0.5 truncate text-xs font-bold ${warn ? "text-red-400" : "text-stone-200"}`}>{v}</div>
    </div>
  );
}

