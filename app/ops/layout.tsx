import type { Metadata } from "next";
import { guard } from "@/lib/guard";

export const metadata: Metadata = { title: "Басқару орталығы", description: "Қызылорда бойынша барлық тазалық сигналдары бір картада: ЖИ кезегі, диспетчер және ошақтар болжамы." };

export default async function Layout({ children }: { children: React.ReactNode }) {
  await guard("/ops", ["operator", "akimat"]);
  return children;
}
