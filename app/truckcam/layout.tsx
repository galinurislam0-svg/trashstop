import type { Metadata } from "next";
import { guard } from "@/lib/guard";

export const metadata: Metadata = { title: "Көлік камерасы", description: "Қоқыс көлігіндегі камера: ЖИ көшедегі қоқысты өзі тауып, картаға шағым ашады." };

export default async function Layout({ children }: { children: React.ReactNode }) {
  await guard("/truckcam", ["operator", "worker", "akimat"]);
  return children;
}
