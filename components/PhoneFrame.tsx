"use client";
// Ноутбукта: мемлекеттік порталдағыдай қызмет беті (тақырып, навигация жолы, жұмыс панелі, анықтама).
// Телефонда: бет толық экранда, ешқандай рамкасыз.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Link from "next/link";
import { ChevronRight, Clock3, FileSearch, ShieldCheck, Smartphone } from "lucide-react";
import { GovStrip } from "./GovStrip";
import { Logo } from "./Logo";
import { UserChip } from "./UserChip";
import { LEGAL_TERM } from "@/lib/meta";

export function PhoneFrame({ children, title, points, path }: { children: React.ReactNode; title: string; points: string[]; path: string }) {
  const [desk, setDesk] = useState(false);
  const [qr, setQr] = useState("");
  useEffect(() => {
    const mq = matchMedia("(min-width: 1024px)");
    const on = () => setDesk(mq.matches);
    on();
    mq.addEventListener("change", on);
    QRCode.toDataURL(`${location.origin}${path}`, { margin: 0, width: 200, color: { dark: "#0e0e0d", light: "#ffffff" } }).then(setQr);
    return () => mq.removeEventListener("change", on);
  }, [path]);

  if (!desk) return <>{children}</>;
  return (
    <div className="flex h-dvh flex-col bg-salt-2 text-ink">
      <GovStrip />
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-6 px-8">
          <Logo light sub={title} />
          <nav aria-label="Навигация жолы" className="flex items-center gap-1.5 text-[14px] text-muted">
            <Link href="/" className="hover:text-ink hover:underline">
              Басты бет
            </Link>
            <ChevronRight size={14} />
            <span className="font-semibold text-ink">{title}</span>
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <Link href="/track" className="sweep-line text-[14px] font-semibold">
              Өтінішті тексеру
            </Link>
            <UserChip light />
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-h-0 w-full max-w-[1280px] flex-1 grid-cols-12 gap-8 px-8 py-6">
        {/* Жұмыс панелі: fixed элементтер (батырмалар, модальдар) осы панельге бекітіледі */}
        <section className="phone-screen relative col-span-7 min-h-0 overflow-hidden rounded-[12px] border border-line bg-salt shadow-[0_20px_50px_-30px_rgba(0,0,0,.35)] xl:col-span-6 xl:col-start-2">
          <div className="h-full overflow-y-auto overflow-x-hidden scroll-thin">{children}</div>
        </section>

        <aside className="col-span-5 flex min-h-0 flex-col gap-4 overflow-y-auto scroll-thin xl:col-span-4">
          <div className="rounded-[12px] border border-line bg-white p-6">
            <h2 className="display text-[40px] leading-none">{title}</h2>
            <ol className="mt-5 space-y-3 text-[16px] leading-snug">
              {points.map((p, i) => (
                <li key={p} className="flex gap-3">
                  <span className="mono mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] text-salt">{i + 1}</span>
                  <span>{p}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="grid gap-3 rounded-[12px] border border-line bg-white p-5 text-[14px] leading-snug">
            <div className="flex gap-3">
              <Clock3 size={20} className="shrink-0 text-qyzyl" />
              <span>{LEGAL_TERM}</span>
            </div>
            <div className="flex gap-3">
              <ShieldCheck size={20} className="shrink-0 text-clean" />
              <span>Жұмыс тек фото мен геоорын сәйкес келгенде ғана «орындалды» деп жабылады.</span>
            </div>
            <Link href="/track" className="flex items-center gap-3 font-semibold hover:underline">
              <FileSearch size={20} className="shrink-0" /> Өтініш нөмірі бойынша мәртебесін тексеру
            </Link>
          </div>
          {qr && (
            <div className="flex items-center gap-4 rounded-[12px] border border-line bg-white p-5">
              <img src={qr} alt="Бұл бетті телефонда ашатын QR код" className="h-24 w-24" />
              <div className="text-[14px] leading-snug text-muted">
                <Smartphone size={18} className="mb-1 text-ink" />
                Телефонмен сканерлеп, нақты құрылғыда байқап көріңіз.
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
