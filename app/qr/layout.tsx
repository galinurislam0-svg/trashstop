import type { Metadata } from "next";

export const metadata: Metadata = { title: "Байқап көріңіз", description: "QR кодты сканерлеп, TrashSTOP жүйесіне сигнал жіберіңіз." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
