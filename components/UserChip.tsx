"use client";
// Кірген адам + шығу батырмасы
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";

export type Me = { id: string; role: string; roleLabel: string; name: string; workerId: string | null; brigadeId: string | null };

export function useMe() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setMe(j.user))
      .catch(() => setMe(null));
  }, []);
  return me;
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  location.href = "/login";
}

export function UserChip({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  const me = useMe();
  if (!me) return null;
  return (
    <div className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-1 ${light ? "bg-white shadow-sm" : "bg-white/5"}`}>
      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold ${light ? "bg-ink text-salt" : "bg-salt text-ink"}`}>
        {me.name.slice(0, 1)}
      </span>
      {!compact && (
        <span className="max-w-[140px] leading-tight">
          <span className={`block truncate text-[12px] font-semibold ${light ? "text-ink" : "text-salt"}`}>{me.name}</span>
          <span className={`block text-[10px] ${light ? "text-muted" : "text-mist"}`}>{me.roleLabel}</span>
        </span>
      )}
      <button
        onClick={logout}
        aria-label="Шығу"
        title="Шығу"
        className={`flex h-7 w-7 items-center justify-center rounded-full transition ${light ? "text-muted hover:bg-salt-2 hover:text-ink" : "text-mist hover:bg-white/10 hover:text-salt"}`}
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}
