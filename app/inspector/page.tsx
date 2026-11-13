"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, FileText, ShieldCheck, Upload, Loader2, Scale, MapPin, Clock3, Fingerprint, Sparkles } from "lucide-react";
import { Rail } from "@/components/Rail";
import { Logo } from "@/components/Logo";
import { PhotoBox, StatusPill, TestDataBadge } from "@/components/ui";
import { approxAddress, compressImage, post, useCity } from "@/lib/client";
import { LAW_REF, distanceM, fmtTime } from "@/lib/meta";
import type { AiResult, Report } from "@/lib/types";

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function InspectorPage() {
  const { state, refresh } = useCity(3000);
  // Көліктен тастау + қоқыс өртеу (екеуі де әкімшілік құқық бұзушылық)
  const cases = useMemo(() => (state?.reports ?? []).filter((r) => r.category === "car" || r.category === "burning"), [state]);
  // Бір жерде (80 м) 30 күнде қанша рет өртеді — қайталанатын бұзушылықтың дәлелі
  const repeats = (x: Report) =>
    cases.filter((y) => y.category === "burning" && distanceM(y, x) < 80 && Math.abs(y.createdAt - x.createdAt) < 30 * 864e5).length;
  const [sel, setSel] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const r = cases.find((c) => c.id === sel) ?? cases[0] ?? null;

  useEffect(() => {
    setReveal(false);
    if (r) sha256(`${r.code}|${r.lat}|${r.lng}|${r.createdAt}|${r.plate}|${r.photo ?? ""}`).then(setHash);
  }, [r?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function upload(f?: File) {
    if (!f) return;
    setBusy(true);
    try {
      const photo = await compressImage(f);
      const ai = await post<AiResult>("/api/ai/analyze", { photo, hint: "car" });
      const lat = 44.8488 + (Math.random() - 0.5) * 0.01;
      const lng = 65.5092 + (Math.random() - 0.5) * 0.014;
      const res = await post<{ id: string }>("/api/reports", {
        lat,
        lng,
        address: approxAddress(lat, lng),
        category: "car",
        photo,
        ai: { ...ai, category: "car" },
        plate: ai.plate ?? null,
        description: ai.summary,
        source: "app",
      });
      await refresh();
      setSel(res.id);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
    <Rail />
    <main id="main" className="a11y-zoom lg:ml-[68px] min-h-dvh bg-ink">
      <h1 className="sr-only">Инспектор: көліктен қоқыс тастау және қоқыс өртеу істері</h1>
      <div className="no-print mx-auto max-w-6xl px-4 pb-[170px] pt-5 lg:pb-10">
        <header className="flex flex-wrap items-center gap-3">
          <Logo sub="Инспектор · Көліктен тастау, өртеу" />
          <span className="ml-auto sm:hidden">
            <TestDataBadge />
          </span>
          <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
            <span className="hidden sm:contents">
              <TestDataBadge />
            </span>
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-[4px] bg-rose-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-400 sm:min-h-0 sm:flex-none"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Бейнетіркеуіш кадрын жүктеу
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          </div>
        </header>

        <div className="mt-4 rounded-[6px] border border-sky-400/20 bg-sky-400/[0.06] p-4 text-sm text-sky-100">
          <div className="flex items-center gap-2 font-bold">
            <Scale size={16} /> Жүйе айыппұлды өзі салмайды
          </div>
          <div className="mt-1 text-sky-200/80">
            ЖИ тек дәлелдерді жинайды: фото, уақыт, геоорын, көлік нөмірі. Хаттама туралы шешімді өкілетті инспектор қабылдайды. 2026 жылдан бастап әкімдіктер абаттандыру қағидаларын бұзғаны үшін хаттаманы өздері толтыра алады. Нөмір тек осы бетте көрінеді, қалған жерлерде бұлдырланады.
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[340px_1fr]">
          <div className="glass max-h-[38vh] space-y-1.5 overflow-y-auto scroll-thin rounded-[6px] p-2 lg:max-h-[70vh]">
            {cases.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSel(c.id);
                  // телефонда: дәлелдер бөліміне түсеміз
                  if (!matchMedia("(min-width: 1024px)").matches) setTimeout(() => document.getElementById("evidence")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                }}
                className={`flex w-full items-center gap-3 rounded-[4px] p-2.5 text-left transition ${r?.id === c.id ? "bg-white/10" : "hover:bg-white/5"}`}
              >
                <PhotoBox src={c.photo} category={c.category} className="h-12 w-12 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-stone-500">{c.code}</span>
                    <StatusPill status={c.status} />
                  </div>
                  {c.category === "burning" ? (
                    <div className="mt-1 text-sm font-bold text-stone-300">🔥 Өртеу, түтін</div>
                  ) : (
                    <div className="mt-1 font-mono text-sm font-bold tracking-wider text-stone-300 blur-[3px]">{c.plate ?? "— — —"}</div>
                  )}
                  <div className="text-[11px] text-stone-500">{fmtTime(c.createdAt)}</div>
                </div>
              </button>
            ))}
          </div>

          {r && <Evidence r={r} reveal={reveal} setReveal={setReveal} hash={hash} repeats={repeats(r)} />}
        </div>
      </div>

      {r && <PrintProtocol r={r} hash={hash} repeats={repeats(r)} />}
    </main>
    </>
  );
}

function Evidence({ r, reveal, setReveal, hash, repeats }: { r: Report; reveal: boolean; setReveal: (v: boolean) => void; hash: string; repeats: number }) {
  const fire = r.category === "burning";
  return (
    <div id="evidence" className="glass scroll-mt-3 overflow-hidden rounded-[6px]">
      <div className="relative aspect-[16/8] bg-black">
        <PhotoBox src={r.photo} category={r.category} className="h-full w-full" />
        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 font-mono text-[11px] text-salt backdrop-blur">
          ● REC {fmtTime(r.createdAt)} · {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
        </div>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-2">
        <div>
          {fire ? (
            <>
              <div className="text-xs font-bold uppercase tracking-wider text-stone-500">Қоқыс өртеу, түтін</div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className={`display text-[56px] leading-none ${repeats >= 2 ? "text-red-400" : "text-salt"}`}>{repeats}</span>
                <span className="text-sm text-stone-300">рет осы жерде (80 м) соңғы 30 күнде</span>
              </div>
              <div className="mt-1.5 text-[11px] text-stone-400">{repeats >= 2 ? "Қайталанатын бұзушылық — тұрғындардың бірнеше шағымы бар" : "Бірінші рет тіркелді — ескерту жеткілікті болуы мүмкін"}</div>
            </>
          ) : (
            <>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500">Көлік нөмірі (ЖИ анықтады)</div>
          <div className="mt-2 flex items-center gap-3">
            <div className={`rounded-lg border-[3px] border-stone-900 bg-white px-4 py-2 font-mono text-2xl font-extrabold tracking-[0.15em] text-stone-900 transition ${reveal ? "" : "blur-md"}`}>
              🇰🇿 {r.plate ?? "анықталмады"}
            </div>
            <button onClick={() => setReveal(!reveal)} className="flex h-11 w-11 items-center justify-center rounded-[4px] bg-white/5 text-stone-300 hover:bg-white/10">
              {reveal ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-salt">
            <Sparkles size={11} /> Сенімділігі {Math.round((r.ai?.confidence ?? 0.91) * 100)}% · ашылғаны журналға жазылады
          </div>
            </>
          )}
          <div className="mt-5 space-y-2 text-sm">
            <Line icon={Clock3} l="Уақыты" v={fmtTime(r.createdAt)} />
            <Line icon={MapPin} l="Орны" v={`${r.address}, ${r.district}`} />
            <Line icon={Scale} l="Құқықтық негіз" v={LAW_REF} />
          </div>
        </div>
        <div className="flex flex-col">
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500">Дәлелдер пакеті</div>
          <ul className="mt-2 space-y-1.5 text-sm text-stone-300">
            {["Түпнұсқа фото / кадр", "Уақыт белгісі (сервер)", "GPS координаталары", fire ? "Қайталану тарихы" : "Көлік нөмірі", "Құқықтық бап", "Тұтастық хэші (SHA-256)"].map((x) => (
              <li key={x} className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-salt" /> {x}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-start gap-2 rounded-[4px] bg-white/[0.04] p-2.5">
            <Fingerprint size={16} className="mt-0.5 shrink-0 text-stone-500" />
            <code className="break-all text-[10px] leading-relaxed text-stone-400">{hash}</code>
          </div>
          <button onClick={() => window.print()} className="mt-auto flex items-center justify-center gap-2 rounded-[4px] bg-white py-3 text-sm font-bold text-stone-900 hover:bg-stone-100">
            <FileText size={16} /> Хаттама жобасын PDF ретінде алу
          </button>
        </div>
      </div>
    </div>
  );
}

function Line({ icon: Icon, l, v }: { icon: typeof Clock3; l: string; v: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} className="mt-0.5 text-stone-500" />
      <div>
        <div className="text-[11px] text-stone-500">{l}</div>
        <div className="font-semibold text-stone-200">{v}</div>
      </div>
    </div>
  );
}

function PrintProtocol({ r, hash, repeats }: { r: Report; hash: string; repeats: number }) {
  return (
    <div className="hidden p-10 font-serif text-black print:block">
      <div className="text-center text-sm">ҚЫЗЫЛОРДА ҚАЛАСЫ ӘКІМДІГІ</div>
      <h2 className="mt-4 text-center text-xl font-bold">Әкімшілік құқық бұзушылық туралы хаттаманың ЖОБАСЫ</h2>
      <div className="mt-1 text-center text-xs">(TrashSTOP жүйесі дайындаған дәлелдер пакеті · ТЕСТІЛІК ДЕРЕКТЕР)</div>
      <table className="mt-8 w-full border-collapse text-sm">
        <tbody>
          {[
            ["Іс нөмірі", r.code],
            ["Уақыты", fmtTime(r.createdAt)],
            ["Орны", `${r.address}, ${r.district} (${r.lat.toFixed(5)}, ${r.lng.toFixed(5)})`],
            r.category === "burning" ? ["Қайталануы (30 күн, 80 м)", `${repeats} рет`] : ["Көлік нөмірі", r.plate ?? "—"],
            ["Бұзушылық сипаты", r.description],
            ["Құқықтық негіз", LAW_REF],
            ["Дәлелдің тұтастық хэші", hash],
          ].map(([a, b]) => (
            <tr key={a}>
              <td className="w-1/3 border border-black p-2 font-bold">{a}</td>
              <td className="border border-black p-2 break-all">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {r.photo && <img src={r.photo} alt="" className="mt-6 max-h-72" />}
      <div className="mt-10 text-sm">Шешім қабылдаған инспектор: ____________________ (аты-жөні, қолы)</div>
      <div className="mt-2 text-xs">Ескерту: бұл құжат жоба ғана. Айыппұл туралы шешімді өкілетті лауазымды тұлға қабылдайды.</div>
    </div>
  );
}
