import type { Metadata } from "next";
import { guard } from "@/lib/guard";

export const metadata: Metadata = { title: "Жасыл қор", description: "Қала ағаштарының тізілімі, тірі қалу пайызы және ауа райы бойынша суару жоспары." };

export default async function Layout({ children }: { children: React.ReactNode }) {
  await guard("/green", ["green", "akimat"]);
  return children;
}
