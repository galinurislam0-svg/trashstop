import Link from "next/link";

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <path d="M12.4 2h15.2L38 12.4v15.2L27.6 38H12.4L2 27.6V12.4z" fill="#E2231A" />
      <path
        d="M14 15h12M17.5 15v-1.6c0-.6.5-1.1 1.1-1.1h2.8c.6 0 1.1.5 1.1 1.1V15M15.5 15l.9 12.2c.1.9.8 1.5 1.7 1.5h3.8c.9 0 1.6-.6 1.7-1.5l.9-12.2"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M18.7 18.5v6.5M21.3 18.5v6.5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ light = false, sub }: { light?: boolean; sub?: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 select-none" aria-label="TrashSTOP басты бет">
      <LogoMark size={30} />
      <div className="leading-none">
        <div className={`display text-[20px] tracking-normal ${light ? "text-ink" : "text-salt"}`}>
          Trash<span className="text-qyzyl">Stop</span>
        </div>
        {sub && <div className={`mt-1 text-[11px] font-medium ${light ? "text-muted" : "text-mist"}`}>{sub}</div>}
      </div>
    </Link>
  );
}
