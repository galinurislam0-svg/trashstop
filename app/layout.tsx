import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Onest, Oswald } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { Transition } from "@/components/Transition";
import { DemoBar } from "@/components/DemoBar";
import { A11yPanel, A11Y_BOOT } from "@/components/A11yPanel";
import { Translator } from "@/components/Translator";

const onest = Onest({ subsets: ["latin", "cyrillic", "cyrillic-ext"], variable: "--font-onest", display: "swap" });
const oswald = Oswald({ subsets: ["latin", "cyrillic", "cyrillic-ext"], variable: "--font-oswald", weight: ["500", "600", "700"], display: "swap" });
const jet = JetBrains_Mono({ subsets: ["latin", "cyrillic", "cyrillic-ext"], variable: "--font-jet", weight: ["400", "600"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "TrashSTOP: Қызылорданы қызылдан тазаға", template: "%s · TrashSTOP" },
  description: "Қызылорда қаласының тазалығын ЖИ арқылы бақылау жүйесі: шағымнан бастап фотомен расталған нәтижеге дейін.",
  manifest: "/manifest.webmanifest",
  openGraph: { title: "TrashSTOP: Таза Қызылорда", description: "Қоқыс шағымынан бастап фотомен расталған нәтижеге дейін, бір жүйеде.", locale: "kk_KZ", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#0e0e0d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="kk" className={`${onest.variable} ${oswald.variable} ${jet.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: A11Y_BOOT }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Мазмұнға өту
        </a>
        {children}
        <Transition />
        <DemoBar />
        <A11yPanel />
        <Translator />
      </body>
    </html>
  );
}
