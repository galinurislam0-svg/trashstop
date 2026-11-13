import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="light-page grid min-h-dvh content-center overflow-hidden px-[var(--gutter)] [&>*]:min-w-0">
      <p className="mono text-[13px] text-muted">404 · бет табылмады</p>
      <h1 className="display mt-4 text-[clamp(2.4rem,0.5rem+11vw,15rem)] break-words">
        Бұл жерді
        <br />
        <span className="text-qyzyl">әлі ешкім</span>
        <br />
        сыпырмаған
      </h1>
      <Link href="/" className="sweep-btn mt-10 w-fit rounded-full bg-ink px-6 py-4 text-[15px] font-semibold text-salt">
        Басты бетке оралу
      </Link>
    </main>
  );
}
