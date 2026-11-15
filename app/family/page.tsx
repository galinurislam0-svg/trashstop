"use client";
// «Таза ұрпақ»: ата-ана балаға қауіпсіз экологиялық тапсырма береді, бала дейін/кейін фотосымен орындайды,
// ЖИ тексереді, ата-ана растайды — сыйақы баланың жинағына түседі. Ақша — демо (нақты төлем жоқ).
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Camera, Check, Loader2, Minus, Plus, RotateCcw, ShieldAlert, Sparkles, Wallet, X } from "lucide-react";
import { PhoneFrame } from "@/components/PhoneFrame";
import { Logo } from "@/components/Logo";
import { UserChip } from "@/components/UserChip";
import { compressImage, getBestGeo, post } from "@/lib/client";
import { FAM_LEVEL, FAM_SAFETY, FAM_TEMPLATES, type FamTemplate } from "@/lib/family";
import type { Family, FamTask } from "@/lib/types";
import { CitySwitch } from "@/components/CitySwitch";

const fmt = (n: number) => `${n.toLocaleString("ru-RU").replace(/,/g, " ")} ₸`;

export default function FamilyPage() {
  const [fam, setFam] = useState<Family | null>(null);
  const [mode, setMode] = useState<"parent" | "kid">("parent");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/family", { cache: "no-store" });
      if (r.ok) setFam(await r.json());
    } catch {}
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  async function act(body: Record<string, unknown>, tag = String(body.action)) {
    setBusy(tag);
    setErr(null);
    try {
      setFam(await post<Family>("/api/family", body));
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <PhoneFrame
      title="Таза ұрпақ"
      path="/family"
      points={["Ата-ана демо әмиянға ақша салып, балаға қауіпсіз тапсырма береді", "Бала дейін және кейін фотосын түсіреді, ЖИ тексереді", "Ата-ана растағанда сыйақы баланың жинағына түседі"]}
    >
      <main id="main" className="a11y-zoom light-page min-h-dvh">
        <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-28">
          <header className="frame-end flex items-center justify-between py-3">
            <span className="in-frame-hide">
              <Logo light sub="Таза ұрпақ" />
            </span>
            <span className="flex items-center gap-1.5">
              <CitySwitch variant="light" compact />
              <span className="in-frame-hide">
                <UserChip light compact />
              </span>
            </span>
          </header>

          <h1 className="display text-[38px] leading-[0.92] text-ink">
            Таза ұрпақ
            <br />
            <span className="text-clean">аулаңнан басталады.</span>
          </h1>
          <p className="mt-2 text-[15px] text-stone-600">Бала ауласын тазалап, еңбекпен ақша табады. Ата-ана тапсырма береді және нәтижені фотомен көреді.</p>

          <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-[10px] bg-white p-1.5 shadow-sm" role="group" aria-label="Режим">
            {(
              [
                ["parent", "👨‍👩‍👧 Ата-ана"],
                ["kid", "🧒 Бала"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k} className={`min-h-[48px] rounded-[8px] text-[16px] font-bold transition ${mode === k ? "bg-ink text-white" : "text-stone-500"}`}>
                {l}
              </button>
            ))}
          </div>

          {err && (
            <div role="alert" className="mt-3 flex items-start gap-2 rounded-[10px] bg-red-50 px-4 py-3 text-[15px] text-red-700">
              <span className="flex-1">{err}</span>
              <button onClick={() => setErr(null)} aria-label="Жабу">
                <X size={18} />
              </button>
            </div>
          )}

          {!fam ? (
            <div className="mt-10 flex justify-center text-stone-400">
              <Loader2 className="animate-spin" />
            </div>
          ) : mode === "parent" ? (
            <Parent fam={fam} act={act} busy={busy} />
          ) : (
            <KidMode fam={fam} act={act} busy={busy} setErr={setErr} />
          )}
        </div>
      </main>
    </PhoneFrame>
  );
}

type Act = (body: Record<string, unknown>, tag?: string) => Promise<boolean>;

/* ───────────── Ата-ана ───────────── */
function Parent({ fam, act, busy }: { fam: Family; act: Act; busy: string | null }) {
  const [kidName, setKidName] = useState("");
  const [kidId, setKidId] = useState<string>(fam.kids[0]?.id ?? "");
  const [tpl, setTpl] = useState<FamTemplate>("yard");
  const [reward, setReward] = useState<number>(FAM_TEMPLATES.yard.reward);
  useEffect(() => {
    if (!kidId && fam.kids[0]) setKidId(fam.kids[0].id);
  }, [fam.kids, kidId]);
  const review = fam.tasks.filter((t) => t.status === "review");
  const active = fam.tasks.filter((t) => t.status !== "review");
  const kidName_ = (id: string) => fam.kids.find((k) => k.id === id)?.name ?? "";

  return (
    <div className="mt-4 space-y-4">
      {/* Әмиян */}
      <section className="rounded-[16px] bg-ink p-5 text-salt">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-stone-400">
          <Wallet size={16} /> Отбасы әмияны
        </div>
        <div className="display mt-1 text-[44px] leading-none">{fmt(fam.balance)}</div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[1000, 2000, 5000].map((a) => (
            <button key={a} disabled={!!busy} onClick={() => act({ action: "topup", amount: a }, `top${a}`)} className="min-h-[44px] rounded-[8px] bg-white/10 text-[15px] font-bold hover:bg-white/15 disabled:opacity-50">
              {busy === `top${a}` ? <Loader2 size={16} className="mx-auto animate-spin" /> : `+${a.toLocaleString("ru-RU")}`}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[12px] leading-snug text-stone-400">Демо әмиян: нақты ақша аударылмайды. Пилотта — Kaspi арқылы, ата-ананың келісімімен. Тапсырма берілгенде сыйақы резервке алынады.</p>
      </section>

      {/* Растау күтіп тұрғандар */}
      {review.length > 0 && (
        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-qyzyl">{`Растауды күтіп тұр · ${review.length}`}</h2>
          <div className="mt-2 space-y-3">
            {review.map((t) => (
              <ReviewCard key={t.id} t={t} kid={kidName_(t.kidId)} act={act} busy={busy} />
            ))}
          </div>
        </section>
      )}

      {/* Балалар */}
      <section className="rounded-[16px] bg-white p-4 shadow-sm">
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-stone-400">Балалар</h2>
        <div className="mt-2 space-y-2">
          {fam.kids.map((k) => (
            <div key={k.id} className="flex items-center justify-between rounded-[10px] bg-salt px-3 py-2.5">
              <span className="text-[16px] font-bold text-ink">{`🧒 ${k.name}`}</span>
              <span className="text-[14px] font-semibold text-clean">{`жинағы ${fmt(k.saved)}`}</span>
            </div>
          ))}
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act({ action: "addKid", name: kidName })) setKidName("");
          }}
          className="mt-3 flex gap-2"
        >
          <input value={kidName} onChange={(e) => setKidName(e.target.value)} placeholder="Баланың аты" aria-label="Баланың аты" maxLength={24} className="min-w-0 flex-1 rounded-[10px] border border-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-ink" />
          <button disabled={!!busy} className="flex min-h-[44px] items-center gap-1 rounded-[10px] bg-ink px-4 text-[15px] font-bold text-white disabled:opacity-50">
            <Plus size={16} /> Қосу
          </button>
        </form>
      </section>

      {/* Жаңа тапсырма */}
      {fam.kids.length > 0 && (
        <section className="rounded-[16px] bg-white p-4 shadow-sm">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-stone-400">Жаңа тапсырма</h2>
          {fam.kids.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {fam.kids.map((k) => (
                <button key={k.id} onClick={() => setKidId(k.id)} aria-pressed={kidId === k.id} className={`min-h-[40px] rounded-full px-4 text-[14px] font-semibold ${kidId === k.id ? "bg-ink text-white" : "bg-salt text-stone-600"}`}>
                  {k.name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-2 grid gap-2">
            {(Object.keys(FAM_TEMPLATES) as FamTemplate[]).map((k) => {
              const x = FAM_TEMPLATES[k];
              const on = tpl === k;
              return (
                <button
                  key={k}
                  onClick={() => {
                    setTpl(k);
                    setReward(x.reward);
                  }}
                  aria-pressed={on}
                  className={`flex items-center gap-3 rounded-[12px] border-2 px-3 py-2.5 text-left transition ${on ? "border-ink bg-salt" : "border-transparent bg-salt/60"}`}
                >
                  <span className="text-[26px]">{x.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold leading-snug text-ink">{x.title}</span>
                    <span className="text-[12px] font-semibold" style={{ color: FAM_LEVEL[x.level].color }}>
                      {FAM_LEVEL[x.level].label}
                    </span>
                  </span>
                  <span className="text-[15px] font-extrabold text-ink">{fmt(x.reward)}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-[14px] font-semibold text-stone-500">Сыйақы</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setReward((r) => Math.max(100, r - 100))} aria-label="Азайту" className="flex h-11 w-11 items-center justify-center rounded-full bg-salt">
                <Minus size={18} />
              </button>
              <span className="w-24 text-center text-[20px] font-extrabold tabular-nums text-ink">{fmt(reward)}</span>
              <button onClick={() => setReward((r) => Math.min(10000, r + 100))} aria-label="Көбейту" className="flex h-11 w-11 items-center justify-center rounded-full bg-salt">
                <Plus size={18} />
              </button>
            </div>
          </div>
          <button
            disabled={!!busy || !kidId}
            onClick={() => act({ action: "addTask", kidId, template: tpl, reward }, "addTask")}
            className="mt-3 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[12px] bg-clean text-[17px] font-extrabold text-white disabled:opacity-50"
          >
            {busy === "addTask" ? <Loader2 className="animate-spin" /> : <Check size={20} />} {`Тапсырма беру · ${fmt(reward)}`}
          </button>
        </section>
      )}

      {/* Тапсырмалар тарихы */}
      {active.length > 0 && (
        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-stone-400">Тапсырмалар</h2>
          <div className="mt-2 space-y-2">
            {active.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-[12px] bg-white px-3 py-3 shadow-sm">
                <span className="text-[24px]">{FAM_TEMPLATES[t.template as FamTemplate]?.emoji ?? "🧹"}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold leading-snug text-ink">{t.title}</div>
                  <div className="text-[12px] text-stone-500">{`${kidName_(t.kidId)} · ${fmt(t.reward)}`}</div>
                </div>
                <StatusBadge t={t} />
                {(t.status === "open" || t.status === "started") && (
                  <button disabled={!!busy} onClick={() => act({ action: "cancel", taskId: t.id }, `c${t.id}`)} aria-label="Тапсырманы тоқтату" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-400 hover:bg-salt">
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatusBadge({ t }: { t: FamTask }) {
  const m = {
    open: ["Жаңа", "bg-stone-100 text-stone-600"],
    started: ["Орындалуда", "bg-amber-100 text-amber-800"],
    review: ["Растау күтуде", "bg-sky-100 text-sky-800"],
    paid: ["✓ Төленді", "bg-emerald-100 text-emerald-800"],
    rejected: ["Қайта жасау", "bg-red-100 text-red-700"],
  }[t.status];
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold ${m[1]}`}>{m[0]}</span>;
}

function Photos({ t }: { t: FamTask }) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {[
        ["Дейін", t.beforePhoto, "bg-qyzyl"],
        ["Кейін", t.afterPhoto, "bg-clean"],
      ].map(([l, src, c]) => (
        <div key={l as string} className="relative aspect-square overflow-hidden rounded-[10px] bg-salt">
          {src ? <img src={src as string} alt={l as string} className="h-full w-full object-cover" /> : null}
          <span className={`mono absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white ${c}`}>{l as string}</span>
        </div>
      ))}
    </div>
  );
}

function ReviewCard({ t, kid, act, busy }: { t: FamTask; kid: string; act: Act; busy: string | null }) {
  const near = t.distanceM === null ? null : t.distanceM <= 100;
  return (
    <article className="rounded-[16px] bg-white p-3 shadow-sm">
      <div className="mb-2 px-1">
        <div className="text-[16px] font-bold text-ink">{t.title}</div>
        <div className="text-[13px] text-stone-500">{`${kid} · ${fmt(t.reward)}`}</div>
      </div>
      <Photos t={t} />
      <ul className="mt-2 space-y-1 px-1 text-[13px]">
        <li className={t.aiClean === true ? "text-clean" : t.aiClean === false ? "text-red-600" : "text-stone-500"}>
          {t.aiClean === true ? "✓ ЖИ: аумақ тазаланған" : t.aiClean === false ? "⚠ ЖИ: қоқыс әлі көрінеді" : "ЖИ тексермеді — фотоны өзіңіз қараңыз"}
          {t.aiComment ? <span className="block text-stone-500">{t.aiComment}</span> : null}
        </li>
        <li className={near === true ? "text-clean" : near === false ? "text-red-600" : "text-stone-500"}>
          {near === null ? "Орын анықталмады" : near ? `✓ Бір жерде түсірілген (${t.distanceM} м)` : `⚠ Басқа жерде түсірілген (${t.distanceM} м)`}
        </li>
      </ul>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <button disabled={!!busy} onClick={() => act({ action: "approve", taskId: t.id }, `a${t.id}`)} className="flex min-h-[52px] items-center justify-center gap-2 rounded-[12px] bg-clean text-[16px] font-extrabold text-white disabled:opacity-50">
          {busy === `a${t.id}` ? <Loader2 className="animate-spin" /> : <BadgeCheck size={20} />} {`Растау · ${fmt(t.reward)} беру`}
        </button>
        <button disabled={!!busy} onClick={() => act({ action: "reject", taskId: t.id, note: "Қайта жасап көр" }, `r${t.id}`)} className="flex min-h-[52px] items-center justify-center gap-1 rounded-[12px] bg-salt px-4 text-[14px] font-bold text-ink disabled:opacity-50">
          <RotateCcw size={16} /> Қайта
        </button>
      </div>
    </article>
  );
}

/* ───────────── Бала ───────────── */
function KidMode({ fam, act, busy, setErr }: { fam: Family; act: Act; busy: string | null; setErr: (e: string | null) => void }) {
  const [kidId, setKidId] = useState<string>(fam.kids[0]?.id ?? "");
  const [rules, setRules] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const pending = useRef<{ task: FamTask; step: "start" | "submit" } | null>(null);
  useEffect(() => {
    if (!kidId && fam.kids[0]) setKidId(fam.kids[0].id);
  }, [fam.kids, kidId]);
  const kid = fam.kids.find((k) => k.id === kidId);
  if (!kid)
    return <div className="mt-6 rounded-[16px] bg-white p-6 text-center text-[16px] text-stone-500 shadow-sm">Алдымен ата-ана режимінде баланың атын қосыңыз.</div>;

  const mine = fam.tasks.filter((t) => t.kidId === kid.id);
  const todo = mine.filter((t) => t.status !== "paid");
  const paid = mine.filter((t) => t.status === "paid");

  function shoot(task: FamTask, step: "start" | "submit") {
    pending.current = { task, step };
    fileRef.current?.click();
  }
  async function onFile(f?: File) {
    const p = pending.current;
    if (!f || !p) return;
    try {
      const [photo, g] = await Promise.all([compressImage(f), getBestGeo(5000)]);
      const loc = "error" in g ? {} : { lat: g.lat, lng: g.lng };
      await act({ action: p.step, taskId: p.task.id, photo, ...loc }, `${p.step}${p.task.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      pending.current = null;
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {fam.kids.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {fam.kids.map((k) => (
            <button key={k.id} onClick={() => setKidId(k.id)} aria-pressed={kidId === k.id} className={`min-h-[44px] rounded-full px-5 text-[16px] font-bold ${kidId === k.id ? "bg-ink text-white" : "bg-white text-stone-600 shadow-sm"}`}>
              {k.name}
            </button>
          ))}
        </div>
      )}

      <section className="relative overflow-hidden rounded-[20px] bg-clean p-5 text-white">
        <div className="text-[16px] font-semibold opacity-90">{`Сәлем, ${kid.name}! 👋`}</div>
        <div className="mt-1 text-[14px] opacity-80">Сенің жинағың</div>
        <div className="display text-[52px] leading-none">{fmt(kid.saved)}</div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {paid.length >= 1 && <span className="rounded-full bg-white/20 px-3 py-1 text-[12px] font-bold">🌱 Алғашқы қадам</span>}
          {paid.length >= 3 && <span className="rounded-full bg-white/20 px-3 py-1 text-[12px] font-bold">🏅 Таза аула батыры</span>}
          {paid.length >= 7 && <span className="rounded-full bg-white/20 px-3 py-1 text-[12px] font-bold">🏆 Қала қорғаушысы</span>}
          <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold">{`${paid.length} тапсырма орындалды`}</span>
        </div>
      </section>

      {/* Қауіпсіздік */}
      <section className="rounded-[16px] border-2 border-amber-300 bg-amber-50 p-4">
        <button onClick={() => setRules((r) => !r)} aria-expanded={rules} className="flex w-full items-center gap-2 text-left text-[16px] font-extrabold text-amber-900">
          <ShieldAlert size={20} /> Қауіпсіздік ережелері
        </button>
        {rules && (
          <ul className="mt-2 space-y-1.5 text-[15px] leading-snug text-amber-900">
            {FAM_SAFETY.map((r) => (
              <li key={r}>{`• ${r}`}</li>
            ))}
          </ul>
        )}
      </section>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

      {todo.length === 0 ? (
        <div className="rounded-[16px] bg-white p-6 text-center text-[16px] text-stone-500 shadow-sm">Әзірге тапсырма жоқ. Ата-анаңнан сұра! 🙂</div>
      ) : (
        <AnimatePresence initial={false}>
          {todo.map((t) => {
            const x = FAM_TEMPLATES[t.template as FamTemplate];
            const b = busy === `start${t.id}` || busy === `submit${t.id}`;
            return (
              <motion.article key={t.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[20px] bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="text-[36px] leading-none">{x?.emoji ?? "🧹"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[18px] font-extrabold leading-snug text-ink">{t.title}</div>
                    <div className="text-[13px] font-semibold" style={{ color: FAM_LEVEL[t.level].color }}>
                      {FAM_LEVEL[t.level].label}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="display text-[28px] leading-none text-clean">{`+${t.reward.toLocaleString("ru-RU")}`}</div>
                    <div className="text-[11px] text-stone-400">теңге</div>
                  </div>
                </div>
                {x?.hint && <p className="mt-2 text-[14px] leading-snug text-stone-600">{x.hint}</p>}

                {/* қадамдар */}
                <ol className="mt-3 grid grid-cols-3 gap-1 text-center text-[11px] font-bold">
                  {["Дейін фото", "Кейін фото", "Ата-ана растайды"].map((s, i) => {
                    const done = (i === 0 && t.status !== "open" && t.status !== "rejected") || (i === 1 && t.status === "review");
                    const cur = (i === 0 && (t.status === "open" || t.status === "rejected")) || (i === 1 && t.status === "started") || (i === 2 && t.status === "review");
                    return (
                      <li key={s} className={`rounded-[8px] px-1 py-2 ${cur ? "bg-ink text-white" : done ? "bg-clean/15 text-clean" : "bg-salt text-stone-400"}`}>
                        {done ? "✓ " : `${i + 1}. `}
                        {s}
                      </li>
                    );
                  })}
                </ol>

                {t.status === "rejected" && <div className="mt-3 rounded-[10px] bg-red-50 px-3 py-2 text-[14px] text-red-700">{`Ата-анаң: «${t.note ?? "Қайта жасап көр"}»`}</div>}

                {(t.status === "open" || t.status === "rejected") && (
                  <button disabled={b} onClick={() => shoot(t, "start")} className="mt-3 flex min-h-[60px] w-full items-center justify-center gap-2 rounded-[14px] bg-ink text-[18px] font-extrabold text-white active:scale-[0.98] disabled:opacity-60">
                    {b ? <Loader2 className="animate-spin" /> : <Camera size={22} />} Дейін суретке түсір
                  </button>
                )}
                {t.status === "started" && (
                  <button disabled={b} onClick={() => shoot(t, "submit")} className="mt-3 flex min-h-[60px] w-full items-center justify-center gap-2 rounded-[14px] bg-clean text-[18px] font-extrabold text-white active:scale-[0.98] disabled:opacity-60">
                    {b ? (
                      <>
                        <Loader2 className="animate-spin" /> ЖИ тексеруде…
                      </>
                    ) : (
                      <>
                        <Sparkles size={22} /> Тазаладым — кейін суретке түсір
                      </>
                    )}
                  </button>
                )}
                {t.status === "review" && <div className="mt-3 rounded-[14px] bg-sky-50 px-4 py-3 text-center text-[16px] font-bold text-sky-800">⏳ Ата-анаң тексеріп жатыр</div>}
              </motion.article>
            );
          })}
        </AnimatePresence>
      )}

      {paid.length > 0 && (
        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-stone-400">Орындалғандар</h2>
          <div className="mt-2 space-y-2">
            {paid.slice(0, 6).map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-[12px] bg-white px-3 py-2.5 shadow-sm">
                <span className="text-[15px] font-semibold text-ink">{`${FAM_TEMPLATES[t.template as FamTemplate]?.emoji ?? "🧹"} ${t.title}`}</span>
                <span className="text-[15px] font-extrabold text-clean">{`+${fmt(t.reward)}`}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
