import type { Metadata } from "next";
import { guard } from "@/lib/guard";

export const metadata: Metadata = { title: "Таза ұрпақ", description: "Ата-ана балаға қауіпсіз экологиялық тапсырма береді, бала аула мен ағаш түбін тазалап, ақша табады." };

export default async function Layout({ children }: { children: React.ReactNode }) {
  await guard("/family", ["citizen", "akimat"]);
  return children;
}
