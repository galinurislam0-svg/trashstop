"use client";
// Бет ауысуы: қызыл перде солдан оңға «сыпырылып» кіреді, жаңа бет ашылғанда оңға қарай кетеді.
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import gsap from "gsap";

const NAMES: Record<string, string> = {
  "/": "TrashSTOP",
  "/citizen": "Тұрғын",
  "/ops": "Оператор",
  "/worker": "Тазалықшы",
  "/inspector": "Инспектор",
  "/green": "Жасыл қор",
  "/dashboard": "Әкімдік",
  "/public": "Ашық қала",
  "/qr": "Байқап көр",
};

export function Transition() {
  const router = useRouter();
  const pathname = usePathname();
  const el = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const first = useRef(true);
  const [label, setLabel] = useState("");

  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onClick = (e: MouseEvent) => {
      if (reduce || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest("a");
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download") || a.hasAttribute("data-no-transition")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      e.preventDefault();
      if (busy.current) return;
      busy.current = true;
      const href = url.pathname + url.search;
      setLabel(NAMES[url.pathname] ?? "");
      router.prefetch(href);
      gsap.fromTo(
        el.current,
        { clipPath: "inset(0 100% 0 0)" },
        { clipPath: "inset(0 0% 0 0)", duration: 0.6, ease: "expo.inOut", onComplete: () => router.push(href) },
      );
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!busy.current) return; // артқа/алға батырмасы: пердесіз
    window.scrollTo(0, 0);
    gsap.fromTo(
      el.current,
      { clipPath: "inset(0 0% 0 0)" },
      {
        clipPath: "inset(0 0% 0 100%)",
        duration: 0.75,
        delay: 0.08,
        ease: "expo.inOut",
        onComplete: () => {
          busy.current = false;
          gsap.set(el.current, { clipPath: "inset(0 100% 0 0)" });
        },
      },
    );
  }, [pathname]);

  return (
    <div ref={el} className="curtain" aria-hidden="true">
      <span className="display text-[clamp(3rem,10vw,9rem)] text-white">{label}</span>
    </div>
  );
}
