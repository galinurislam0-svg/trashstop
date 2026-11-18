"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, MapPin, Sparkles, Send, CheckCircle2, ChevronRight, Award, Heart, Car, ImagePlus, X, Clock3, Loader2, Truck, Flame, Phone } from "lucide-react";
import { PhoneFrame } from "@/components/PhoneFrame";
import { UserChip } from "@/components/UserChip";
import { Logo } from "@/components/Logo";
import { TruckWhere } from "@/components/TruckWhere";
import { Avatar, PhotoBox, Stars, StatusPill } from "@/components/ui";
import { approxAddress, compressImage, getBestGeo, inCity, post, readExifGps, reverseGeocode, searchAddress, useCity, type GeoAddress } from "@/lib/client";
import { CATEGORY, HAZARD, LEGAL_TERM, VOLUME, fmtTime, timeAgo } from "@/lib/meta";
import { useCityConf } from "@/components/CityProvider";
import { activeCity } from "@/lib/city-client";
import { demoFile, rememberDemoSrc, rememberTourCode } from "@/lib/demo";
import type { AiResult, Category, Report } from "@/lib/types";
import { CitySwitch } from "@/components/CitySwitch";

import MapView from "@/components/LazyMap";

type Step = "home" | "analyzing" | "review" | "sent";
type LocInfo =
  | { src: "locating" }
  | { src: "exif" }
  | { src: "gps"; acc: number }
  | { src: "map" }
  | { src: "search" }
  | { src: "none"; why: "denied" | "outside" | "nosignal" };
const MY_KEY = "trashstop.my";

function loadMine(): string[] {
  try {
    return JSON.parse(localStorage.getItem(MY_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveMine(ids: string[]) {
  try {
    localStorage.setItem(MY_KEY, JSON.stringify(ids.slice(0, 50)));
  } catch {}
}

export default function CitizenPage() {
  const city = useCityConf();
  const { state, refresh } = useCity(3000, { trees: false });
  const [tab, setTab] = useState<"report" | "mine" | "truck" | "thanks">("report");
  const [step, setStep] = useState<Step>("home");
  const [mode, setMode] = useState<"trash" | "burning" | "car">("trash");
  const [photo, setPhoto] = useState<string | null>(null);
  const [ai, setAi] = useState<(AiResult & { is_trash?: boolean }) | null>(null);
  const [category, setCategory] = useState<Category>("household");
  const [catPicked, setCatPicked] = useState(false);
  const [quality, setQuality] = useState<string | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsReal, setGpsReal] = useState(false);
  const [addr, setAddr] = useState<GeoAddress | null>(null);
  const [addrBusy, setAddrBusy] = useState(false);
  const [locInfo, setLocInfo] = useState<LocInfo>({ src: "locating" });
  const locSrc = useRef<LocInfo["src"]>("locating");
  function setLoc(l: LocInfo) {
    locSrc.current = l.src;
    setLocInfo(l);
  }
  // GPS: фото талдауын күттірмей, қатар анықталады. Тұрғын картадан/іздеуден таңдап үлгерсе — оның таңдауы басым.
  async function locate() {
    setLoc({ src: "locating" });
    const g = await getBestGeo(6000);
    if (locSrc.current === "map" || locSrc.current === "search" || locSrc.current === "exif") return;
    if ("error" in g) return setLoc({ src: "none", why: g.error === "denied" ? "denied" : "nosignal" });
    if (!inCity(g)) return setLoc({ src: "none", why: "outside" });
    setLoc({ src: "gps", acc: g.acc });
    setPos({ lat: g.lat, lng: g.lng });
    setGpsReal(true);
    lookup(g);
  }
  const geoSeq = useRef(0);
  const noLoc = locInfo.src === "none" || locInfo.src === "locating"; // геонүктесіз өтініш қабылданбайды

  // Нүктеден нақты мекенжай: көше + үй нөмірі (соңғы сұраудың жауабы ғана қабылданады)
  async function lookup(p: { lat: number; lng: number }) {
    const my = ++geoSeq.current;
    setAddrBusy(true);
    const a = await reverseGeocode(p.lat, p.lng);
    if (my !== geoSeq.current) return;
    setAddr(a);
    setAddrBusy(false);
  }
  function movePin(p: { lat: number; lng: number }) {
    setPos(p);
    setGpsReal(true);
    setLoc({ src: "map" });
    lookup(p);
  }
  const [desc, setDesc] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ code: string; mergedInto: string | null } | null>(null);
  const [mine, setMine] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMine(loadMine());
    const qt = new URLSearchParams(location.search).get("tab");
    if (qt === "mine" || qt === "truck") setTab(qt);
  }, []);

  // Менің шағымдарым — аккаунтқа байланған (сервер «mine» белгісін қояды)
  const myReports = useMemo(() => (state?.reports ?? []).filter((r) => (r as Report & { mine?: boolean }).mine || mine.includes(r.id)), [state, mine]);
  // Таңдалған нүктенің маңындағы ашық шағымдар (қайталауды азайту үшін картада көрінеді)
  const nearby = useMemo(
    () =>
      (state?.reports ?? [])
        .filter((r) => r.status !== "done" && r.status !== "rejected")
        .map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, color: "#e2231a", size: 5, label: r.description, sub: `${r.code} · бұрыннан тіркелген` })),
    [state],
  );
  const points = myReports.length * 10 + myReports.filter((r) => r.status === "done").length * 15;

  // Демо фото қайдан алынды (кейін тазалықшыға сәйкес «кейін» фотосын беру үшін)
  const demoSrc = useRef<string | null>(null);
  async function onFile(f: File | undefined, demo: string | false = false) {
    if (!f) return;
    demoSrc.current = demo || null;
    setErr(null);
    setStep("analyzing");
    try {
      // Фото, оның EXIF координатасы және телефон GPS-і — қатар
      setCatPicked(false);
      const [img, exif] = await Promise.all([compressImage(f), readExifGps(f)]);
      setQuality(await photoQuality(img));
      setPhoto(img);
      setAddr(null);
      if (demo) {
        // Демо фото: орын — қаланың демо нүктесі (геолокацияға рұқсат бермеген адам да соңына дейін өте алады; картадан өзгертуге болады)
        const d = activeCity().demoPoint;
        setLoc({ src: "map" });
        setPos(d);
        setGpsReal(false);
        lookup(d);
      } else if (inCity(exif)) {
        // Фотоның өз координатасы — ең сенімді дерек (түсірілген жер)
        setLoc({ src: "exif" });
        setPos(exif!);
        setGpsReal(true);
        lookup(exif!);
      } else {
        // Әзірге қала орталығы, GPS табылғанда нақты нүктеге ауысады
        setPos({ lat: activeCity().center[1], lng: activeCity().center[0] });
        setGpsReal(false);
        locate();
      }
      const res = await post<AiResult & { is_trash: boolean }>("/api/ai/analyze", { photo: img, hint: mode === "trash" ? undefined : mode });
      setAi(res);
      setCategory(res.category);
      setDesc(res.summary || "");
      setStep("review");
    } catch (e) {
      setErr((e as Error).message);
      setStep("home");
    }
  }

  async function send() {
    if (!pos) return;
    setSending(true);
    try {
      const res = await post<{ id: string; code: string; mergedInto: string | null }>("/api/reports", {
        lat: pos.lat,
        lng: pos.lng,
        address: addr?.address ?? (locInfo.src === "none" || locInfo.src === "locating" ? `${city.name} (орны нақтыланбаған)` : approxAddress(pos.lat, pos.lng)),
        description: desc,
        category,
        photo,
        ai: ai ? { ...ai, category } : null,
        plate: ai?.plate ?? null,
        source: "app",
      });
      const next = [res.id, ...mine.filter((x) => x !== res.id)];
      setMine(next);
      saveMine(next);
      rememberTourCode(res.mergedInto ?? res.code);
      if (demoSrc.current && !res.mergedInto) rememberDemoSrc(res.code, demoSrc.current);
      setSent({ code: res.mergedInto ?? res.code, mergedInto: res.mergedInto });
      setStep("sent");
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setAddr(null);
    setStep("home");
    setPhoto(null);
    setAi(null);
    setDesc("");
    setSent(null);
    setErr(null);
  }

  return (
    <PhoneFrame title="Тұрғын" path="/citizen" points={["Камераны ашып, қоқысты суретке түсіресіз", "ЖИ түрін, көлемін және қауіптілігін анықтайды", "Шағымның жолын бақылап, тазалықшыны бағалайсыз"]}>
    <main id="main" className="a11y-zoom light-page min-h-dvh">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col">
        <header className="frame-end sticky top-0 z-20 flex items-center justify-between bg-salt/90 px-4 py-3 backdrop-blur">
          <span className="in-frame-hide">
            <Logo light sub="Тұрғын" />
          </span>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#fbfaf7] px-2.5 py-1.5 text-xs font-bold text-qyzyl shadow-sm">
              <Award size={14} /> {points}<span className="hidden min-[400px]:inline"> ұпай</span>
            </div>
            <CitySwitch variant="light" compact />
            <span className="in-frame-hide">
              <UserChip light compact />
            </span>
          </div>
        </header>

        <div className="flex-1 px-4 pb-28">
          {tab === "report" && <Stepper current={step === "home" ? 0 : step === "analyzing" ? 1 : step === "review" ? 2 : 3} />}
          {tab === "report" && (
            <AnimatePresence mode="wait">
              {step === "home" && (
                <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <h1 className="display mt-3 text-[38px] leading-[0.92] text-ink">
                    Қоқыс көрдіңіз бе?
                    <br />
                    <span className="text-qyzyl">Бір фото жеткілікті.</span>
                  </h1>
                  <p className="mt-2 text-sm text-stone-500">ЖИ түрін, көлемін және орнын өзі анықтайды. Сіз тек түсіресіз.</p>

                  <div className="mt-5 grid grid-cols-3 gap-1.5 rounded-[6px] bg-[#fbfaf7] p-1.5 shadow-sm">
                    {[
                      { id: "trash" as const, l: "Қоқыс", i: ImagePlus },
                      { id: "burning" as const, l: "Түтін, өртеу", i: Flame },
                      { id: "car" as const, l: "Көліктен", i: Car },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-[4px] px-1 py-2 text-[13px] font-semibold leading-tight transition sm:flex-row sm:gap-2 ${mode === m.id ? "bg-ink text-white" : "text-stone-500"}`}
                      >
                        <m.i size={16} /> {m.l}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      const src = mode === "burning" ? "/demo/p15.jpg" : mode === "car" ? "/demo/p09.jpg" : "/demo/p30.jpg";
                      onFile(await demoFile(src), src);
                    }}
                    className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-ink/25 bg-white px-4 text-[15px] font-bold text-ink transition hover:border-ink/60"
                  >
                    <ImagePlus size={18} /> Фото жоқ па? Демо фотомен байқау
                  </button>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="group relative mt-4 flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-[32px] bg-qyzyl text-white transition active:scale-[0.98]"
                  >
                                        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-[#fbfaf7]/20 ring-8 ring-white/10 transition group-hover:scale-105">
                      <Camera size={44} strokeWidth={1.8} />
                    </div>
                    <div className="display relative mt-5 text-[34px]">{mode === "car" ? "Көлікті түсіру" : mode === "burning" ? "Түтінді түсіру" : "Қоқыс көрдім"}</div>
                    <div className="relative mt-1 text-sm text-white/85">{mode === "car" ? "Нөмірі көрінетіндей түсіріңіз" : mode === "burning" ? "От пен түтін көрінетіндей түсіріңіз" : "Камераны ашу үшін басыңыз"}</div>
                  </button>
                  {mode === "burning" && <FireAlert />}
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

                  {err && <div className="mt-3 rounded-[4px] bg-red-50 px-4 py-3 text-sm text-red-600">{err}</div>}

                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                    {[
                      { n: "1", t: "Түсіресіз" },
                      { n: "2", t: "ЖИ талдайды" },
                      { n: "3", t: "Бригада шығады" },
                    ].map((s) => (
                      <div key={s.n} className="rounded-[6px] bg-[#fbfaf7] px-2 py-3 shadow-sm">
                        <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-salt-2 text-sm font-bold text-qyzyl">{s.n}</div>
                        <div className="mt-1.5 text-xs font-semibold text-stone-600">{s.t}</div>
                      </div>
                    ))}
                  </div>

                  <a href="/family" className="mt-4 flex items-center gap-3 rounded-[16px] bg-clean p-4 text-white shadow-sm active:scale-[0.99]">
                    <span className="text-[34px] leading-none">👨‍👩‍👧</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-extrabold">Таза ұрпақ</span>
                      <span className="block text-[13px] leading-snug text-white/85">Балаңызға аула тазалау тапсырмасын беріңіз — ол еңбекпен ақша табады</span>
                    </span>
                    <ChevronRight size={22} />
                  </a>
                </motion.div>
              )}

              {step === "analyzing" && (
                <motion.div key="an" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-ink">
                    {photo ? <img src={photo} alt="" className="h-full w-full object-cover opacity-80" /> : <div className="h-full w-full bg-gradient-to-br from-stone-800 to-stone-900" />}
                    <div className="scanline" />
                    <div className="absolute inset-0 grid-bg opacity-60" />
                    <div className="absolute inset-x-4 bottom-4 rounded-[6px] bg-black/55 px-4 py-3 text-white backdrop-blur">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Loader2 size={16} className="animate-spin text-qyzyl" /> ЖИ фотоны талдап жатыр…
                      </div>
                      <div className="mt-1 text-xs text-white/70">Түрі · көлемі · қауіптілігі · орны</div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === "review" && ai && pos && (
                <motion.div key="rv" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 space-y-3">
                  <div className="relative overflow-hidden rounded-[28px] bg-[#fbfaf7] shadow-sm">
                    <div className="relative aspect-[16/11]">
                      {photo && <img src={photo} alt="" className="h-full w-full object-cover" />}
                      <button onClick={reset} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">
                        <X size={16} />
                      </button>
                      {!ai.demo && !ai.needsRetake && (
                        <div className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow ${ai.confidence < 0.6 ? "bg-amber-600" : "bg-ink"}`}>
                          <Sparkles size={13} /> ЖИ · {Math.round(ai.confidence * 100)}% {ai.confidence < 0.6 ? "· тексеріңіз" : "сенімді"}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      {quality && !ai.needsRetake && <div className="mb-2.5 rounded-[6px] bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">⚠️ {quality}</div>}
                      {ai.needsRetake ? (
                        <div className="rounded-[6px] bg-amber-50 p-3">
                          <div className="text-[15px] font-bold text-amber-800">Фотода қоқыс анықталмады</div>
                          <div className="mt-1 text-[13px] text-amber-800">{ai.retakeReason || "Қоқыс анық көрінетіндей, жарықта қайта түсіріңіз."}</div>
                          <button onClick={() => fileRef.current?.click()} className="mt-2.5 rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-white">
                            Қайта түсіру
                          </button>
                        </div>
                      ) : ai.demo ? (
                        <div className="rounded-[6px] bg-amber-50 p-3 text-[13px] text-amber-800">
                          <b>ЖИ қазір қолжетімсіз.</b> Ойдан шығармау үшін автоматты анықтамадық: төменнен қоқыстың түрін өзіңіз таңдаңыз.
                        </div>
                      ) : (
                        <>
                          <div className="text-[15px] font-bold text-ink">{ai.summary}</div>
                          {!!ai.items?.length && (
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {ai.items.map((it) => (
                                <span key={it} className="rounded-full bg-salt-2 px-2.5 py-1 text-[11px] font-semibold text-ink">
                                  {it}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <Metric label="Түрі" value={CATEGORY[category].short} color={CATEGORY[category].color} />
                            <Metric label="Көлемі" value={ai.volumeM3 ? `≈${ai.volumeM3.toLocaleString("ru-RU")} м³` : VOLUME[ai.volume]} />
                            <Metric label="Қауіп" value={HAZARD[ai.hazard]} color={ai.hazard === "high" ? "#ef4444" : undefined} />
                          </div>
                          {ai.reason && <div className="mt-2.5 text-[12px] leading-snug text-stone-500">💡 {ai.reason}</div>}
                        </>
                      )}
                      {ai.plate && (
                        <div className="mt-3 flex items-center justify-between rounded-[4px] bg-rose-50 px-3 py-2.5">
                          <span className="text-xs font-semibold text-rose-600">Көлік нөмірі анықталды</span>
                          <span className="rounded-md border-2 border-stone-800 bg-[#fbfaf7] px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-ink blur-[3px]">{ai.plate}</span>
                        </div>
                      )}
                      {ai.plate && <div className="mt-1 text-[11px] text-stone-400">Нөмір тек инспекторға көрінеді. Айыппұл туралы шешімді адам қабылдайды.</div>}

                    </div>
                  </div>

                  {category === "burning" && <FireAlert />}

                  <div className="rounded-[24px] bg-[#fbfaf7] p-3 shadow-sm">
                    <div className={`mb-2 px-1 text-xs font-semibold uppercase tracking-wider ${ai.demo ? "text-qyzyl" : "text-stone-400"}`}>{ai.demo ? "Қоқыстың түрін таңдаңыз" : "ЖИ қателессе — түзетіңіз"}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(CATEGORY) as Category[]).map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            setCategory(c);
                            setCatPicked(true);
                          }}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${category === c ? "bg-ink text-white" : "bg-stone-100 text-stone-600"}`}
                        >
                          {CATEGORY[c].emoji} {CATEGORY[c].short}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[24px] bg-[#fbfaf7] shadow-sm">
                    <div className="flex items-start gap-2.5 px-4 pt-3.5">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-qyzyl text-white">
                        <MapPin size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        {addrBusy && !addr ? (
                          <div className="space-y-1.5 pt-1">
                            <div className="h-4 w-3/4 animate-pulse rounded bg-stone-200" />
                            <div className="h-3 w-1/2 animate-pulse rounded bg-stone-200" />
                          </div>
                        ) : (
                          <>
                            <div className={`text-[16px] font-bold leading-snug text-ink transition-opacity ${addrBusy ? "opacity-50" : ""}`}>
                              {addr?.address ?? (locInfo.src === "locating" ? "Орын анықталуда…" : locInfo.src === "none" ? "Орын әлі көрсетілмеді" : approxAddress(pos.lat, pos.lng))}
                            </div>
                            <div className="mt-0.5 text-[12px] text-stone-500">{[addr?.area, addr?.city ?? city.name].filter(Boolean).join(" · ")}</div>
                          </>
                        )}
                      </div>
                    </div>
                    <LocationBar
                      info={locInfo}
                      onRelocate={locate}
                      onPick={(p) => {
                        setPos(p);
                        setGpsReal(true);
                        setLoc({ src: "search" });
                        lookup(p);
                      }}
                    />
                    <div className="h-44">
                      <MapView theme="light" points={nearby} pin={pos} focus={{ ...pos, zoom: 15 }} zoom={15} onMapClick={movePin} geolocate basemapSwitch />
                    </div>
                  </div>

                  <textarea
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-[20px] bg-[#fbfaf7] px-4 py-3 text-sm text-stone-800 shadow-sm outline-none ring-ink focus:ring-2"
                    placeholder="Қосымша ақпарат (міндетті емес)"
                  />
                  {err && <div className="rounded-[4px] bg-red-50 px-4 py-3 text-sm text-red-600">{err}</div>}
                </motion.div>
              )}

              {step === "sent" && sent && (
                <motion.div key="sent" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                  <Receipt
                    code={sent.code}
                    merged={!!sent.mergedInto}
                    category={category}
                    address={addr?.address ?? (locInfo.src === "none" || locInfo.src === "locating" ? `${city.name} (орны нақтыланбаған)` : pos ? approxAddress(pos.lat, pos.lng) : "")}
                  />
                  <div className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">
                    <Award size={16} /> +10 ұпай · «Таза азамат»
                  </div>
                  <div className="mt-5 flex flex-col gap-2">
                    <button onClick={() => setTab("mine")} className="rounded-[6px] bg-ink py-4 text-[16px] font-bold text-white">
                      Мәртебесін бақылау
                    </button>
                    <button onClick={reset} className="rounded-[6px] bg-[#fbfaf7] py-4 text-[16px] font-bold text-stone-700 shadow-sm">
                      Жаңа өтініш беру
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {tab === "mine" && <MyReports reports={myReports} now={state?.now ?? Date.now()} onRated={refresh} />}
          {tab !== "report" && <h1 className="sr-only">{tab === "mine" ? "Менің өтініштерім" : tab === "truck" ? "Қоқыс көлігі қайда" : "Тазалықшыға рақмет айту"}</h1>}
          {tab === "truck" && <TruckWhere />}
          {tab === "thanks" && <ThankWorker workers={state?.workers ?? []} />}
        </div>

        {/* Төменгі әрекет / навигация */}
        <div className="fixed inset-x-0 bottom-0 z-30">
          <div className="mx-auto max-w-md px-4 pb-4">
            {tab === "report" && step === "review" ? (
              <button
                onClick={send}
                disabled={sending || ai?.needsRetake || (ai?.demo && !catPicked) || noLoc}
                className="flex w-full items-center justify-center gap-2 rounded-[6px] sweep-btn bg-ink py-4 text-base font-bold text-salt transition active:scale-[0.98] disabled:opacity-60"
              >
                {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />} {ai?.demo && !catPicked ? "Алдымен түрін таңдаңыз" : ai?.needsRetake ? "Фотоны қайта түсіріңіз" : locInfo.src === "locating" ? "Орын анықталуда…" : noLoc ? "Алдымен орынды көрсетіңіз" : "Жіберу"}
              </button>
            ) : (
              <nav className="glass-light grid grid-cols-4 rounded-[6px] p-1.5 shadow-lg">
                {[
                  { id: "report" as const, l: "Хабарлау", i: Camera },
                  { id: "mine" as const, l: `Менікі${myReports.length ? ` (${myReports.length})` : ""}`, i: Clock3 },
                  { id: "truck" as const, l: "Көлік қайда", i: Truck },
                  { id: "thanks" as const, l: "Рақмет айту", i: Heart },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTab(t.id);
                      if (t.id === "report" && step === "sent") reset();
                    }}
                    className={`flex flex-col items-center gap-0.5 rounded-[4px] py-2 text-[11px] font-semibold transition ${tab === t.id ? "bg-ink text-white" : "text-stone-500"}`}
                  >
                    <t.i size={18} />
                    {t.l}
                  </button>
                ))}
              </nav>
            )}
          </div>
        </div>
      </div>
    </main>
    </PhoneFrame>
  );
}

/** Өртеу / түтін: белсенді от болса — алдымен 112 (жүйе өрт сөндірушілерді шақырмайды, шыншыл айтамыз) */
function FireAlert() {
  return (
    <div role="note" className="mt-4 rounded-[16px] border-2 border-qyzyl bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <Flame size={26} className="mt-0.5 shrink-0 text-qyzyl" />
        <div className="text-[16px] leading-snug text-ink">
          <b>От жанып, үйге немесе адамға қауіп төнсе — алдымен 112-ге қоңырау шалыңыз.</b>
          <span className="mt-1 block text-[14px] text-stone-600">TrashSTOP шағымы тазалық қызметіне және инспекторға түседі: өртеу орны тазаланады, қайталанса — әкімшілік шара қолданылады.</span>
        </div>
      </div>
      <a href="tel:112" className="mt-3 flex min-h-[52px] items-center justify-center gap-2 rounded-[10px] bg-qyzyl text-[18px] font-extrabold text-white active:scale-[0.98]">
        <Phone size={20} /> 112-ге қоңырау шалу
      </a>
    </div>
  );
}

/** Орын: қайдан алынды, қаншалық дәл, және оны түзету жолдары (іздеу, қайта анықтау, карта) */
function LocationBar({ info, onRelocate, onPick }: { info: LocInfo; onRelocate: () => void; onPick: (p: { lat: number; lng: number }) => void }) {
  const city = useCityConf();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ lat: number; lng: number; address: string; area: string | null }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const weak = info.src === "gps" && info.acc > 100;
  const bad = info.src === "none" || weak;
  const msg =
    info.src === "locating"
      ? "📡 Орныңыз анықталуда…"
      : info.src === "exif"
        ? "📷 Фотодағы координата"
        : info.src === "map"
          ? "👆 Картадан таңдалды"
          : info.src === "search"
            ? "🔎 Мекенжай бойынша"
            : info.src === "gps"
              ? weak
                ? `📡 GPS · ±${info.acc} м — дәлдік төмен`
                : `📡 GPS · ±${info.acc} м`
              : info.why === "denied"
                ? "Орынға рұқсат берілмеді"
                : info.why === "outside"
                  ? `Сіз ${city.abl} тыс жердесіз`
                  : "GPS сигналы табылмады";

  async function find(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 3) return;
    setBusy(true);
    const r = await searchAddress(q.trim());
    setRes(r);
    setBusy(false);
  }

  return (
    <div className="px-4 pb-3 pt-2">
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
        <span className={`rounded-full px-2.5 py-1 ${info.src === "locating" ? "bg-stone-100 text-stone-600" : bad ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{msg}</span>
        {info.src !== "locating" && (
          <button type="button" onClick={onRelocate} className="rounded-full border border-line px-2.5 py-1 text-ink hover:bg-white">
            📍 Қайта анықтау
          </button>
        )}
      </div>
      {bad && <p className="mt-2 text-[14px] font-semibold leading-snug text-amber-800">Нақты орынды көрсетіңіз: көше атауын жазыңыз немесе төмендегі картаны басыңыз.</p>}
      <form onSubmit={find} className="mt-2 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Көше, үй нөмірі"
          aria-label="Мекенжайды іздеу"
          className="min-w-0 flex-1 rounded-[10px] border border-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-ink"
        />
        <button type="submit" disabled={busy} className="shrink-0 rounded-[10px] bg-ink px-4 text-[15px] font-bold text-salt disabled:opacity-60">
          {busy ? <Loader2 size={18} className="animate-spin" /> : "Табу"}
        </button>
      </form>
      {res && (
        <div className="mt-2 overflow-hidden rounded-[10px] border border-line bg-white">
          {res.length === 0 ? (
            <div className="px-3 py-2.5 text-[14px] text-stone-500">Табылмады. Картаны басып белгілеңіз.</div>
          ) : (
            res.map((r) => (
              <button
                key={`${r.lat},${r.lng}`}
                type="button"
                onClick={() => {
                  onPick({ lat: r.lat, lng: r.lng });
                  setRes(null);
                  setQ("");
                }}
                className="flex w-full items-start gap-2 border-b border-line px-3 py-2.5 text-left text-[15px] last:border-0 hover:bg-salt"
              >
                <MapPin size={16} className="mt-0.5 shrink-0 text-qyzyl" />
                <span>
                  <span className="font-semibold">{r.address}</span>
                  {r.area && <span className="block text-[12px] text-stone-500">{r.area}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      )}
      <div className="mt-2 text-[12px] text-stone-400">Дұрыс емес пе? Картаны басып түзетіңіз</div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-[4px] bg-stone-50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{label}</div>
      <div className="mt-0.5 text-sm font-bold" style={{ color: color ?? "#0f172a" }}>
        {value}
      </div>
    </div>
  );
}

const STEPS: { key: Report["status"][]; label: string }[] = [
  { key: ["new", "assigned", "in_progress", "done"], label: "Тіркелді" },
  { key: ["assigned", "in_progress", "done"], label: "Орындаушыға жіберілді" },
  { key: ["in_progress", "done"], label: "Орындалуда" },
  { key: ["done"], label: "Орындалды · фотомен расталды" },
];

function MyReports({ reports, now, onRated }: { reports: Report[]; now: number; onRated: () => void }) {
  const [open, setOpen] = useState<string | null>(reports[0]?.id ?? null);
  // Деректер кейін жүктелсе де — ең соңғы шағым ашық тұрсын
  const first = reports[0]?.id ?? null;
  useEffect(() => {
    if (!open && first) setOpen(first);
  }, [first]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!reports.length)
    return (
      <div className="mt-16 text-center">
        <div className="text-5xl">📭</div>
        <div className="mt-3 font-bold text-stone-800">Әзірге шағым жоқ</div>
        <div className="mt-1 text-sm text-stone-500">Алғашқы фотоңызды жіберіп, «Таза азамат» болыңыз</div>
      </div>
    );
  return (
    <div className="mt-2 space-y-3">
      <h2 className="display text-[34px] text-ink">Менің шағымдарым</h2>
      {reports.map((r) => (
        <div key={r.id} className="overflow-hidden rounded-[24px] bg-[#fbfaf7] shadow-sm">
          <button onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full items-center gap-3 p-3 text-left">
            <PhotoBox src={r.photo} category={r.category} className="h-14 w-14 shrink-0 rounded-[4px]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-400">{r.code}</span>
                <StatusPill status={r.status} />
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-stone-800">{r.description}</div>
              <div className="text-[11px] text-stone-400">{timeAgo(r.createdAt, now)}</div>
            </div>
            <ChevronRight size={18} className={`text-stone-300 transition ${open === r.id ? "rotate-90" : ""}`} />
          </button>
          {open === r.id && (
            <div className="border-t border-stone-100 px-4 pb-4 pt-3">
              <ol className="relative ml-2 space-y-3 border-l-2 border-stone-100 pl-5">
                {STEPS.map((s) => {
                  const on = s.key.includes(r.status);
                  return (
                    <li key={s.label} className="relative">
                      <span
                        className={`absolute -left-[27px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full ${on ? "bg-ink" : "bg-stone-200"}`}
                      >
                        {on && <span className="h-1.5 w-1.5 rounded-full bg-[#fbfaf7]" />}
                      </span>
                      <div className={`text-sm font-semibold ${on ? "text-stone-800" : "text-stone-400"}`}>{s.label}</div>
                    </li>
                  );
                })}
              </ol>
              {r.status === "done" && (
                <>
                  <BeforeAfter before={r.photo} after={r.afterPhoto} category={r.category} />
                  {r.doneAt && <div className="mt-2 text-xs text-stone-500">Жабылды: {fmtTime(r.doneAt)}</div>}
                  {r.rating ? (
                    <div className="mt-3 flex items-center gap-2 text-sm text-stone-600">
                      Сіздің бағаңыз: <Stars value={r.rating} />
                    </div>
                  ) : (
                    <RateBox id={r.id} onDone={onRated} />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function BeforeAfter({ before, after, category }: { before: string | null; after: string | null; category: Category }) {
  const [x, setX] = useState(50);
  return (
    <div className="relative mt-4 aspect-[16/10] overflow-hidden rounded-[6px] bg-stone-200 select-none">
      <PhotoBox src={after} category={category} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - x}% 0 0)` }}>
        <PhotoBox src={before} category={category} className="h-full w-full" />
      </div>
      <div className="absolute inset-y-0 w-0.5 bg-[#fbfaf7] shadow" style={{ left: `${x}%` }} />
      <span className="absolute left-2 top-2 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">ДЕЙІН</span>
      <span className="absolute right-2 top-2 rounded-md bg-ink px-2 py-0.5 text-[10px] font-bold text-white">КЕЙІН</span>
      <input type="range" min={0} max={100} value={x} onChange={(e) => setX(+e.target.value)} className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
    </div>
  );
}

function RateBox({ id, onDone }: { id: string; onDone: () => void }) {
  const [stars, setStars] = useState(5);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-3 rounded-[6px] bg-amber-50 p-3">
      <div className="text-sm font-bold text-stone-800">Тазалықшының жұмысын бағалаңыз</div>
      <div className="mt-0.5 text-xs text-stone-500">Бағаңыз оның айлық бонусына әсер етеді</div>
      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} onClick={() => setStars(i)} className={`text-3xl transition ${i <= stars ? "scale-100" : "scale-90 opacity-30"}`}>
            ⭐
          </button>
        ))}
      </div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await post(`/api/reports/${id}`, { action: "rate", rating: stars, thanks: "Рақмет!" }).catch(() => {});
          onDone();
        }}
        className="mt-2 w-full rounded-[4px] bg-ink py-2.5 text-sm font-bold text-white disabled:opacity-60"
      >
        Бағалау және рақмет айту
      </button>
    </div>
  );
}

function ThankWorker({ workers }: { workers: { id: string; name: string; age: number; rating: number; thanks: number }[] }) {
  const [q, setQ] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const list = workers.filter((w) => w.name.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
  return (
    <div className="mt-2">
      <h2 className="display text-[34px] text-ink">Тазалықшыға рақмет айту</h2>
      <p className="mt-1 text-sm text-stone-500">Көшеде тазалықшыны көрдіңіз бе? Оның жеңіндегі QR кодты сканерлеңіз немесе атын табыңыз.</p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Аты бойынша іздеу…"
        className="mt-3 w-full rounded-[6px] bg-[#fbfaf7] px-4 py-3 text-sm shadow-sm outline-none ring-ink focus:ring-2"
      />
      <div className="mt-3 space-y-2">
        {list.map((w) => (
          <div key={w.id} className="flex items-center gap-3 rounded-[6px] bg-[#fbfaf7] p-3 shadow-sm">
            <Avatar name={w.name} size={42} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-stone-800">{w.name}</div>
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <Stars value={w.rating} size={11} /> {w.rating.toFixed(1)} · {w.thanks} алғыс
              </div>
            </div>
            {done === w.id ? (
              <span className="text-sm font-bold text-qyzyl">❤️ Жіберілді</span>
            ) : (
              <button
                onClick={async () => {
                  await post(`/api/workers/${w.id}`, { rating: 5 }).catch(() => {});
                  setDone(w.id);
                }}
                className="rounded-[4px] bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600"
              >
                ❤️ Рақмет
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


/** Фото сапасы: тым қараңғы немесе бұлдыр болса — ескерту (браузерде, серверге жібермей) */
async function photoQuality(dataUrl: string): Promise<string | null> {
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const W = 160;
    const H = Math.round((img.height / img.width) * W) || 120;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const x = c.getContext("2d")!;
    x.drawImage(img, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H).data;
    const g = new Float32Array(W * H);
    let sum = 0;
    for (let i = 0; i < W * H; i++) {
      g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
      sum += g[i];
    }
    const mean = sum / (W * H);
    // Лаплас дисперсиясы — айқындық өлшемі
    let lap = 0;
    let lap2 = 0;
    let n = 0;
    for (let y = 1; y < H - 1; y++)
      for (let xx = 1; xx < W - 1; xx++) {
        const i = y * W + xx;
        const v = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - W] - g[i + W];
        lap += v;
        lap2 += v * v;
        n++;
      }
    const variance = lap2 / n - (lap / n) ** 2;
    if (mean < 45) return "Фото тым қараңғы — ЖИ қателесуі мүмкін. Жарықта түсірген дұрыс.";
    if (variance < 60) return "Фото бұлдыр — ЖИ қателесуі мүмкін. Телефонды қозғалтпай түсіріңіз.";
    return null;
  } catch {
    return null;
  }
}

/** eOtinish логикасы: өтініш беру қадамдары */
function Stepper({ current }: { current: number }) {
  const steps = ["Фото", "ЖИ талдауы", "Тексеру", "Тіркелді"];
  return (
    <ol className="mb-4 mt-1 grid grid-cols-4 gap-1.5" aria-label="Өтініш беру қадамдары">
      {steps.map((t, i) => {
        const done = i < current || current === 3;
        const on = i === current;
        return (
          <li key={t} aria-current={on ? "step" : undefined} className="text-center">
            <div className={`h-1.5 rounded-full ${done || on ? "bg-qyzyl" : "bg-stone-200"}`} />
            <div className={`mt-1.5 text-[11px] font-semibold ${on ? "text-ink" : done ? "text-stone-600" : "text-stone-400"}`}>
              {i + 1}. {t}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Ресми түбіртек: тіркеу нөмірі, жауапты орган, мерзім, бақылау QR коды */
function Receipt({ code, merged, category, address }: { code: string; merged: boolean; category: Category; address: string }) {
  const city = useCityConf();
  const [qr, setQr] = useState("");
  const now = useMemo(() => Date.now(), []);
  useEffect(() => {
    import("qrcode").then((Q) => Q.toDataURL(`${location.origin}/track?code=${code}`, { margin: 0, width: 180, color: { dark: "#0e0e0d", light: "#ffffff" } }).then(setQr));
  }, [code]);
  const sla = CATEGORY[category].slaHours;
  return (
    <section className="overflow-hidden rounded-[10px] border border-stone-200 bg-white shadow-sm" aria-label="Өтініш түбіртегі">
      <div className="flex items-center gap-3 bg-ink px-5 py-4 text-salt">
        <CheckCircle2 size={28} className="text-[#3ecf7a]" />
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wider text-mist">{merged ? "Өтініш біріктірілді" : "Өтініш тіркелді"}</div>
          <div className="mono text-[26px] font-semibold leading-tight">{code}</div>
        </div>
      </div>
      <dl className="divide-y divide-stone-100 px-5 text-[15px]">
        {[
          ["Тіркелген уақыты", fmtTime(now)],
          ["Санаты", CATEGORY[category].label],
          ["Мекенжайы", address],
          ["Жауапты орган", city.responsible],
          ["Орындау мерзімі", `${sla} сағатқа дейін`],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2.5">
            <dt className="text-stone-500">{k}</dt>
            <dd className="text-right font-semibold text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center gap-4 border-t border-dashed border-stone-300 bg-salt/60 px-5 py-4">
        {qr && <img src={qr} alt="Өтінішті бақылау QR коды" className="h-20 w-20" />}
        <div className="text-[13px] leading-snug text-stone-600">
          {merged ? "Бұл жер бұрын тіркелген, сіздің өтінішіңіз соған қосылды. " : ""}
          Мәртебесін кез келген уақытта <b>trashstop</b> сайтындағы «Өтінішті тексеру» бетінен көре аласыз.
          <div className="mt-1 text-[11px] text-stone-400">{LEGAL_TERM}</div>
        </div>
      </div>
    </section>
  );
}
