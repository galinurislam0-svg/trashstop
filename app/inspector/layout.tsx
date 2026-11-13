import type { Metadata } from "next";
import { guard } from "@/lib/guard";

export const metadata: Metadata = { title: "Инспектор", description: "Көліктен қоқыс тастау және қоқыс өртеу істері: дәлелдер пакеті және хаттама жобасы." };

export default async function Layout({ children }: { children: React.ReactNode }) {
  await guard("/inspector", ["inspector", "akimat"]);
  return children;
}
