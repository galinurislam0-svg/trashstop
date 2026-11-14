"use client";
// Басқару беттеріне ортақ бүйір навигация (нақты өнімдегідей)
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radar, Trees, ShieldAlert, LayoutDashboard, Smartphone, HardHat, Eye, LogOut, ScanSearch } from "lucide-react";
import { LogoMark } from "./Logo";
import { UserChip, useMe } from "./UserChip";

const ITEMS = [
  { href: "/ops", label: "Оператор", icon: Radar, roles: ["operator", "akimat"] },
  { href: "/green", label: "Жасыл қор", icon: Trees, roles: ["green", "akimat"] },
  { href: "/inspector", label: "Инспектор", icon: ShieldAlert, roles: ["inspector", "akimat"] },
  { href: "/dashboard", label: "Әкімдік", icon: LayoutDashboard, roles: ["akimat", "operator"] },
];

/** Телефонда: төменгі мәзір (бөлімдер + арнайы мүмкіндіктер + шығу) */
function MobileNav() {
  const path = usePathname();
  const me = useMe();
  const items = ITEMS.filter((it) => !me || it.roles.includes(me.role));
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    location.href = "/login";
  }
  const cell = "flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 rounded-[8px] text-[11px] font-semibold leading-none transition";
  return (
    <nav
      aria-label="Жүйе бөлімдері"
      className="no-print fixed inset-x-0 bottom-0 z-50 flex gap-1 border-t border-line-d bg-ink/95 px-2 pt-1.5 backdrop-blur lg:hidden"
      style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}
    >
      {items.map((it) => {
        const on = path === it.href;
        return (
          <Link key={it.href} href={it.href} aria-current={on ? "page" : undefined} className={`${cell} ${on ? "bg-qyzyl text-white" : "text-mist"}`}>
            <it.icon size={22} />
            {it.label.split(" ")[0]}
          </Link>
        );
      })}
      <button type="button" onClick={() => window.dispatchEvent(new Event("ts-a11y-toggle"))} className={`${cell} text-mist`}>
        <Eye size={22} />
        Aa
      </button>
      <button type="button" onClick={logout} className={`${cell} text-mist`}>
        <LogOut size={22} />
        Шығу
      </button>
    </nav>
  );
}
const MOBILE = [
  { href: "/citizen", label: "Тұрғын", icon: Smartphone },
  { href: "/worker", label: "Тазалықшы", icon: HardHat },
  { href: "/truckcam", label: "Камера", icon: ScanSearch },
];

export function Rail() {
  const path = usePathname();
  return (
    <>
    <MobileNav />
    <nav aria-label="Жүйе бөлімдері" className="no-print fixed inset-y-0 left-0 z-40 hidden w-[68px] flex-col items-center border-r border-line-d bg-ink py-4 lg:flex">
      <Link href="/" aria-label="TrashSTOP басты бет" className="mb-6">
        <LogoMark size={32} />
      </Link>
      <div className="flex flex-1 flex-col gap-1.5">
        {ITEMS.map((it) => {
          const on = path === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={on ? "page" : undefined}
              className={`group relative flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-[4px] transition ${on ? "bg-qyzyl text-white" : "text-mist hover:bg-white/5 hover:text-salt"}`}
            >
              <it.icon size={19} />
              <span className="text-[9px] font-semibold leading-none">{it.label.split(" ")[0]}</span>
            </Link>
          );
        })}
        <div className="my-3 h-px w-8 self-center bg-line-d" />
        {MOBILE.map((it) => (
          <Link key={it.href} href={it.href} className="flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-[4px] text-mist transition hover:bg-white/5 hover:text-salt">
            <it.icon size={18} />
            <span className="text-[9px] font-semibold leading-none">{it.label}</span>
          </Link>
        ))}
      </div>
      <div className="mb-3 flex flex-col items-center">
        <UserChip compact />
      </div>
      <div className="flex flex-col items-center gap-1" title="Жүйе жұмыс істеп тұр">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#3ecf7a]" />
        <span className="mono text-[9px] text-mist">LIVE</span>
      </div>
    </nav>
    </>
  );
}
