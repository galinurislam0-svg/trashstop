import { CATEGORY, STATUS } from "@/lib/meta";
import type { Category, Status } from "@/lib/types";
import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";

export function StatusPill({ status, overdue }: { status: Status; overdue?: boolean }) {
  if (overdue)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-semibold text-red-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
        Мерзімі өтті
      </span>
    );
  const s = STATUS[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: s.bg, color: s.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

export function CategoryChip({ category, light }: { category: Category; light?: boolean }) {
  const c = CATEGORY[category];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold ${light ? "bg-stone-100 text-stone-700" : "bg-white/5 text-stone-200"}`}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
      {c.short}
    </span>
  );
}

export function Avatar({ name, size = 36, ring }: { name: string; size?: number; ring?: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  const hue = [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 70% 42%))`,
        boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
      }}
    >
      {initials}
    </div>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-stone-500/50"} />
      ))}
    </span>
  );
}

export function PhotoBox({ src, category, className = "" }: { src: string | null; category: Category; className?: string }) {
  if (src) return <img src={src} alt="Фото" className={`object-cover ${className}`} />;
  const c = CATEGORY[category];
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{ background: `radial-gradient(circle at 30% 20%, ${c.color}55, transparent 60%), linear-gradient(135deg, #22221f, #0e0e0d)` }}
    >
      <span className="text-3xl opacity-90">{c.emoji}</span>
    </div>
  );
}

export function TopBar({ title, sub, light, right }: { title: string; sub?: string; light?: boolean; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/"
        className={`flex h-9 w-9 items-center justify-center rounded-[4px] transition ${light ? "bg-white text-stone-700 shadow-sm hover:bg-stone-50" : "bg-white/5 text-stone-300 hover:bg-white/10"}`}
        aria-label="Басты бет"
      >
        <ArrowLeft size={18} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[15px] font-bold ${light ? "text-stone-900" : "text-white"}`}>{title}</div>
        {sub && <div className={`truncate text-xs ${light ? "text-stone-500" : "text-stone-400"}`}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function TestDataBadge({ light }: { light?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${light ? "border-amber-300 bg-amber-50 text-amber-700" : "border-amber-400/30 bg-amber-400/10 text-amber-300"}`}
    >
      Тестілік деректер
    </span>
  );
}
