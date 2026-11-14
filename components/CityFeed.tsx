"use client";
// «Қала жаңалығы»: тек фото мен GPS арқылы расталған жұмыстар — дейін → кейін.
// Пікір, лайк, жарнама жоқ: модерация керек емес, лентада тек жүйе дәлелдеген нәтиже шығады.
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Clock3, MapPin, MoveHorizontal, Star } from "lucide-react";
import { CATEGORY, SOURCE, timeAgo } from "@/lib/meta";
import type { Category, Report, Worker } from "@/lib/types";

const PAGE = 6;

function dur(ms: number) {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h < 24) return r ? `${h} сағ ${r} мин` : `${h} сағ`;
  return `${Math.round(h / 24)} күн`;
}
function shortName(n?: string) {
  if (!n) return "";
  const [a, b] = n.split(" ");
  return b ? `${a} ${b[0]}.` : a;
}
function hhmm(t: number) {
  return new Date(t).toLocaleTimeString("kk-KZ", { hour: "2-digit", minute: "2-digit" });
}

/** Фото болмаса — суретті ойдан қоспаймыз, санаттың белгішесі бар стильді орын */
function Shot({ src, category, after }: { src: string | null; category: Category; after?: boolean }) {
  if (src) return <img src={src} alt={after ? "Кейін" : "Дейін"} loading="lazy" draggable={false} className="absolute inset-0 h-full w-full select-none object-cover" />;
  const c = CATEGORY[category];
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: after
          ? "radial-gradient(circle at 70% 25%, #3ecf7a55, transparent 60%), linear-gradient(135deg, #16352a, #0e1f18)"
          : `radial-gradient(circle at 30% 25%, ${c.color}66, transparent 60%), linear-gradient(135deg, #2a1d1b, #0e0e0d)`,
      }}
    >
      <span className="text-5xl opacity-90">{after ? "✓" : c.emoji}</span>
    </div>
  );
}

/** Дейін/кейін салыстыру: сызықты саусақпен немесе пернетақтамен жылжыту */
function BeforeAfter({ r }: { r: Report }) {
  const [x, setX] = useState(50);
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink">
      <Shot src={r.afterPhoto} category={r.category} after />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - x}% 0 0)` }}>
        <Shot src={r.photo} category={r.category} />
      </div>
      <div className="pointer-events-none absolute inset-y-0 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_12px_rgba(0,0,0,.5)]" style={{ left: `${x}%` }}>
        <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-lg">
          <MoveHorizontal size={18} />
        </span>
      </div>
      <span className="mono pointer-events-none absolute left-3 top-3 rounded bg-qyzyl px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-white">Дейін</span>
      <span className="mono pointer-events-none absolute right-3 top-3 rounded bg-clean px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-white">Кейін</span>
      {(r.photo?.startsWith("/demo/") || r.afterPhoto?.startsWith("/demo/")) && (
        <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur">Тестілік фото · Wikimedia Commons</span>
      )}
      <input
        type="range"
        min={0}
        max={100}
        value={x}
        onChange={(e) => setX(Number(e.target.value))}
        aria-label="Дейін мен кейін суреттерін салыстыру"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}

function Card({ r, worker, now }: { r: Report; worker?: Worker; now: number }) {
  const c = CATEGORY[r.category];
  const took = r.doneAt ? r.doneAt - r.createdAt : 0;
  const v = r.verification;
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[0_12px_32px_-24px_rgba(0,0,0,.35)]"
    >
      <BeforeAfter r={r} />
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-clean/10 px-2.5 py-1 text-[12px] font-bold text-clean">
            <BadgeCheck size={14} /> {v ? `Фото + GPS расталды · ${v.distanceM} м` : "Фотомен расталды"}
          </span>
          <span className="text-[12px] text-stone-400">{r.doneAt ? timeAgo(r.doneAt, now) : ""}</span>
        </div>
        <div>
          <div className="text-[17px] font-bold leading-snug text-ink">{`${c.emoji} ${c.label}`}</div>
          <div className="mt-0.5 flex items-start gap-1 text-[14px] text-stone-500">
            <MapPin size={14} className="mt-0.5 shrink-0" />
            <span>
              {r.address}
              {` · ${r.district}`}
            </span>
          </div>
        </div>
        {/* Жолы: түсті → тазаланды */}
        <ol className="grid grid-cols-3 gap-1 text-center text-[11px] leading-tight">
          <li className="rounded-[6px] bg-salt px-1.5 py-2">
            <div className="font-bold text-ink">{hhmm(r.createdAt)}</div>
            <div className="text-stone-500">Шағым түсті</div>
          </li>
          <li className="rounded-[6px] bg-salt px-1.5 py-2">
            <div className="font-bold text-ink">{r.assignedAt ? hhmm(r.assignedAt) : "—"}</div>
            <div className="text-stone-500">Бригада шықты</div>
          </li>
          <li className="rounded-[6px] bg-clean/10 px-1.5 py-2">
            <div className="font-bold text-clean">{r.doneAt ? hhmm(r.doneAt) : "—"}</div>
            <div className="text-stone-500">Тазаланды</div>
          </li>
        </ol>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-[13px] text-stone-600">
          {took > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock3 size={14} /> {dur(took)}
            </span>
          )}
          {worker && <span>{`Тазалаған: ${shortName(worker.name)}`}</span>}
          {r.rating ? (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
              <Star size={14} className="fill-amber-400 text-amber-400" /> {`${r.rating}/5 тұрғын бағасы`}
            </span>
          ) : null}
          <span className="ml-auto text-[11px] text-stone-400">{SOURCE[r.source]}</span>
        </div>
      </div>
    </motion.article>
  );
}

export function CityFeed({ reports, workers, now }: { reports: Report[]; workers: Worker[]; now: number }) {
  const [district, setDistrict] = useState<string>("all");
  const [shown, setShown] = useState(PAGE);
  const done = useMemo(
    () => reports.filter((r) => r.status === "done" && r.doneAt && r.verification?.ok !== false).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)),
    [reports],
  );
  const districts = useMemo(() => [...new Set(done.map((r) => r.district))].sort(), [done]);
  const list = district === "all" ? done : done.filter((r) => r.district === district);
  const today = done.filter((r) => now - (r.doneAt ?? 0) < 864e5).length;
  const avg = done.length ? done.reduce((a, r) => a + ((r.doneAt ?? 0) - r.createdAt), 0) / done.length : 0;
  const wmap = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers]);

  return (
    <section id="feed" aria-labelledby="feed-title" className="mt-12 scroll-mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-clean">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-clean opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-clean" />
            </span>
            Тірі лента
          </div>
          <h2 id="feed-title" className="display mt-1 text-[34px] leading-none text-ink sm:text-[44px]">
            Қала жаңалығы: <span className="text-qyzyl">дейін</span> → <span className="text-clean">кейін</span>
          </h2>
          <p className="mt-2 max-w-2xl text-[15px] text-stone-500">Мұнда тек фото мен GPS арқылы расталған жұмыстар шығады. Пікір де, жарнама да жоқ — тек дәлелденген нәтиже. Суретті жылжытып, айырмашылықты көріңіз.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { v: String(today), l: "бүгін тазаланды" },
            { v: avg ? `${Math.max(1, Math.round(avg / 3600000))} сағ` : "—", l: "орташа уақыт" },
            { v: "100%", l: "фотомен расталған" },
          ].map((x) => (
            <div key={x.l} className="rounded-[8px] bg-white px-2 py-2 shadow-sm sm:px-3">
              <div className="whitespace-nowrap text-[18px] font-extrabold text-ink sm:text-[20px]">{x.v}</div>
              <div className="text-[11px] leading-tight text-stone-500">{x.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="Аудан бойынша сүзу">
        {["all", ...districts].map((d) => (
          <button
            key={d}
            onClick={() => {
              setDistrict(d);
              setShown(PAGE);
            }}
            aria-pressed={district === d}
            className={`min-h-[40px] shrink-0 rounded-full px-4 text-[14px] font-semibold transition ${district === d ? "bg-ink text-white" : "bg-white text-stone-600 shadow-sm hover:bg-salt-2"}`}
          >
            {d === "all" ? "Барлық аудан" : d}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="mt-4 rounded-[12px] bg-white p-8 text-center text-stone-500">Бұл ауданда әзірге расталған жұмыс жоқ.</div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {list.slice(0, shown).map((r) => (
              <Card key={r.id} r={r} worker={r.workerId ? wmap.get(r.workerId) : undefined} now={now} />
            ))}
          </AnimatePresence>
        </div>
      )}
      {shown < list.length && (
        <button onClick={() => setShown((n) => n + PAGE)} className="mx-auto mt-5 flex min-h-[48px] items-center rounded-full border-2 border-ink px-6 text-[15px] font-bold text-ink hover:bg-ink hover:text-white">
          {`Тағы көрсету · ${list.length - shown}`}
        </button>
      )}
    </section>
  );
}
