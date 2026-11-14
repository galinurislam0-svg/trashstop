"use client";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { FileDown, Sparkles, Loader2, Trophy, Clock3, CheckCircle2, AlertTriangle, Smile, Timer, Heart, Radio, Sprout } from "lucide-react";
import Link from "next/link";
import { Rail } from "@/components/Rail";
import { Logo } from "@/components/Logo";
import { Avatar, Stars, TestDataBadge } from "@/components/ui";
import { post, useCity, useFleet } from "@/lib/client";
import { CATEGORY, isOverdue, kzWeekday } from "@/lib/meta";
import { RU } from "@/lib/i18n-ru";
import type { Category } from "@/lib/types";

const C_IN = "#3B82F6";
const C_OUT = "#0EA371";

export default function DashboardPage() {
  const { state } = useCity(5000);
  const fleet = useFleet(10000);
  // 🌳 Күтімді қажет ететін нысандар (жасыл қор)
  const care = useMemo(() => {
    if (!state) return null;
    const now = state.now;
    const trees = state.trees;
    const zones = new Map<string, { name: string; dry: number; weak: number; total: number; sumDays: number; known: number; auto: boolean }>();
    for (const t of trees) {
      const z = zones.get(t.zone) ?? { name: t.zone, dry: 0, weak: 0, total: 0, sumDays: 0, known: 0, auto: t.autoIrrigation };
      z.total++;
      if (t.health === "dry") z.dry++;
      if (t.health === "weak") z.weak++;
      if (t.lastWatered > 0) (z.sumDays += (now - t.lastWatered) / 864e5), z.known++;
      zones.set(t.zone, z);
    }
    const list = [...zones.values()]
      .map((z) => {
        const daysDry = z.known ? Math.round(z.sumDays / z.known) : 0; // аймақтағы ағаштардың орташа суарылмаған күні
        return { ...z, daysDry, need: z.dry * 2 + z.weak + daysDry * 2 };
      })
      .sort((a, b) => b.need - a.need)
      .slice(0, 5);
    const tasks = state.reports.filter((r) => r.category === "tree" && r.status !== "done" && r.status !== "rejected");
    return {
      dry: trees.filter((t) => t.health === "dry").length,
      weak: trees.filter((t) => t.health === "weak").length,
      unwatered: list.filter((z) => z.daysDry >= 5 && !z.auto).length,
      open: tasks.length,
      overdue: tasks.filter((r) => isOverdue(r, now)).length,
      zones: list,
    };
  }, [state]);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryAi, setSummaryAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const reports = state?.reports ?? [];
  const now = state?.now ?? Date.now();

  const k = useMemo(() => {
    const week = reports.filter((r) => now - r.createdAt < 7 * 864e5);
    const closed = reports.filter((r) => r.status === "done" && r.doneAt);
    const onTime = closed.filter((r) => !r.deadline || r.doneAt! <= r.deadline).length;
    const avgH = closed.length ? closed.reduce((a, r) => a + (r.doneAt! - r.createdAt), 0) / closed.length / 36e5 : 0;
    const rated = reports.filter((r) => r.rating);
    const sat = rated.length ? rated.reduce((a, r) => a + r.rating!, 0) / rated.length : 0;
    const merged = reports.reduce((a, r) => a + r.merged, 0);
    return {
      week: week.length,
      open: reports.filter((r) => r.status !== "done" && r.status !== "rejected").length,
      overdue: reports.filter((r) => isOverdue(r, now)).length,
      onTimePct: closed.length ? Math.round((onTime / closed.length) * 100) : 0,
      avgH,
      sat,
      merged,
      // Уақыт үнемі: біріктірілген қайталанулар + автоматты тағайындау + есепті автоматты жасау
      savedH: Math.round(merged * 0.5 + week.length * 0.25 + 6),
    };
  }, [reports, now]);

  const daily = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now - (6 - i) * 864e5);
      d.setHours(0, 0, 0, 0);
      return d;
    });
    return days.map((d) => {
      const s = d.getTime();
      const e = s + 864e5;
      return {
        day: `${kzWeekday(d)} ${d.getDate()}`,
        Түсті: reports.filter((r) => r.createdAt >= s && r.createdAt < e).length,
        Жабылды: reports.filter((r) => r.doneAt && r.doneAt >= s && r.doneAt < e).length,
      };
    });
  }, [reports, now]);

  const byCat = useMemo(
    () =>
      (Object.keys(CATEGORY) as Category[])
        .map((c) => ({ name: CATEGORY[c].short, n: reports.filter((r) => r.category === c).length }))
        .sort((a, b) => b.n - a.n),
    [reports],
  );

  const districts = useMemo(() => {
    const m = new Map<string, { n: number; open: number; over: number }>();
    for (const r of reports) {
      const x = m.get(r.district) ?? { n: 0, open: 0, over: 0 };
      x.n++;
      if (r.status !== "done" && r.status !== "rejected") x.open++;
      if (isOverdue(r, now)) x.over++;
      m.set(r.district, x);
    }
    return [...m.entries()]
      .map(([name, v]) => ({ name, ...v, index: Math.max(0, Math.round(100 - v.open * 6 - v.over * 10)) }))
      .sort((a, b) => a.index - b.index);
  }, [reports, now]);

  const top = useMemo(() => [...(state?.workers ?? [])].sort((a, b) => b.rating * 100 + b.onTimePct - (a.rating * 100 + a.onTimePct)).slice(0, 6), [state]);

  const brigades = useMemo(
    () =>
      (state?.brigades ?? [])
        .map((b) => {
          const mine = reports.filter((r) => r.brigadeId === b.id);
          const done = mine.filter((r) => r.status === "done");
          const ot = done.filter((r) => !r.deadline || r.doneAt! <= r.deadline).length;
          return { ...b, total: mine.length, done: done.length, pct: done.length ? Math.round((ot / done.length) * 100) : 0, open: mine.length - done.length };
        })
        .filter((b) => b.total > 0)
        .sort((a, b) => b.pct - a.pct),
    [state, reports],
  );

  async function genSummary() {
    setBusy(true);
    const facts = [
      `Апта ішінде сигнал: ${k.week}`,
      `Ашық тапсырма: ${k.open}, мерзімі өткен: ${k.overdue}`,
      `Мерзімінде орындалу: ${k.onTimePct}%`,
      `Орташа жабылу уақыты: ${k.avgH.toFixed(1)} сағ`,
      `Тұрғындар бағасы: ${k.sat.toFixed(1)}/5`,
      `Біріктірілген қайталанған шағым: ${k.merged}`,
      `Ең проблемалы аудан: ${districts[0]?.name} (${districts[0]?.open} ашық)`,
      `Санаттар: ${byCat.map((c) => `${c.name} ${c.n}`).join(", ")}`,
    ].join("\n");
    const res = await post<{ text: string }>("/api/ai/report", { facts }).catch(() => ({ text: "" }));
    setSummaryAi(Boolean(res.text));
    setSummary(
      res.text ||
        (document.documentElement.lang === "ru"
          ? `За неделю в систему поступило ${k.week} сигналов, ${k.onTimePct}% из них исполнено в установленный срок, среднее время закрытия составило ${k.avgH.toFixed(1)} ч. ${k.merged} повторных обращений объединено автоматически, что сократило холостые выезды бригад. Больше всего загрязнений зафиксировано в районе «${RU[districts[0]?.name ?? ""] ?? districts[0]?.name}» — рекомендуется установить там дополнительные контейнеры и предупреждающие знаки. Средняя оценка жителями качества услуг — ${k.sat.toFixed(1)}/5.`
          : null) ||
        `Апта ішінде жүйеге ${k.week} сигнал түсті, оның ${k.onTimePct}%-ы белгіленген мерзімде орындалды, орташа жабылу уақыты ${k.avgH.toFixed(1)} сағатты құрады. ${k.merged} қайталанған шағым автоматты түрде біріктірілді, бұл бригадалардың бос сапарларын азайтты. Ең көп ластану «${districts[0]?.name}» ауданында тіркелді, бұл аумаққа қосымша контейнерлер мен ескерту белгілерін орнату ұсынылады. Тұрғындардың қызмет сапасына берген орташа бағасы ${k.sat.toFixed(1)}/5.`,
    );
    setBusy(false);
  }

  return (
    <>
    <Rail />
    <main id="main" className="a11y-zoom lg:ml-[68px] min-h-dvh bg-ink">
      <h1 className="sr-only print:hidden">Әкімдік: басшы панелі</h1>
      <div className="mx-auto max-w-7xl px-4 pb-[170px] pt-5 sm:px-6 lg:pb-10">
        <header className="no-print flex flex-wrap items-center gap-3">
          <Logo sub="Әкімдік · Басшы панелі" />
          <span className="ml-auto sm:hidden">
            <TestDataBadge />
          </span>
          <div className="grid w-full grid-cols-2 items-center gap-2 sm:ml-auto sm:flex sm:w-auto">
            <span className="hidden sm:contents">
              <TestDataBadge />
            </span>
            <button onClick={genSummary} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[4px] bg-white/5 px-3.5 py-2.5 text-sm font-semibold leading-tight text-stone-200 hover:bg-white/10 sm:min-h-0">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} className="text-salt" />} ЖИ апталық қорытынды
            </button>
            <button
              onClick={async () => {
                if (!summary) await genSummary();
                setTimeout(() => window.print(), 300);
              }}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[4px] bg-white px-3.5 py-2.5 text-sm font-bold text-stone-900 hover:bg-stone-100 sm:min-h-0"
            >
              <FileDown size={16} /> Есеп PDF
            </button>
          </div>
        </header>

        <div className="mt-2 hidden print:block">
          <h2 className="text-2xl font-bold">TrashSTOP: апталық есеп</h2>
          <div className="text-sm" suppressHydrationWarning>Қызылорда қаласы · {new Date().toLocaleDateString("kk-KZ")} · тестілік деректер</div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Tile icon={CheckCircle2} l="Мерзімінде орындалды" v={`${k.onTimePct}%`} tone="text-salt" />
          <Tile icon={Clock3} l="Орташа жабылу уақыты" v={`${k.avgH.toFixed(1)} сағ`} tone="text-sky-300" />
          <Tile icon={AlertTriangle} l="Мерзімі өткен" v={String(k.overdue)} tone="text-red-400" />
          <Tile icon={Smile} l="Тұрғындар бағасы" v={`${k.sat.toFixed(1)} / 5`} tone="text-amber-300" />
          <Tile icon={Timer} l="Аптада үнемделген уақыт (бағалау)" v={`≈${k.savedH} сағ`} tone="text-violet-300" sub="есеп 6 сағ + қайталану 30 мин + диспетчер 15 мин" />
          <Tile icon={Heart} l="Апта ішінде сигнал" v={String(k.week)} tone="text-white" sub={`${k.merged} қайталану біріктірілді`} />
        </div>

        {summary && (
          <div className="mt-4 rounded-[6px] border border-line-d bg-white/[0.03] p-5 print:border-black print:bg-white">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-salt print:text-black">
              <Sparkles size={14} /> Апталық қорытынды {summaryAi ? "(ЖИ жазды)" : "(көрсеткіштерден автоматты)"}
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-stone-200 print:text-black">{summary}</p>
          </div>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card title="Сигналдар мен жабылған тапсырмалар · 7 күн" className="lg:col-span-2">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={daily} barGap={2} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgba(148,163,184,.1)" />
                  <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(148,163,184,.08)" }}
                    contentStyle={{ background: "#171715", border: "1px solid rgba(148,163,184,.2)", borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: "#e2e8f0" }}
                    itemStyle={{ color: "#cbd5e1" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#cbd5e1" }} iconType="circle" iconSize={8} />
                  <Bar dataKey="Түсті" fill={C_IN} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="Жабылды" fill={C_OUT} radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Санаттар бойынша">
            <div className="space-y-2.5">
              {byCat.map((c) => (
                <div key={c.name}>
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-300">{c.name}</span>
                    <span className="font-bold tabular-nums text-stone-200">{c.n}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${(c.n / Math.max(1, byCat[0].n)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card title="Аудандардың тазалық индексі">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-stone-500">
                  <th className="pb-2 font-semibold">Аудан</th>
                  <th className="pb-2 text-right font-semibold">Ашық</th>
                  <th className="pb-2 text-right font-semibold">Индекс</th>
                </tr>
              </thead>
              <tbody>
                {districts.map((d) => (
                  <tr key={d.name} className="border-t border-white/5">
                    <td className="py-2 text-stone-200">{d.name}</td>
                    <td className="py-2 text-right tabular-nums text-stone-400">{d.open}</td>
                    <td className="py-2 text-right">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ${d.index < 50 ? "bg-red-500/15 text-red-300" : d.index < 75 ? "bg-amber-500/15 text-amber-300" : "bg-qyzyl/15 text-salt"}`}>
                        {d.index}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Бригадалар рейтингі · мерзімінде орындау">
            <div className="space-y-2">
              {brigades.map((b, i) => (
                <div key={b.id} className="flex items-center gap-3">
                  <span className="w-5 text-center text-xs font-bold text-stone-500">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="truncate text-stone-200">{b.name}</span>
                      <span className="font-bold tabular-nums text-stone-200">{b.pct}%</span>
                    </div>
                    <div className="text-[11px] text-stone-500">
                      {b.done} жабылды · {b.open} ашық
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title={
              <span className="flex items-center gap-1.5">
                <Trophy size={14} className="text-amber-400" /> Премияға үміткерлер
              </span>
            }
          >
            <div className="space-y-2.5">
              {top.map((w, i) => (
                <div key={w.id} className="flex items-center gap-3">
                  <Avatar name={w.name} size={36} ring={i === 0 ? "#FBBF24" : undefined} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-stone-100">{w.name}</div>
                    <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                      <Stars value={w.rating} size={10} /> {w.rating.toFixed(1)} · {w.onTimePct}% уақтылы · {w.thanks} алғыс
                    </div>
                  </div>
                  {i < 3 && <span className="text-lg">{["🥇", "🥈", "🥉"][i]}</span>}
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-[4px] bg-amber-400/10 p-2.5 text-[11px] text-amber-200">Тазалықшылардың көбі егде жастағы адамдар. Жүйе олардың еңбегін бүкіл қалаға көрсетеді.</div>
          </Card>
        </div>

        {/* 🌳 Күтімді қажет ететін нысандар */}
        {care && (
          <Card
            className="mt-4"
            title={
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <Sprout size={14} className="text-[#6fd39c]" /> Күтімді қажет ететін нысандар · жасыл қор
                </span>
                <Link href="/green" className="inline-flex min-h-[40px] items-center normal-case tracking-normal text-salt hover:underline lg:min-h-0">
                  Жасыл қорды ашу →
                </Link>
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                { l: "Қураған ағаш", v: care.dry, c: "text-red-400" },
                { l: "Әлсіз ағаш", v: care.weak, c: "text-amber-300" },
                { l: "Суарылмаған аймақ (5+ күн)", v: care.unwatered, c: "text-sky-300" },
                { l: "Ашық күтім тапсырмасы", v: care.open, c: "text-stone-100" },
                { l: "Оның ішінде кешіккен", v: care.overdue, c: care.overdue ? "text-red-400" : "text-stone-100" },
              ].map((x) => (
                <div key={x.l} className="rounded-[4px] bg-white/[0.04] p-3">
                  <div className={`text-2xl font-extrabold tabular-nums ${x.c}`}>{x.v}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-stone-400">{x.l}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-[11px] font-bold uppercase tracking-wider text-stone-500">Бірінші кезектегі аймақтар</div>
            <div className="mt-2 space-y-1.5">
              {care.zones.map((z, i) => (
                <div key={z.name} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-[4px] bg-white/[0.03] px-3 py-2 text-sm">
                  <span className="w-4 text-xs font-bold text-stone-500">{i + 1}</span>
                  <span className="min-w-0 flex-1 font-semibold text-stone-100">{z.name}</span>
                  <span className="text-[12px] text-red-300">{`${z.dry} қураған`}</span>
                  <span className="text-[12px] text-amber-300">{`${z.weak} әлсіз`}</span>
                  <span className="text-[12px] text-stone-400">{z.auto ? "автоматты суару" : `орташа ${z.daysDry} күн суарылмаған`}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 💰 Экономикалық тиімділік + енгізу жоспары */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Economy savedH={k.savedH} merged={k.merged} />
          <Rollout />
        </div>

        {/* 🛰 Маршрутты бақылау: көлік барлық контейнерге барды ма */}
        {fleet && (
          <Card
            className="mt-4"
            title={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex items-center gap-1.5">
                  <Radio size={14} className="text-[#6fd39c]" /> Қоқыс көліктері · маршрутты бақылау
                </span>
                <span className="mono rounded bg-white/5 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-stone-400">{fleet.live ? "GPS · тірі" : "GPS симуляциясы"}</span>
              </span>
            }
          >
            <div className="grid gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
              {fleet.trucks.map((t) => {
                const pct = t.stopsTotal ? Math.round((t.stopsDone / t.stopsTotal) * 100) : 0;
                return (
                  <div key={t.id}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-semibold text-stone-100">
                        {t.name} <span className="text-[11px] font-normal text-stone-500">{`${t.brigadeId.replace("b", "")}-бригада`}</span>
                      </span>
                      <span className="font-bold tabular-nums text-stone-200">{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-[#3ecf7a]" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-stone-400">
                      <span>{`${t.stopsDone}/${t.stopsTotal} контейнер`}</span>
                      <span>{`${t.doneKm} км бүгін`}</span>
                      <span>{t.state === "collecting" ? "Қазір контейнерде" : `Жолда, ${t.speedKmh} км/сағ`}</span>
                      {t.missedStops > 0 && <span className="font-semibold text-red-300">{`⚠ ${t.missedStops} контейнер өткізіп жіберілді`}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-[11px] text-stone-500">Көлік контейнер жанында тоқтамай өтсе — жүйе өзі белгілейді. Пилотта мекеменің GPS жүйесінен (мыс. Wialon) деректер алынады.</div>
          </Card>
        )}
      </div>
    </main>
    </>
  );
}

/** Экономикалық тиімділік: болжамдар ашық көрсетілген және өзгертіледі (бағалау, нақты дерек емес) */
function Economy({ savedH, merged }: { savedH: number; merged: number }) {
  const [rate, setRate] = useState(2000); // қызметкердің 1 сағаты, ₸
  const [trip, setTrip] = useState(3500); // бригаданың бір бос сапары, ₸
  const hoursM = Math.round(savedH * 4.3);
  const tripsM = Math.round(merged * 4.3);
  const a = hoursM * rate;
  const b = tripsM * trip;
  const fmt = (n: number) => n.toLocaleString("ru-RU").replace(/,/g, " ");
  const input = "w-24 rounded-[4px] border border-white/15 bg-white/5 px-2 py-1.5 text-right text-sm font-bold tabular-nums text-white outline-none focus:border-white/50";
  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <Timer size={14} className="text-violet-300" /> Экономикалық тиімділік
          <span className="mono rounded bg-white/5 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-stone-400">бағалау</span>
        </span>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-stone-100">Үнемделген жұмыс уақыты</div>
            <div className="text-[12px] text-stone-400">{`${hoursM} сағ/ай × ${fmt(rate)} ₸`}</div>
          </div>
          <div className="text-lg font-extrabold tabular-nums text-white">{`${fmt(a)} ₸`}</div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-stone-100">Болдырылмаған бос сапарлар</div>
            <div className="text-[12px] text-stone-400">{`${tripsM} сапар/ай × ${fmt(trip)} ₸`}</div>
          </div>
          <div className="text-lg font-extrabold tabular-nums text-white">{`${fmt(b)} ₸`}</div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-2 border-t border-white/10 pt-3">
          <div>
            <div className="text-[12px] text-stone-400">Айына шамамен</div>
            <div className="display text-[40px] leading-none text-[#6fd39c]">{`≈ ${fmt(a + b)} ₸`}</div>
          </div>
          <div className="text-right text-[12px] text-stone-400">
            Жылына
            <div className="text-base font-bold text-stone-100">{`≈ ${fmt((a + b) * 12)} ₸`}</div>
          </div>
        </div>
      </div>
      <div className="no-print mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-stone-400">
        <label className="flex items-center gap-2">
          Қызметкердің 1 сағаты, ₸
          <input type="number" min={0} step={100} value={rate} onChange={(e) => setRate(Math.max(0, Number(e.target.value) || 0))} className={input} />
        </label>
        <label className="flex items-center gap-2">
          Бір бос сапар, ₸
          <input type="number" min={0} step={100} value={trip} onChange={(e) => setTrip(Math.max(0, Number(e.target.value) || 0))} className={input} />
        </label>
      </div>
      <div className="mt-3 text-[11px] leading-snug text-stone-500">Тестілік деректер мен болжамдарға негізделген бағалау. Болжамдарды өзгертуге болады; пилотта мекеменің нақты деректерімен қайта есептеледі.</div>
    </Card>
  );
}

/** Енгізу жоспары: не керек, қанша тұрады, қандай ретпен */
function Rollout() {
  const steps = [
    { t: "1-ай", h: "Пилот: бір аудан", d: "2 бригада, 1 оператор. Жабдық керек емес — тек телефон." },
    { t: "2-ай", h: "GPS пен камера", d: "Мекеменің GPS жүйесіне API арқылы қосылу; 2 көлікте камера-сканер." },
    { t: "3-ай", h: "Арналарды біріктіру", d: "eGov «Таза Қазақстан», TazaQazBot және 109 шағымдары бір кезекке." },
    { t: "4–6-ай", h: "Бүкіл қала", d: "Барлық бригада мен аудан, көгалдандыру мердігерлері, әкімдікке апталық есеп." },
  ];
  return (
    <Card title="Енгізу жоспары · «Қызылорда тазалығымен» пилот">
      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.t} className="flex gap-3">
            <span className="mono mt-0.5 w-14 shrink-0 rounded bg-white/5 px-1.5 py-1 text-center text-[11px] font-bold text-salt">{s.t}</span>
            <div className="min-w-0 text-sm">
              <div className="font-semibold text-stone-100">{s.h}</div>
              <div className="text-[12px] leading-snug text-stone-400">{s.d}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          { v: "0 ₸", l: "жабдыққа" },
          { v: "≈ 15–20 ₸", l: "ЖИ, бір фото" },
          { v: "≈ 15 мың ₸", l: "сервер, айына" },
        ].map((x) => (
          <div key={x.l} className="rounded-[4px] bg-white/[0.04] p-2.5">
            <div className="text-base font-extrabold text-white">{x.v}</div>
            <div className="text-[11px] text-stone-400">{x.l}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[11px] leading-snug text-stone-500">Шығындар — шамамен, бұлттық қызметтердің ашық бағалары бойынша. Пилот туралы мекеменің қолдау хаты бар.</div>
    </Card>
  );
}

function Tile({ icon: Icon, l, v, tone, sub }: { icon: typeof Clock3; l: string; v: string; tone: string; sub?: string }) {
  return (
    <div className="glass rounded-[6px] p-4">
      <Icon size={18} className={tone} />
      <div className={`mt-3 text-2xl font-extrabold tabular-nums ${tone}`}>{v}</div>
      <div className="mt-0.5 text-xs text-stone-400">{l}</div>
      {sub && <div className="text-[10px] text-stone-500">{sub}</div>}
    </div>
  );
}

function Card({ title, children, className = "" }: { title: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass rounded-[6px] p-5 ${className}`}>
      <div className="mb-4 text-xs font-bold uppercase tracking-wider text-stone-400">{title}</div>
      {children}
    </div>
  );
}
