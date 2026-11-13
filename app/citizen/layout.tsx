import type { Metadata } from "next";
import { guard } from "@/lib/guard";

export const metadata: Metadata = { title: "Тұрғын", description: "Қоқысты суретке түсіріп, бір минутта шағым жіберіңіз. ЖИ түрін, көлемін және орнын өзі анықтайды." };

export default async function Layout({ children }: { children: React.ReactNode }) {
  await guard("/citizen", ["citizen", "operator", "akimat", "inspector", "green", "worker"]);
  return children;
}
