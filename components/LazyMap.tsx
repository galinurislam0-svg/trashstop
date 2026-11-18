"use client";
// Карта (1 МБ кітапхана) экранға жақындағанда және браузер бос кезде ғана жүктеледі.
// Тазалықшы, тұрғын, ашық лента сияқты беттерде карта басты элемент емес — телефонда бет бірден жауап берсін.
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import type MapViewType from "./MapView";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

type Idle = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };

export default function LazyMap({ delay = 0, ...props }: ComponentProps<typeof MapViewType> & { delay?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const node = box.current;
    if (!node || on) return;
    const w = window as Idle;
    let idle = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const go = () => {
      // delay: бет жүктеліп, адам алғашқы әрекетін жасап үлгерсін (мысалы, тазалықшының «Жолға шықтым» батырмасы)
      timer = setTimeout(() => {
        if (w.requestIdleCallback) idle = w.requestIdleCallback(() => setOn(true), { timeout: 700 });
        else setOn(true);
      }, delay);
    };
    if (!("IntersectionObserver" in window)) {
      go();
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          io.disconnect();
          go();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(node);
    return () => {
      io.disconnect();
      if (idle && w.cancelIdleCallback) w.cancelIdleCallback(idle);
      if (timer) clearTimeout(timer);
    };
  }, [on, delay]);
  return (
    <div ref={box} className="relative h-full w-full bg-[#ece9e2]">
      {on ? <MapView {...props} /> : <div aria-hidden className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,#ece9e2_30%,#f4f2ec_50%,#ece9e2_70%)]" />}
    </div>
  );
}
