import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ашық қала", description: "Аудандардың тазалық индексі, тазаланған жерлер және қала батырлары." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
