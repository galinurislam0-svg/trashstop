import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { rateLimited } from "@/lib/ratelimit";
import { weeklySummary } from "@/lib/ai";
import { withCity } from "@/lib/city-server";

export const maxDuration = 60;

async function POST_(req: Request) {
  try {
    requireRole(req, ["akimat", "operator"]);
  } catch (e) {
    const a = e as AuthError;
    return NextResponse.json({ error: a.message }, { status: a.status });
  }
  if (rateLimited(req, "ai", 15)) return NextResponse.json({ error: "Тым жиі сұрау. Бір минуттан кейін қайталаңыз." }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { facts?: string };
  const text = await weeklySummary(String(body.facts ?? "").slice(0, 4000), (req.headers.get("x-lang") === "ru" ? "ru" : "kk"));
  return NextResponse.json({ text });
}

export const POST = withCity(POST_);
