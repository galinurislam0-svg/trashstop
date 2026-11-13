import type { Metadata } from "next";
import { guard } from "@/lib/guard";

export const metadata: Metadata = { title: "Тазалықшы", description: "Тазалықшының бүгінгі тапсырмалары: жолға шығу және жұмысты фотомен растау." };

export default async function Layout({ children }: { children: React.ReactNode }) {
  await guard("/worker", ["worker", "akimat", "operator"]);
  return children;
}
