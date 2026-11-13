"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { LogoMark } from "@/components/Logo";

// Таныстырылымда экранға шығатын QR: қазылар телефонымен сканерлеп, шағым жібереді
export default function QrPage() {
  const [qr, setQr] = useState("");
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = `${location.origin}/citizen`;
    setUrl(u);
    QRCode.toDataURL(u, { margin: 0, width: 760, color: { dark: "#0e0e0d", light: "#f2f1ed" } }).then(setQr);
  }, []);
  return (
    <main id="main" className="grid min-h-dvh grid-cols-12 items-center gap-[var(--gutter)] bg-qyzyl p-[var(--gutter)] text-white">
      <div className="col-span-12 md:col-span-7">
        <div className="flex items-center gap-2.5">
          <LogoMark size={34} />
          <span className="display text-[26px]">TrashStop</span>
        </div>
        <h1 className="display mt-[6vh] text-[clamp(3.5rem,1rem+9vw,10rem)]">
          Өзіңіз
          <br />
          байқап көріңіз
        </h1>
        <ol className="mt-8 space-y-2 text-[clamp(1.1rem,0.9rem+0.8vw,1.6rem)] font-medium">
          <li>
            <span className="mono mr-3 text-white/70">01</span>QR кодты сканерлеңіз
          </li>
          <li>
            <span className="mono mr-3 text-white/70">02</span>Кез келген затты суретке түсіріңіз
          </li>
          <li>
            <span className="mono mr-3 text-white/70">03</span>Ол оператордың картасында пайда болады
          </li>
        </ol>
        <div className="mono mt-8 text-[13px] text-white/80">{url}</div>
      </div>
      <div className="col-span-12 md:col-span-5">{qr && <img src={qr} alt="TrashSTOP тұрғын бетіне апаратын QR код" className="w-full max-w-[460px] bg-salt p-5" />}</div>
    </main>
  );
}
