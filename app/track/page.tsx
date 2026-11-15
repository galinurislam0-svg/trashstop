"use client";
import { GovStrip } from "@/components/GovStrip";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Search, Loader2, CheckCircle2, Clock3, MapPin, Truck, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { APPEAL_STEPS, appealStage, fmtTime, timeLeft } from "@/lib/meta";
import { useCityConf } from "@/components/CityProvider";

type Track = {
  code: string;
  categoryLabel: string;
  status: string;
  rated: boolean;
  address: string;
  district: string;
  createdAt: number;
  assignedAt: number | null;
  startedAt: number | null;
  doneAt: number | null;
  deadline: number | null;
  executor: string | null;
  verified: boolean | null;
  distanceM: number | null;
  afterPhoto: string | null;
};

export default function TrackPage() {
  const city = useCityConf();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Track | null>(null);

  async function check(c = code) {
    if (!c.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/track?code=${encodeURIComponent(c)}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Қате");
      setRes(j);
      history.replaceState(null, "", `/track?code=${j.code}`);
    } catch (e) {
      setRes(null);
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const c = new URLSearchParams(location.search).get("code");
    if (c) {
      setCode(c);
      check(c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stage: number = res ? appealStage(res) : -1;
  const times = res ? [res.createdAt, res.assignedAt, res.startedAt, res.doneAt, null] : [];

  return (
    <>
    <GovStrip />
    <main id="main" className="light-page a11y-zoom min-h-dvh">
      <div className="mx-auto max-w-3xl px-[var(--gutter)] py-6">
        <header className="flex items-center justify-between gap-3">
          <Logo light sub="Өтінішті тексеру" />
          <Link href="/" className="sweep-line inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-semibold">
            <ArrowLeft size={16} /> Басты бет
          </Link>
        </header>

        <h1 className="display mt-10 text-[clamp(2.6rem,1.6rem+4vw,4.5rem)] text-ink">Өтінішті тексеру</h1>
        <p className="mt-2 max-w-xl text-[18px] leading-relaxed text-muted">Өтініш нөмірін енгізіңіз. Тіркелуге немесе кіруге қажет жоқ.</p>

        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            check();
          }}
        >
          <label className="sr-only" htmlFor="code">
            Өтініш нөмірі
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="TS-1101"
            autoCapitalize="characters"
            className="mono min-h-[60px] flex-1 rounded-[6px] border-2 border-ink/20 bg-white px-5 text-[24px] tracking-wider outline-none focus:border-ink"
          />
          <button type="submit" disabled={busy} className="sweep-btn inline-flex min-h-[60px] items-center justify-center gap-2 rounded-[6px] bg-ink px-8 text-[18px] font-bold text-salt disabled:opacity-60">
            {busy ? <Loader2 className="animate-spin" /> : <Search size={20} />} Тексеру
          </button>
        </form>
        {err && (
          <div role="alert" className="mt-4 rounded-[6px] bg-qyzyl/10 px-5 py-4 text-[17px] font-medium text-qyzyl-2">
            {err}
          </div>
        )}

        {res && (
          <section className="mt-8 overflow-hidden rounded-[8px] border border-line bg-white" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-salt-2 px-6 py-5">
              <div>
                <div className="text-[13px] font-semibold uppercase tracking-wider text-muted">Өтініш нөмірі</div>
                <div className="mono text-[30px] font-semibold text-ink">{res.code}</div>
              </div>
              <div className={`rounded-full px-4 py-2 text-[16px] font-bold ${stage >= 3 ? "bg-clean text-white" : "bg-ink text-salt"}`}>{APPEAL_STEPS[Math.max(0, stage)]?.label}</div>
            </div>

            <dl className="grid gap-x-6 gap-y-4 px-6 py-5 text-[17px] sm:grid-cols-2">
              <div>
                <dt className="text-[13px] font-semibold text-muted">Санаты</dt>
                <dd className="font-semibold text-ink">{res.categoryLabel}</dd>
              </div>
              <div>
                <dt className="text-[13px] font-semibold text-muted">Мекенжайы</dt>
                <dd className="flex items-start gap-1.5 font-semibold text-ink">
                  <MapPin size={18} className="mt-0.5 shrink-0 text-qyzyl" /> {res.address}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] font-semibold text-muted">Жауапты орган</dt>
                <dd className="font-semibold text-ink">{city.responsible}</dd>
              </div>
              <div>
                <dt className="text-[13px] font-semibold text-muted">Орындаушы</dt>
                <dd className="flex items-center gap-1.5 font-semibold text-ink">
                  <Truck size={18} className="text-muted" /> {res.executor ?? "Әлі тағайындалмаған"}
                </dd>
              </div>
              {res.deadline && stage < 3 && (
                <div>
                  <dt className="text-[13px] font-semibold text-muted">Орындау мерзімі</dt>
                  <dd className={`flex items-center gap-1.5 font-semibold ${res.deadline < Date.now() ? "text-qyzyl" : "text-ink"}`}>
                    <Clock3 size={18} /> {fmtTime(res.deadline)} · {timeLeft(res.deadline, Date.now())}
                  </dd>
                </div>
              )}
              {res.verified && (
                <div>
                  <dt className="text-[13px] font-semibold text-muted">Дәлел</dt>
                  <dd className="flex items-center gap-1.5 font-semibold text-clean">
                    <ShieldCheck size={18} /> Фото {res.distanceM} м қашықтықтан расталды
                  </dd>
                </div>
              )}
            </dl>

            <ol className="border-t border-line px-6 py-6" aria-label="Өтініштің жолы">
              {APPEAL_STEPS.map((s, i) => {
                const done = i <= stage;
                const current = i === stage;
                return (
                  <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
                    {i < APPEAL_STEPS.length - 1 && <span className={`absolute left-[15px] top-8 h-[calc(100%-24px)] w-[2px] ${i < stage ? "bg-clean" : "bg-line"}`} />}
                    <span
                      className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${done ? "bg-clean text-white" : "border-2 border-line bg-white text-muted"} ${current ? "ring-4 ring-clean/20" : ""}`}
                    >
                      {done ? <CheckCircle2 size={18} /> : i + 1}
                    </span>
                    <div className="pt-0.5">
                      <div className={`text-[18px] font-bold ${done ? "text-ink" : "text-muted"}`}>{s.label}</div>
                      <div className="text-[14px] text-muted">
                        {times[i] ? fmtTime(times[i] as number) + " · " : ""}
                        {s.hint}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            {res.afterPhoto && (
              <div className="border-t border-line px-6 py-5">
                <div className="mb-2 text-[13px] font-semibold text-muted">Орындалғаннан кейінгі фото</div>
                <img src={res.afterPhoto} alt="Орындалғаннан кейінгі фото" className="max-h-80 w-full rounded-[6px] object-cover" />
              </div>
            )}
          </section>
        )}

        <p className="mt-8 text-[14px] text-muted">
          Демо жүйе: деректер тестілік. Нөміріңіз жоқ па?{" "}
          <Link href="/citizen" className="font-semibold text-ink underline underline-offset-4">
            Өтініш беру
          </Link>
        </p>
      </div>
    </main>
    </>
  );
}
