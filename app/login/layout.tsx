import type { Metadata } from "next";

export const metadata: Metadata = { title: "Кіру", description: "TrashSTOP жүйесіне тұрғын немесе қызметкер ретінде кіру." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
