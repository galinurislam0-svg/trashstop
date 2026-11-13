import type { Metadata } from "next";

export const metadata: Metadata = { title: "Өтінішті тексеру", description: "Өтініш нөмірі бойынша оның мәртебесін тексеріңіз: тіркелді, орындаушыға жіберілді, орындалды." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
