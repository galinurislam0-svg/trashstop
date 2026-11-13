"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Droplets, ThermometerSun, Sprout, Camera, Loader2, Truck, CloudRain, Snowflake, Sun, Sparkles, X } from "lucide-react";
import { Rail } from "@/components/Rail";
import { Logo } from "@/components/Logo";
import { TestDataBadge } from "@/components/ui";
import { compressImage, post, useCity, useHeaderBottom } from "@/lib/client";
import { CARE_KINDS, HEALTH, distanceM, kzWeekday, type CareKind } from "@/lib/meta";
import type { Tree, TreeHealth } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type Day = { date: string; tmax: number; tmin: number; rain: number; wind: number };
const SUMMER: Day[] = [42, 41, 39, 43, 40, 38, 41].map((t, i) => ({ date: `2026-07-${String(14 + i).padStart(2, "0")}`, tmax: t, tmin: t - 16, rain: 0, wind: 18 }));

function plan(d: Day) {
  if (d.tmax < 8) return { level: "off", label: "Суару қажет емес", color: "#94A3B8", icon: Snowflake };
  if (d.rain >= 3) return { level: "skip", label: "Жаңбыр: суару өткізіледі", color: "#60A5FA", icon: CloudRain };
  if (d.tmax >= 38) return { level: "x2", label: "Екі рет суару (таң + кеш)", color: "#EF4444", icon: Sun };
  if (d.tmax >= 30) return { level: "x1.5", label: "Күшейтілген суару", color: "#F59E0B", icon: ThermometerSun };
  return { level: "x1", label: "Қалыпты суару", color: "#22C55E", icon: Droplets };
}

export default function GreenPage() {
  const { state, refresh } = useCity(5000);
  const [weather, setWeather] = useState<{ live: boolean; current: number; days: Day[] } | null>(null);
  const [summer, setSummer] = useState(false);
  const [selTree, setSelTree] = useState<Tree | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number; key?: number } | null>(null);
  const [aiRes, setAiRes] = useState<{ health: TreeHealth; comment: string; confidence: number } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [filter, setFilter] = useState<TreeHealth | "all">("all");
  const [mobileMap, setMobileMap] = useState(false);
  const hdr = useRef<HTMLElement>(null);
  const hdrBottom = useHeaderBottom(hdr);
  const [desk, setDesk] = useState(true);
  useEffect(() => {
    const mq = matchMedia("(min-width: 1024px)");
    const on = () => setDesk(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/weather")
      .then((r) => r.json())
      .then(setWeather)
      .catch(() => {});
  }, []);

  const trees = state?.trees ?? [];
  // Тікелей сілтеме: /green?tree=t6 — ағаш карточкасы бірден ашылады
  const deep = useRef(false);
  useEffect(() => {
    if (deep.current || !state) return;
    const id = new URLSearchParams(location.search).get("tree");
    const t = id ? state.trees.find((x) => x.id === id) : null;
    if (t) {
      deep.current = true;
      setSelTree(t);
      setFocus({ lat: t.lat, lng: t.lng, zoom: 17, key: Date.now() });
      setMobileMap(true);
    }
  }, [state]);
  const days = summer ? SUMMER : (weather?.days ?? []);
  const today = days[0];
  const todayPlan = today ? plan(today) : null;

  const stats = useMemo(() => {
    const by = { good: 0, weak: 0, dry: 0 } as Record<TreeHealth, number>;
    trees.forEach((t) => by[t.health]++);
    const young = trees.filter((t) => t.planted >= 2024);
    const contractors = [...new Set(trees.map((t) => t.contractor))].map((c) => {
      const ys = young.filter((t) => t.contractor === c);
      const alive = ys.filter((t) => t.health !== "dry").length;
      return { name: c, total: ys.length, pct: ys.length ? Math.round((alive / ys.length) * 100) : 0 };
    });
    const survival = young.length ? Math.round((young.filter((t) => t.health !== "dry").length / young.length) * 100) : 0;
    return { by, total: trees.length, survival, contractors };
  }, [trees]);

  const zones = useMemo(() => {
    const m = new Map<string, Tree[]>();
    trees.forEach((t) => m.set(t.zone, [...(m.get(t.zone) ?? []), t]));
    const depot = { lat: 44.852, lng: 65.512 };
    return [...m.entries()]
      .map(([name, ts]) => {
        const lat = ts.reduce((a, t) => a + t.lat, 0) / ts.length;
        const lng = ts.reduce((a, t) => a + t.lng, 0) / ts.length;
        const last = ts.reduce((a, t) => a + t.lastWatered, 0) / ts.length;
        const weak = ts.filter((t) => t.health !== "good").length;
        return { name, lat, lng, count: ts.length, weak, last, auto: ts[0].autoIrrigation, dist: distanceM(depot, { lat, lng }) };
      })
      .sort((a, b) => Number(a.auto) - Number(b.auto) || b.weak / b.count - a.weak / a.count);
  }, [trees]);

  const manualRoute = zones.filter((z) => !z.auto).sort((a, b) => a.dist - b.dist);

  const points = useMemo(
    () =>
      trees
        .filter((t) => filter === "all" || t.health === filter)
        .map((t) => ({ id: t.id, lat: t.lat, lng: t.lng, color: HEALTH[t.health].color, size: t.health === "dry" ? 4.2 : 3.4, weight: t.health === "good" ? 0 : 1, label: `${t.species} · ${HEALTH[t.health].label}`, sub: `${t.zone} · ${t.planted} ж.` })),
    [trees, filter],
  );

  async function onTreePhoto(f?: File) {
    if (!f) return;
    setAiBusy(true);
    setAiRes(null);
    try {
      const photo = await compressImage(f);
      setAiRes(await post("/api/ai/tree", { photo }));
    } finally {
      setAiBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
    <Rail />
    <main id="main" className="lg:ml-[68px] relative h-dvh overflow-hidden bg-ink text-stone-200">
      <h1 className="sr-only">Жасыл қор: ағаштар және суару жоспары</h1>
      <div className="absolute inset-0">
        <MapView
          points={points}
          heat={false}
          focus={focus}
          zoom={13.6}
          pitch={50}
          controlsPos="top-right"
          className="ctrl-offset"
          padding={desk ? { left: 390, top: 70 } : { top: 130, bottom: 90 }}
          selectedId={selTree?.id}
          onSelect={(id) => setSelTree(trees.find((t) => t.id === id) ?? null)}
        />
      </div>

      <header ref={hdr} className="a11y-zoom glass absolute left-3 right-3 top-3 z-20 flex flex-wrap items-center gap-3 rounded-[6px] px-4 py-2.5 lg:left-4 lg:right-4">
        <Logo sub="Жасыл қор · Көгалдандыру маманы" />
        {/* Телефонда: ақпарат пен карта ауыстырғышы */}
        <div className="flex w-full rounded-[4px] bg-white/5 p-0.5 text-[13px] font-semibold lg:hidden" role="group" aria-label="Көрініс">
          {(
            [
              [false, "Ақпарат"],
              [true, "Карта"],
            ] as const
          ).map(([m, l]) => (
            <button key={l} onClick={() => setMobileMap(m)} aria-pressed={mobileMap === m} className={`min-h-[40px] flex-1 rounded-[3px] transition ${mobileMap === m ? "bg-salt text-ink" : "text-stone-300"}`}>
              {l}
            </button>
          ))}
        </div>
        <div className={`w-full items-center gap-2 lg:ml-auto lg:flex lg:w-auto ${mobileMap ? "flex" : "hidden"}`}>
          <span className="hidden lg:contents">
            <TestDataBadge />
          </span>
          <div className="flex flex-1 rounded-lg bg-white/5 p-0.5 text-xs font-semibold">
            {(["all", "good", "weak", "dry"] as const).map((k) => (
              <button key={k} onClick={() => setFilter(k)} className={`min-h-[36px] flex-1 rounded-md px-2.5 py-1.5 lg:min-h-0 lg:flex-none ${filter === k ? "bg-white text-stone-900" : "text-stone-400"}`}>
                {k === "all" ? "Барлығы" : HEALTH[k].label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <aside className={`a11y-zoom glass absolute bottom-[84px] left-3 right-3 top-[124px] z-10 space-y-3 overflow-y-auto scroll-thin rounded-[6px] p-4 lg:bottom-3 lg:left-4 lg:right-auto lg:top-[84px] lg:block lg:w-[390px] ${mobileMap ? "hidden" : "block"}`} style={!desk && hdrBottom ? { top: hdrBottom } : undefined}>
        <div className="lg:hidden">
          <TestDataBadge />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(["good", "weak", "dry"] as TreeHealth[]).map((h) => (
            <div key={h} className="rounded-[4px] bg-white/[0.04] p-3">
              <div className="text-2xl font-extrabold tabular-nums" style={{ color: HEALTH[h].color }}>
                {stats.by[h]}
              </div>
              <div className="text-[11px] font-medium text-stone-400">{HEALTH[h].label}</div>
            </div>
          ))}
        </div>

        <div className="rounded-[4px] bg-white/[0.04] p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-salt">
              <Sprout size={14} /> Жас көшеттердің тірі қалуы
            </div>
            <div className="text-xl font-extrabold text-white">{stats.survival}%</div>
          </div>
          <div className="mt-1 text-[11px] text-stone-500">2024 жылдан бері отырғызылғандар · мердігерлер бойынша</div>
          <div className="mt-3 space-y-2">
            {stats.contractors.map((c) => (
              <div key={c.name}>
                <div className="flex justify-between text-xs">
                  <span className="text-stone-300">{c.name}</span>
                  <span className={`font-bold ${c.pct < 70 ? "text-red-400" : "text-salt"}`}>{c.pct}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: c.pct < 70 ? "#EF4444" : "#22C55E" }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-stone-400">💡 Төлемді тірі қалған ағаш санына байланыстыру ұсынылады</div>
        </div>

        <div className="rounded-[4px] bg-white/[0.04] p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-300">
              <Droplets size={14} /> Суару жоспары
            </div>
            <button
              onClick={() => setSummer((s) => !s)}
              className={`rounded-md px-2 py-1 text-[11px] font-bold ${summer ? "bg-red-500/20 text-red-300" : "bg-white/5 text-stone-400"}`}
            >
              {summer ? "☀️ Шілде сценарийі" : "Шілде сценарийі"}
            </button>
          </div>
          <div className="mt-1 text-[11px] text-stone-500">
            {summer ? "Демо: шілдедегі +40° аптап" : weather?.live ? `Қызылорда, нақты болжам (Open-Meteo) · қазір ${Math.round(weather.current)}°` : "Болжам жүктелуде…"}
          </div>
          {todayPlan && (
            <div className="mt-3 flex items-center gap-3 rounded-[4px] p-3" style={{ background: `${todayPlan.color}1a` }}>
              <todayPlan.icon size={22} style={{ color: todayPlan.color }} />
              <div>
                <div className="text-sm font-bold text-white">Бүгін: {todayPlan.label}</div>
                <div className="text-[11px] text-stone-400">
                  {todayPlan.level === "off" ? "Күзгі күтім: санитарлық кесу, діңін ақтау, қыстауға дайындық" : "Автоматты желі кестесі: 19:00-05:00"}
                </div>
              </div>
            </div>
          )}
          <div className="mt-2 grid grid-cols-7 gap-1">
            {days.map((d) => {
              const p = plan(d);
              return (
                <div key={d.date} className="rounded-lg bg-white/[0.03] py-1.5 text-center">
                  <div className="text-[9px] text-stone-500">{kzWeekday(d.date)}</div>
                  <div className="text-xs font-bold text-white">{Math.round(d.tmax)}°</div>
                  <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[4px] bg-white/[0.04] p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
            <Truck size={14} /> Су тасушы көлік бағыты
          </div>
          <div className="mt-1 text-[11px] text-stone-500">Автоматты желі жоқ аймақтар · депоға жақыннан бастап</div>
          <ol className="mt-2 space-y-1.5">
            {manualRoute.map((z, i) => (
              <li key={z.name} className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-[11px] font-bold text-amber-300">{i + 1}</span>
                <button
                  onClick={() => {
                    setFocus({ lat: z.lat, lng: z.lng, zoom: 16, key: Date.now() });
                    setMobileMap(true);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate text-sm font-semibold text-stone-200">{z.name}</div>
                  <div className="text-[11px] text-stone-500">
                    {z.count} ағаш · {z.weak} әлсіз/қураған · орташа {Math.round((Date.now() - z.last) / 864e5)} күн бұрын суарылған
                  </div>
                </button>
                <button
                  onClick={async () => {
                    await post("/api/trees", { zone: z.name });
                    refresh();
                  }}
                  className="rounded-lg bg-sky-500/15 px-2 py-1 text-[11px] font-bold text-sky-300 hover:bg-sky-500/25"
                >
                  Суарылды
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-[4px] border border-line-d bg-white/[0.03] p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-salt">
            <Sparkles size={14} /> ЖИ: ағаштың күйін фотодан анықтау
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-[4px] bg-qyzyl py-2.5 text-sm font-bold text-white hover:bg-qyzyl-2"
          >
            {aiBusy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} Ағашты суретке түсіру
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onTreePhoto(e.target.files?.[0])} />
          {aiRes && (
            <div className="mt-2 rounded-lg bg-black/20 p-2.5 text-sm">
              <span className="font-bold" style={{ color: HEALTH[aiRes.health].color }}>
                {HEALTH[aiRes.health].label}
              </span>{" "}
              · {Math.round(aiRes.confidence * 100)}%<div className="text-xs text-stone-400">{aiRes.comment}</div>
              {!selTree && <div className="mt-1 text-[11px] text-stone-500">Картадан ағашты таңдасаңыз, нәтижені соған сақтауға болады.</div>}
            </div>
          )}
        </div>
      </aside>

      {selTree && (
        <TreeCard
          key={selTree.id}
          tree={trees.find((t) => t.id === selTree.id) ?? selTree}
          ai={aiRes}
          onClose={() => setSelTree(null)}
          onSaved={refresh}
        />
      )}
    </main>
    </>
  );
}

/** Ағаш карточкасы: жағдайын тіркеу + күтім тапсырмасын жоспарлау (жауапты, мерзім) */
function TreeCard({ tree, ai, onClose, onSaved }: { tree: Tree; ai: { health: TreeHealth; comment: string; confidence: number } | null; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<CareKind>(tree.health === "dry" ? "replant" : tree.health === "weak" ? "water" : "prune");
  const [days, setDays] = useState(tree.health === "good" ? 7 : 3);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function setHealth(h: TreeHealth, note?: string) {
    setBusy(true);
    setErr(null);
    try {
      await post("/api/trees", { action: "health", id: tree.id, health: h, note });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function plan() {
    setBusy(true);
    setErr(null);
    try {
      const r = await post<{ code: string }>("/api/trees", { action: "care", id: tree.id, kind, days });
      setDone(r.code);
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass absolute bottom-[84px] left-3 right-3 z-30 max-h-[70dvh] overflow-y-auto scroll-thin rounded-[6px] p-4 lg:bottom-3 lg:left-auto lg:right-4 lg:z-20 lg:max-h-[calc(100dvh-110px)] lg:w-[340px]">
      <button onClick={onClose} aria-label="Жабу" className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full text-stone-400 hover:bg-white/10 hover:text-white">
        <X size={18} />
      </button>
      <div className="text-xs font-bold text-stone-500">{`Ағаш #${tree.id.slice(1)}`}</div>
      <div className="mt-1 text-lg font-bold text-white">{tree.species}</div>
      <div className="mt-2 space-y-1 text-xs text-stone-400">
        <div>Аймақ: <span className="text-stone-200">{tree.zone}</span></div>
        <div>Отырғызылды: <span className="text-stone-200">{tree.planted} ж.</span></div>
        <div>Күтетін: <span className="text-stone-200">{tree.contractor}</span></div>
        <div>Суару: <span className="text-stone-200">{tree.autoIrrigation ? "автоматты желі" : "су тасушы көлік"}</span></div>
        <div>Соңғы суару: <span className="text-stone-200">{Math.round((Date.now() - tree.lastWatered) / 864e5)} күн бұрын</span></div>
        {tree.checkedAt && (
          <div>
            Соңғы тексеру: <span className="text-stone-200">{new Date(tree.checkedAt).toLocaleString("kk-KZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            {tree.checkNote && <span className="block text-stone-300">{tree.checkNote}</span>}
          </div>
        )}
      </div>

      {/* 1. Жағдайын тіркеу */}
      <div className="mt-4 text-[11px] font-bold uppercase tracking-wider text-stone-400">Жағдайын тіркеу</div>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {(["good", "weak", "dry"] as TreeHealth[]).map((h) => (
          <button
            key={h}
            disabled={busy}
            onClick={() => setHealth(h)}
            aria-pressed={tree.health === h}
            className="min-h-[44px] rounded-[4px] border-2 text-[13px] font-bold transition disabled:opacity-50"
            style={tree.health === h ? { background: HEALTH[h].color, borderColor: HEALTH[h].color, color: "#0e0e0d" } : { borderColor: `${HEALTH[h].color}66`, color: HEALTH[h].color }}
          >
            {HEALTH[h].label}
          </button>
        ))}
      </div>
      {ai && ai.health !== tree.health && (
        <button
          disabled={busy}
          onClick={() => setHealth(ai.health, `ЖИ: ${ai.comment}`)}
          className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-[4px] bg-white/5 py-2 text-[12px] font-semibold text-salt hover:bg-white/10"
        >
          <Sparkles size={13} /> {`ЖИ нәтижесін сақтау: ${HEALTH[ai.health].label}`}
        </button>
      )}

      {/* 2. Күтім тапсырмасы */}
      <div className="mt-4 text-[11px] font-bold uppercase tracking-wider text-stone-400">Күтім тапсырмасын жоспарлау</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {(Object.keys(CARE_KINDS) as CareKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${kind === k ? "bg-salt text-ink" : "bg-white/5 text-stone-300 hover:bg-white/10"}`}
          >
            {CARE_KINDS[k].emoji} {CARE_KINDS[k].label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[12px] text-stone-400">
        Мерзімі:
        {[1, 3, 7].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            aria-pressed={days === d}
            className={`rounded-[4px] px-2.5 py-1.5 font-semibold transition ${days === d ? "bg-salt text-ink" : "bg-white/5 text-stone-300 hover:bg-white/10"}`}
          >
            {`${d} күн`}
          </button>
        ))}
      </div>
      <div className="mt-2 text-[11px] text-stone-500">Жауапты: 7-бригада (көгалдандыру) · орындалуы фотомен расталады</div>
      <button
        disabled={busy}
        onClick={plan}
        className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[4px] bg-clean text-[15px] font-bold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Sprout size={16} />} Тапсырма беру
      </button>
      {done && (
        <div role="status" className="mt-2 rounded-[4px] bg-clean/15 p-2.5 text-[13px] text-[#6fd39c]">
          {`✓ ${done} тапсырмасы 7-бригадаға жіберілді. Орындаушының қосымшасында көрінеді.`}
        </div>
      )}
      {err && <div className="mt-2 text-[13px] text-red-300">{err}</div>}
    </div>
  );
}
