import { NextResponse } from "next/server";
import { provider } from "@/lib/fleet";
import { rateLimited } from "@/lib/ratelimit";

// Қоқыс көліктерінің қазіргі орны (GPS провайдері арқылы)
export async function GET(req: Request) {
  if (rateLimited(req, "fleet", 120)) return NextResponse.json({ error: "Тым жиі" }, { status: 429 });
  const p = provider();
  const trucks = await p.list();
  return NextResponse.json({ source: p.name, live: p.live, trucks }, { headers: { "Cache-Control": "no-store" } });
}
