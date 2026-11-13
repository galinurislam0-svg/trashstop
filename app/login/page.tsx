"use client";
import { GovStrip } from "@/components/GovStrip";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, Phone, KeyRound, ShieldCheck, Camera, Radar, HardHat, ShieldAlert, Trees, LayoutDashboard } from "lucide-react";
import { LogoMark } from "@/components/Logo";

type Tab = "citizen" | "staff";
const HOME: Record<string, string> = { citizen: "/citizen", worker: "/worker", operator: "/ops", inspector: "/inspector", green: "/green", akimat: "/dashboard" };
const DEMO = [
  { k: "citizen", t: "Тұрғын", d: "+7 700 123 45 67", icon: Camera },
  { k: "operator", t: "Оператор", d: "operator", p: "operator2026", icon: Radar },
  { k: "worker", t: "Тазалықшы", d: "gulzhan · 2-бригада", login: "gulzhan", p: "gulzhan2026", icon: HardHat },
  { k: "inspector", t: "Инспектор", d: "inspector", p: "inspector2026", icon: ShieldAlert },
  { k: "green", t: "Жасыл қор", d: "green", p: "green2026", icon: Trees },
  { k: "akimat", t: "Демо жүргізуші", d: "akimat · барлық бет", login: "akimat", p: "akimat2026", icon: LayoutDashboard },
] as const;

async function api<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error || "Қате");
  return j as T;
}

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>("citizen");
  const [next, setNext] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<{ phone: string; demoCode?: string; via?: string } | null>(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const n = sp.get("next");
    if (n && n.startsWith("/") && !n.startsWith("//")) setNext(n);
    setDenied(sp.get("denied") === "1");
    if (n && ["/ops", "/green", "/inspector", "/dashboard", "/worker"].includes(n)) setTab("staff");
  }, []);

  function go(role: string) {
    // Беттің өз рұқсатын сервер тексереді; рөлге сай болмаса — рөлдің басты беті
    location.href = next ?? HOME[role] ?? "/";
  }

  async function sendCode(p = phone) {
    setErr(null);
    setBusy("otp");
    try {
      const r = await api<{ phone: string; demoCode?: string }>("/api/auth/otp", { phone: p });
      setSent(r);
      setTimeout(() => codeRef.current?.focus(), 50);
      return r;
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function verify(p = phone, c = code) {
    setErr(null);
    setBusy("verify");
    try {
      const r = await api<{ role: string }>("/api/auth/verify", { phone: p, code: c, name });
      go(r.role);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  }
  async function staffLogin(l = login, pw = password) {
    setErr(null);
    setBusy("login");
    try {
      const r = await api<{ role: string }>("/api/auth/login", { login: l, password: pw });
      go(r.role);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  }
  async function demo(d: (typeof DEMO)[number]) {
    setBusy(d.k);
    if (d.k === "citizen") {
      setTab("citizen");
      setPhone(d.d);
      const r = await sendCode(d.d);
      if (r?.demoCode) {
        setCode(r.demoCode);
        await verify(r.phone, r.demoCode);
      }
      return;
    }
    const l = "login" in d ? d.login : d.d;
    setTab("staff");
    setLogin(l);
    setPassword(d.p);
    await staffLogin(l, d.p);
  }

  return (
    <>
    <GovStrip />
    <main id="main" className="a11y-zoom light-page grid min-h-dvh lg:grid-cols-2">
      <h1 className="sr-only">TrashSTOP жүйесіне кіру</h1>
      {/* Сол жақ: плакат */}
      <section className="relative hidden overflow-hidden bg-ink p-[var(--gutter)] text-salt lg:flex lg:flex-col">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark size={32} />
          <span className="display text-[22px]">
            Trash<span className="text-qyzyl">Stop</span>
          </span>
        </Link>
        <div className="display mt-auto text-[clamp(4rem,1rem+7vw,9rem)] leading-[0.86]">
          Қаланы
          <br />
          <span className="text-qyzyl">бірге</span>
          <br />
          тазалаймыз
        </div>
        <p className="mt-8 max-w-md text-[16px] leading-relaxed text-stone-300">
          Тұрғын шағымын бақылайды, тазалықшы тапсырмасын алады, оператор қаланы көреді. Әр адам тек өз рөліне қажетті нәрсені көреді.
        </p>
        <div className="mono mt-8 flex items-center gap-2 text-[12px] text-mist">
          <ShieldCheck size={14} /> Құпиясөздер scrypt хэшімен · сессия қолтаңбалы, HttpOnly
        </div>
      </section>

      {/* Оң жақ: форма */}
      <section className="flex flex-col justify-center px-[var(--gutter)] py-10">
        <div className="mx-auto w-full max-w-[440px]">
          <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <LogoMark size={28} />
            <span className="display text-[20px]">
              Trash<span className="text-qyzyl">Stop</span>
            </span>
          </Link>
          <h2 className="display text-[44px] text-ink">Кіру</h2>
          <p className="mt-1 text-[15px] text-muted">Рөліңізді таңдап, жүйеге кіріңіз.</p>
          {denied && <div className="mt-4 rounded-[6px] border border-qyzyl/30 bg-qyzyl/10 px-4 py-3 text-[14px] text-qyzyl-2">Бұл бетке сіздің рөліңізбен кіруге болмайды. Басқа аккаунтпен кіріңіз.</div>}

          <div className="mt-6 grid grid-cols-2 rounded-full bg-salt-2 p-1 text-[14px] font-semibold" role="tablist">
            {(
              [
                ["citizen", "Тұрғын", Phone],
                ["staff", "Қызметкер", KeyRound],
              ] as const
            ).map(([k, l, I]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => {
                  setTab(k);
                  setErr(null);
                }}
                className={`flex items-center justify-center gap-2 rounded-full py-2.5 transition ${tab === k ? "bg-ink text-salt" : "text-muted hover:text-ink"}`}
              >
                <I size={15} /> {l}
              </button>
            ))}
          </div>

          {tab === "citizen" ? (
            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (sent) verify();
                else sendCode();
              }}
            >
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-ink">Телефон нөмірі</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setSent(null);
                  }}
                  placeholder="+7 700 123 45 67"
                  className="w-full rounded-[6px] border border-line bg-white px-4 py-3.5 text-[17px] outline-none focus:border-ink"
                />
              </label>
              {sent && (
                <>
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-semibold text-ink">SMS коды</span>
                    <input
                      ref={codeRef}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={4}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="• • • •"
                      className="mono w-full rounded-[6px] border border-line bg-white px-4 py-3.5 text-center text-[24px] tracking-[0.5em] outline-none focus:border-ink"
                    />
                  </label>
                  {sent.demoCode ? (
                    <div className="rounded-[6px] bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800">
                      Демо режим: SMS провайдері қосылмаған. Код: <b className="mono">{sent.demoCode}</b>
                    </div>
                  ) : (
                    <div className="rounded-[6px] bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-800">
                      ✉️ Код <b>{sent.phone}</b> нөміріне SMS арқылы жіберілді
                    </div>
                  )}
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-semibold text-ink">Атыңыз (міндетті емес)</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="given-name"
                      placeholder="Мысалы: Асан"
                      className="w-full rounded-[6px] border border-line bg-white px-4 py-3.5 text-[16px] outline-none focus:border-ink"
                    />
                  </label>
                </>
              )}
              <button
                type="submit"
                disabled={!!busy}
                className="sweep-btn flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 text-[16px] font-semibold text-salt disabled:opacity-60"
              >
                {busy === "otp" || busy === "verify" ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                {sent ? "Кіру" : "Код алу"}
              </button>
            </form>
          ) : (
            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                staffLogin();
              }}
            >
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-ink">Логин</span>
                <input
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  className="w-full rounded-[6px] border border-line bg-white px-4 py-3.5 text-[17px] outline-none focus:border-ink"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-ink">Құпиясөз</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-[6px] border border-line bg-white px-4 py-3.5 text-[17px] outline-none focus:border-ink"
                />
              </label>
              <button
                type="submit"
                disabled={!!busy}
                className="sweep-btn flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 text-[16px] font-semibold text-salt disabled:opacity-60"
              >
                {busy === "login" ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />} Кіру
              </button>
            </form>
          )}
          {err && (
            <div role="alert" className="mt-3 rounded-[6px] bg-qyzyl/10 px-4 py-3 text-[14px] font-medium text-qyzyl-2">
              {err}
            </div>
          )}

          <div className="mt-8 border-t border-line pt-5">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-semibold text-ink">Демо: бір басумен кіру</span>
              <span className="mono text-[11px] text-muted">қазыларға арналған</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DEMO.map((d) => (
                <button
                  key={d.k}
                  type="button"
                  onClick={() => demo(d)}
                  disabled={!!busy}
                  className="group flex flex-col items-start gap-1 rounded-[6px] border border-line bg-white p-3 text-left transition hover:border-ink disabled:opacity-60"
                >
                  <span className="flex w-full items-center justify-between">
                    <d.icon size={17} className="text-qyzyl" />
                    {busy === d.k && <Loader2 size={14} className="animate-spin text-muted" />}
                  </span>
                  <span className="text-[14px] font-semibold text-ink">{d.t}</span>
                  <span className="mono truncate text-[10px] text-muted">{d.d}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
    </>
  );
}
