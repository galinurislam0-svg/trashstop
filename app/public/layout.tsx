import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ашық қала", description: "Қала жаңалығы: фото мен GPS арқылы расталған жұмыстар (дейін → кейін), аудандардың тазалық индексі және қала батырлары." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
