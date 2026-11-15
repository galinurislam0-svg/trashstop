import { NextResponse } from "next/server";
import { etaFor } from "@/lib/fleet";
import { rateLimited } from "@/lib/ratelimit";
import { withCity } from "@/lib/city-server";

// Тұрғынға: ең жақын қоқыс көлігі қашан келеді
async function GET_(req: Request) {
  if (rateLimited(req, "eta", 60)) return NextResponse.json({ error: "Тым жиі" }, { status: 429 });
  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: "Координата қате" }, { status: 400 });
  return NextResponse.json({ eta: etaFor({ lat, lng }) }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = withCity(GET_);
