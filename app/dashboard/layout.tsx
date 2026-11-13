import type { Metadata } from "next";
import { guard } from "@/lib/guard";

export const metadata: Metadata = { title: "Әкімдік", description: "Тазалық қызметінің көрсеткіштері, бригадалар рейтингі және апталық есеп." };

export default async function Layout({ children }: { children: React.ReactNode }) {
  await guard("/dashboard", ["akimat", "operator"]);
  return children;
}
