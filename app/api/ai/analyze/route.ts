import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { rateLimited } from "@/lib/ratelimit";
import { analyzeTrash } from "@/lib/ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    requireRole(req);
  } catch (e) {
    const a = e as AuthError;
    return NextResponse.json({ error: a.message }, { status: a.status });
  }
  if (rateLimited(req, "ai", 15)) return NextResponse.json({ error: "Тым жиі сұрау. Бір минуттан кейін қайталаңыз." }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { photo?: string; hint?: string };
  if (!body.photo || body.photo.length > 3_000_000) return NextResponse.json({ error: "Фото керек" }, { status: 400 });
  try {
    return NextResponse.json(await analyzeTrash(body.photo, body.hint, (req.headers.get("x-lang") === "ru" ? "ru" : "kk")));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
