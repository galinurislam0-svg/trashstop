"use client";
import Link from "next/link";
// Тазалықшы: егде адамға арналған — бір экранда бір негізгі әрекет, ірі әріп, дауыспен оқу, қадамдар.
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Camera,
  Navigation,
  CheckCircle2,
  XCircle,
  Loader2,
  MapPin,
  Clock3,
  Star,
  Heart,
  Trophy,
  ChevronDown,
  Phone,
  Volume2,
  Wrench,
  Route,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { PhoneFrame } from "@/components/PhoneFrame";
import { UserChip, useMe } from "@/components/UserChip";
import { Logo } from "@/components/Logo";
import { Avatar, PhotoBox, Stars } from "@/components/ui";
import { compressImage, getGeo, inCity, post, useCity } from "@/lib/client";
import { demoFile, openParam } from "@/lib/demo";
import { activeCity } from "@/lib/city-client";
import { CATEGORY, distanceM, isOverdue, timeLeft } from "@/lib/meta";
import type { Category, Report, Verification } from "@/lib/types";
import { CitySwitch } from "@/components/CitySwitch";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type GeoMode = "gps" | "onsite" | "away";

/** Не алып бару керек — санатқа қарай нақты кеңес */
const TOOLS: Record<Category, string> = {
  household: "Қаптар мен қолғап жеткілікті",
  bulky: "Жүк көлігі және 2 адам керек",
  construction: "Қаптар мен күрек; көп болса — жүк көлігі",
  container: "Контейнерді босатып, айналасын жинау",
  car: "Пакетті жинап, орнын тазалау",
  tree: "Бұтақ кесетін құрал және су",
  burning: "Су, күрек, құм. Жанып тұрса — алдымен 112",
};

/** 3107 м → «3,1 км»; 872 мин → «14 сағ 32 мин» — қазылар мен тазалықшыға түсінікті */
function fmtDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} км` : `${m} м`;
}
function fmtMin(m: number) {
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} сағ ${m % 60} мин` : `${h} сағ`;
}

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    const ru = document.documentElement.lang === "ru";
    u.lang = ru ? "ru-RU" : "kk-KZ";
    const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith(ru ? "ru" : "kk")) ?? speechSynthesis.getVoices().find((x) => x.lang.startsWith("ru"));
    if (v) u.voice = v;
    u.rate = 0.92;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {}
}


export default function WorkerPage() {
  const { state, refresh } = useCity(3000);
  const [workerId, setWorkerId] = useState<string>("w1");
  const [pickOpen, setPickOpen] = useState(false);
  const [geoMode, setGeoMode] = useState<GeoMode>("onsite");
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const [result, setResult] = useState<{ ok: boolean; v: Verification | null; comment?: string; id: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<Report | null>(null);

  const me = useMe();
  // Нақты тазалықшы — әрқашан нақты GPS. Демо жүргізуші (әкімдік/оператор) — әдепкі «Орнында»,
  // әйтпесе қорғау залынан түсірілген фото шағым нүктесінен алыс деп есептеліп, растаудан өтпейді.
  useEffect(() => {
    if (!me) return;
    getGeo(4000).then((g) => {
      if (inCity(g)) setMyPos(g);
      if (me.role === "worker") setGeoMode("gps");
    });
  }, [me]);
  const isWorker = me?.role === "worker";
  useEffect(() => {
    if (me?.role === "worker" && me.workerId) setWorkerId(me.workerId);
  }, [me]);
  const [picked, setPicked] = useState(false);
  // Демо: оператор жаңа тапсырма бергенде — сол тазалықшыны автоматты көрсетеміз (қолмен таңдалмаса)
  useEffect(() => {
    if (!state || picked || isWorker) return;
    const latest = state.reports
      .filter((r) => r.workerId && (r.status === "assigned" || r.status === "in_progress") && r.assignedAt)
      .sort((a, b) => (b.assignedAt ?? 0) - (a.assignedAt ?? 0))[0];
    if (latest && latest.workerId !== workerId) setWorkerId(latest.workerId!);
  }, [state, picked, workerId, isWorker]);

  const worker = state?.workers.find((w) => w.id === workerId);
  const now = state?.now ?? Date.now();
  // Ретi: орындалып жатқан → мерзімі өткен → мерзімі жақын
  const tasks = useMemo(
    () =>
      (state?.reports ?? [])
        .filter((r) => (isWorker ? r.brigadeId === me!.brigadeId : r.workerId === workerId) && (r.status === "assigned" || r.status === "in_progress"))
        .sort((a, b) => Number(b.status === "in_progress") - Number(a.status === "in_progress") || (a.deadline ?? 0) - (b.deadline ?? 0)),
    [state, workerId, isWorker, me],
  );
  // ?open=TS-1101 — сол тапсырманы бірінші көрсету (демо нұсқаушы)
  const openCode = useRef<string | null | undefined>(undefined);
  if (openCode.current === undefined && typeof window !== "undefined") openCode.current = openParam();
  const opened = openCode.current ? tasks.find((t) => t.code === openCode.current) : undefined;
  const current = tasks.find((t) => t.id === focusId) ?? opened ?? tasks[0] ?? null;
  const rest = tasks.filter((t) => t.id !== current?.id);
  const doneToday = (state?.reports ?? []).filter((r) => r.workerId === workerId && r.status === "done" && r.doneAt && Date.now() - r.doneAt < 864e5).length;
  const workersWithTasks = useMemo(() => {
    const ids = new Set((state?.reports ?? []).filter((r) => r.status === "assigned" || r.status === "in_progress").map((r) => r.workerId));
    return (state?.workers ?? []).filter((w) => ids.has(w.id) || w.id === "w1");
  }, [state]);

  async function start(r: Report) {
    setBusyId(r.id);
    await post(`/api/reports/${r.id}`, { action: "start" }).catch(() => {});
    await refresh();
    setBusyId(null);
  }

  function shoot(r: Report) {
    target.current = r;
    fileRef.current?.click();
  }

  async function onPhoto(f: File | undefined) {
    const r = target.current;
    if (!f || !r) return;
    setBusyId(r.id);
    try {
      const photo = await compressImage(f);
      let loc: { lat: number; lng: number } | null = null;
      if (geoMode === "gps") loc = await getGeo();
      if (geoMode === "onsite" || (geoMode === "gps" && !loc)) loc = { lat: r.lat + 0.0002, lng: r.lng - 0.0002 };
      if (geoMode === "away") loc = { lat: r.lat + 0.021, lng: r.lng + 0.026 };
      const ai = await post<{ clean: boolean; same_place: boolean; comment: string }>("/api/ai/verify", { photo, reportId: r.id }).catch(() => null);
      const res = await post<{ ok: boolean; verification: Verification }>(`/api/reports/${r.id}`, {
        action: "complete",
        photo,
        lat: loc?.lat,
        lng: loc?.lng,
        aiClean: ai ? ai.clean : null,
      });
      setResult({ ok: res.verification?.ok ?? false, v: res.verification, comment: ai?.comment, id: r.id });
      if (res.verification?.ok) setFocusId(null);
      await refresh();
    } catch {
      setResult({ ok: false, v: null, comment: "Желі қатесі, қайталап көріңіз", id: r.id });
    } finally {
      setBusyId(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const bonusPct = worker ? Math.min(100, Math.round((worker.rating / 5) * 60 + worker.onTimePct * 0.4)) : 0;
  const today = new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });

  return (
    <PhoneFrame
      title="Тазалықшы"
      path="/worker"
      points={["Бір экранда бір әрекет: ірі батырма, мәтін аз", "Не алып бару керегі мен қашықтығы көрсетіледі", "Жұмыс фото мен геоорын арқылы расталады", "Тұрғындардың алғысы айлық бонусқа әсер етеді"]}
    >
      <main id="main" className="a11y-zoom light-page min-h-dvh">
        <h1 className="sr-only">Тазалықшының бүгінгі тапсырмалары</h1>
        <div className="frame-pad mx-auto max-w-md px-4 pb-10">
          <header className="in-frame-hide flex items-center justify-between gap-2 py-3">
            <Logo light sub="Тазалықшы" />
            <span className="flex items-center gap-1.5">
              <CitySwitch variant="light" compact />
              <UserChip light compact />
            </span>
          </header>

          {/* Сәлемдесу + бүгінгі қорытынды */}
          {worker && (
            <section className="relative overflow-hidden rounded-[24px] bg-ink p-5 text-salt">
              <button onClick={() => !isWorker && setPickOpen((o) => !o)} className="flex w-full items-center gap-3 text-left" aria-expanded={pickOpen}>
                <Avatar name={worker.name} size={56} ring="rgba(255,255,255,.5)" />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium text-white/80">Сәлеметсіз бе,</div>
                  <div className="truncate text-[26px] font-extrabold leading-tight">{worker.name.split(" ")[0]} 👋</div>
                </div>
                {!isWorker && <ChevronDown size={22} className="text-white/70" />}
              </button>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  [tasks.length, "тапсырма"],
                  [doneToday, "бүгін бітті"],
                ].map(([v, l]) => (
                  <div key={l as string} className="rounded-[10px] bg-white/10 py-3">
                    <div className="text-[32px] font-extrabold leading-none">{v}</div>
                    <div className="mt-1 text-[13px] font-semibold text-white/80">{l}</div>
                  </div>
                ))}
                <div className="rounded-[10px] bg-white/10 py-3">
                  <div className="flex items-center justify-center gap-1 text-[32px] font-extrabold leading-none">
                    {worker.rating.toFixed(1)}
                    <Star size={18} className="fill-white" />
                  </div>
                  <div className="mt-1 text-[13px] font-semibold text-white/80">рейтинг</div>
                </div>
              </div>
              {pickOpen && (
                <div className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-[10px] bg-white p-1.5 text-stone-800">
                  {workersWithTasks.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => {
                        setWorkerId(w.id);
                        setPicked(true);
                        setPickOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-[6px] px-2 py-2 text-left text-[15px] hover:bg-stone-50"
                    >
                      <Avatar name={w.name} size={30} /> {w.name}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── ҚАЗІРГІ ТАПСЫРМА ── */}
          {current ? (
            <CurrentTask
              key={current.id}
              r={current}
              now={now}
              myPos={myPos}
              busy={busyId === current.id}
              onStart={() => start(current)}
              onShoot={() => shoot(current)}
              onDemo={async () => {
                target.current = current;
                await onPhoto(await demoFile("/demo/p23.jpg", "after.jpg"));
              }}
            />
          ) : (
            <section className="mt-5 rounded-[24px] bg-white p-8 text-center shadow-sm">
              <div className="text-6xl">🎉</div>
              <div className="mt-3 text-[22px] font-extrabold text-ink">{isWorker ? "Бригадаңызға жаңа тапсырма жоқ" : "Барлығы орындалды!"}</div>
              <div className="mt-1 text-[16px] text-stone-500">Жаңа тапсырма келсе, осы жерде пайда болады</div>
              <a href="tel:109" className="mx-auto mt-5 flex h-14 max-w-xs items-center justify-center gap-2 rounded-[12px] border-2 border-ink text-[17px] font-bold text-ink">
                <Phone size={20} /> Операторға қоңырау
              </a>
            </section>
          )}

          {/* ── КЕЛЕСІ ТАПСЫРМАЛАР ── */}
          {rest.length > 0 && (
            <section className="mt-6" aria-label="Келесі тапсырмалар">
              <h2 className="display text-[28px] text-ink">Келесі тапсырмалар · {rest.length}</h2>
              <ul className="mt-3 space-y-2.5">
                {rest.map((r) => {
                  const over = isOverdue(r, now);
                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => {
                          setFocusId(r.id);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="flex w-full items-center gap-3 rounded-[16px] bg-white p-3 text-left shadow-sm transition active:scale-[0.99]"
                      >
                        <PhotoBox src={r.photo} category={r.category} className="h-16 w-16 shrink-0 rounded-[10px]" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[17px] font-extrabold text-ink">{r.source === "plan" ? r.description.split(":")[0] : `${CATEGORY[r.category].emoji} ${CATEGORY[r.category].short}`}</span>
                          <span className="block truncate text-[15px] font-semibold text-stone-600">{r.address}</span>
                          {r.deadline && <span className={`block text-[14px] font-bold ${over ? "text-qyzyl" : "text-stone-500"}`}>{timeLeft(r.deadline, now)}</span>}
                        </span>
                        <ArrowRight size={22} className="shrink-0 text-stone-400" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />

          {/* ── АЙЛЫҚ БОНУС ── */}
          {worker && (
            <section className="mt-6 rounded-[24px] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 display text-[26px] text-ink">
                <Trophy size={22} className="text-amber-500" /> Айлық бонус
              </div>
              <div className="mt-1 text-[15px] text-stone-500">Тұрғындардың бағасы мен уақтылы орындау бойынша</div>
              <div className="mt-3 h-5 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuenow={bonusPct} aria-valuemin={0} aria-valuemax={100}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${bonusPct}%` }} className="h-full rounded-full bg-qyzyl" />
              </div>
              <div className="mt-2 flex justify-between text-[16px] font-bold">
                <span className="text-stone-700">{bonusPct}%</span>
                <span className="text-qyzyl">{bonusPct >= 90 ? "Бонусқа лайық! 🎉" : "Аз қалды!"}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-[12px] bg-rose-50 p-3">
                  <Heart size={20} className="text-rose-500" />
                  <div className="mt-1 text-[26px] font-extrabold text-ink">{worker.thanks}</div>
                  <div className="text-[13px] font-semibold text-stone-500">тұрғыннан алғыс</div>
                </div>
                <div className="rounded-[12px] bg-amber-50 p-3">
                  <Stars value={worker.rating} size={15} />
                  <div className="mt-1 text-[26px] font-extrabold text-ink">{worker.ratingsCount}</div>
                  <div className="text-[13px] font-semibold text-stone-500">баға алынды</div>
                </div>
              </div>
            </section>
          )}

          <Link href="/truckcam" className="mt-6 flex min-h-[56px] items-center justify-center gap-2 rounded-[12px] border-2 border-ink text-[16px] font-bold text-ink active:scale-[0.98]">
            🚛 Көлік камерасы · ЖИ сканер
          </Link>

          {/* Демо баптауы: тек таныстырылымға (нақты жұмыста GPS қолданылады) */}
          <details className="mt-6 rounded-[12px] border border-dashed border-stone-300 p-3 text-[13px] text-stone-500">
            <summary className="cursor-pointer font-semibold">Демо баптауы · орынды көрсету</summary>
            <div className="mt-2 flex gap-1.5" role="group" aria-label="Демо орын">
              {(
                [
                  ["gps", "GPS"],
                  ["onsite", "Орнында"],
                  ["away", "Басқа жер"],
                ] as [GeoMode, string][]
              ).map(([k, l]) => (
                <button key={k} onClick={() => setGeoMode(k)} aria-pressed={geoMode === k} className={`flex-1 rounded-full px-2 py-2 font-semibold ${geoMode === k ? "bg-ink text-white" : "bg-white text-stone-600"}`}>
                  {l}
                </button>
              ))}
            </div>
          </details>
        </div>

        {/* ── НӘТИЖЕ ── */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center">
              <motion.div initial={{ y: 40, scale: 0.96 }} animate={{ y: 0, scale: 1 }} role="dialog" aria-modal="true" className="w-full max-w-md rounded-[28px] bg-white p-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 240, damping: 14 }}
                  className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full text-white ${result.ok ? "bg-clean" : "bg-qyzyl"}`}
                >
                  {result.ok ? <CheckCircle2 size={54} /> : <XCircle size={54} />}
                </motion.div>
                <div className="mt-5 text-[26px] font-extrabold leading-tight text-ink">{result.ok ? "Рақмет! Жұмыс расталды" : "Растау өтпеді"}</div>
                {result.comment && <div className="mt-2 text-[15px] text-stone-500">ЖИ: {result.comment}</div>}
                {result.v && (
                  <div className="mt-4 space-y-2 text-left text-[15px]">
                    <Row ok={result.v.distanceM <= 100} text={`Орны: шағым нүктесінен ${fmtDist(result.v.distanceM)}`} />
                    <Row ok={result.v.aiClean !== false} text={result.v.aiClean === false ? "ЖИ: қоқыс әлі көрініп тұр" : "ЖИ: аумақ таза"} />
                    <Row ok text={`Уақыты: тағайындаудан кейін ${fmtMin(result.v.minutesAfterAssign)}`} />
                  </div>
                )}
                {result.ok ? (
                  <div className="mt-4 rounded-[12px] bg-amber-50 p-3 text-[15px] font-bold text-amber-800">+1 орындалды · бонусқа үлес қосылды ⭐</div>
                ) : (
                  <div className="mt-4 rounded-[12px] bg-qyzyl/10 p-3 text-[15px] font-semibold text-qyzyl-2">Тапсырма жабылмады. Оқиға орнына барып, қайта түсіріңіз.</div>
                )}
                <div className="mt-5 grid gap-2">
                  {!result.ok && (
                    <button
                      onClick={() => {
                        const r = state?.reports.find((x) => x.id === result.id);
                        setResult(null);
                        if (r) shoot(r);
                      }}
                      className="flex h-16 items-center justify-center gap-2 rounded-[14px] bg-qyzyl text-[20px] font-extrabold text-white"
                    >
                      <RotateCcw size={22} /> Қайта түсіру
                    </button>
                  )}
                  <button onClick={() => setResult(null)} className={`h-14 rounded-[14px] text-[18px] font-bold ${result.ok ? "bg-ink text-white" : "bg-stone-100 text-stone-700"}`}>
                    {result.ok && rest.length ? "Келесі тапсырмаға өту" : "Жарайды"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </PhoneFrame>
  );
}

/** Қазіргі тапсырма: қадамдар, фото, мекенжай, қашықтық, не алу керек, бір үлкен батырма */
function CurrentTask({
  r,
  now,
  myPos,
  busy,
  onStart,
  onShoot,
  onDemo,
}: {
  r: Report;
  now: number;
  myPos: { lat: number; lng: number } | null;
  busy: boolean;
  onStart: () => void;
  onShoot: () => void;
  onDemo: () => void;
}) {
  const over = isOverdue(r, now);
  const step = r.status === "assigned" ? 0 : 1; // 0: жолға шығу, 1: орында — фото
  const dist = myPos ? distanceM(myPos, r) : null;
  // Не істеу керек: жоспарлы күтім тапсырмасында — маманның нұсқауы, әйтпесе ЖИ сипаттамасы немесе тұрғынның сөзі
  const what = r.source === "plan" ? r.description : r.ai?.summary || (r.description && r.description !== CATEGORY[r.category].label ? r.description : "");
  const say = `${CATEGORY[r.category].label}. ${what ? what + ". " : ""}${r.address}. ${r.deadline ? timeLeft(r.deadline, now) : ""}. ${TOOLS[r.category]}.`;
  return (
    <section className="mt-5 overflow-hidden rounded-[24px] bg-white shadow-[0_12px_40px_-20px_rgba(0,0,0,.35)]" aria-label="Қазіргі тапсырма">
      {/* қадамдар */}
      <ol className="grid grid-cols-3 border-b border-stone-100 text-center text-[13px] font-bold" aria-label="Тапсырма қадамдары">
        {["Жолға шығу", "Орында фото", "Дайын"].map((t, i) => (
          <li key={t} aria-current={i === step ? "step" : undefined} className={`flex items-center justify-center gap-1.5 py-3 ${i === step ? "bg-ink text-white" : i < step ? "text-clean" : "text-stone-400"}`}>
            {i < step ? <CheckCircle2 size={16} /> : <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${i === step ? "bg-white text-ink" : "bg-stone-200 text-stone-500"}`}>{i + 1}</span>}
            {t}
          </li>
        ))}
      </ol>

      <div className="relative">
        <PhotoBox src={r.photo} category={r.category} className="aspect-[16/9] w-full" />
        <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-[13px] font-bold text-white backdrop-blur">Қазіргі тапсырма · {r.code}</span>
        {r.deadline && (
          <span className={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[15px] font-extrabold ${over ? "bg-qyzyl text-white" : "bg-white text-ink"}`}>
            <Clock3 size={16} /> {timeLeft(r.deadline, now)}
          </span>
        )}
        <button onClick={() => speak(say)} aria-label="Дауыстап оқу" className="absolute right-3 top-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink shadow-lg">
          <Volume2 size={22} />
        </button>
      </div>

      <div className="space-y-3 p-4">
        <div className="text-[24px] font-extrabold leading-tight text-ink">
          {CATEGORY[r.category].emoji} {CATEGORY[r.category].label}
        </div>
        {what && <div className={r.source === "plan" ? "rounded-[12px] bg-clean/10 px-3 py-2.5 text-[19px] font-bold leading-snug text-clean" : "text-[16px] leading-snug text-stone-600"}>{what}</div>}
        <div className="flex items-start gap-2 text-[19px] font-bold leading-snug text-ink">
          <MapPin size={22} className="mt-0.5 shrink-0 text-qyzyl" /> {r.address}
        </div>
        <div className="grid grid-cols-2 gap-2 text-[15px]">
          <div className="flex items-center gap-2 rounded-[12px] bg-salt px-3 py-2.5 font-semibold text-stone-700">
            <Route size={18} className="shrink-0" /> {dist !== null ? fmtDist(dist) : r.district}
          </div>
          <div className="flex items-center gap-2 rounded-[12px] bg-salt px-3 py-2.5 font-semibold text-stone-700">
            <Wrench size={18} className="shrink-0" /> <span className="leading-tight">{TOOLS[r.category]}</span>
          </div>
        </div>

        {/* шағын карта */}
        <div className="h-36 overflow-hidden rounded-[14px] border border-stone-200">
          <MapView theme="light" points={[]} pin={{ lat: r.lat, lng: r.lng }} focus={{ lat: r.lat, lng: r.lng, zoom: 16, key: r.id }} zoom={16} controls={false} interactive={false} />
        </div>

        {/* бір негізгі әрекет */}
        {step === 0 ? (
          <button
            onClick={onStart}
            disabled={busy}
            className="flex h-[72px] w-full items-center justify-center gap-3 rounded-[16px] bg-ink text-[22px] font-extrabold text-salt active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? <Loader2 className="animate-spin" /> : <Navigation size={28} />} Жолға шықтым
          </button>
        ) : (
          <button
            onClick={onShoot}
            disabled={busy}
            className="flex h-[72px] w-full items-center justify-center gap-3 rounded-[16px] bg-qyzyl text-[22px] font-extrabold text-white active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="animate-spin" /> ЖИ тексеріп жатыр…
              </>
            ) : (
              <>
                <Camera size={28} /> Орындалды — фото
              </>
            )}
          </button>
        )}
        {step === 1 && !busy && (
          <button type="button" onClick={onDemo} className="w-full text-center text-[14px] font-bold text-ink underline decoration-dashed underline-offset-4">
            Фото жоқ па? Демо: таза жер фотосымен
          </button>
        )}
        <p className="text-center text-[14px] text-stone-500">{step === 0 ? "Орынға барғанда, жұмысты бітіріп, фото түсіресіз" : "Тазалаған жерді шағымдағыдай бұрыштан түсіріңіз"}</p>

        <div className="grid grid-cols-3 gap-2">
          <a
            href={`https://2gis.kz/${activeCity().id}/directions/points/%7C${r.lng}%2C${r.lat}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-14 flex-col items-center justify-center rounded-[12px] bg-[#e8f5e0] text-[14px] font-bold text-[#1f6b2a]"
          >
            <MapPin size={18} /> 2GIS
          </a>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-14 flex-col items-center justify-center rounded-[12px] bg-stone-100 text-[14px] font-bold text-stone-700"
          >
            <MapPin size={18} /> Google
          </a>
          <a href="tel:109" className="flex h-14 flex-col items-center justify-center rounded-[12px] bg-stone-100 text-[14px] font-bold text-stone-700">
            <Phone size={18} /> Оператор
          </a>
        </div>
      </div>
    </section>
  );
}

function Row({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-[10px] px-3 py-2.5 ${ok ? "bg-emerald-50 text-clean" : "bg-qyzyl/10 text-qyzyl-2"}`}>
      {ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />} <span className="font-semibold">{text}</span>
    </div>
  );
}
