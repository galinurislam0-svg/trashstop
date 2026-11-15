import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { rateLimited } from "@/lib/ratelimit";
import { verifyClean } from "@/lib/ai";
import { getPhoto } from "@/lib/store";
import { withCity } from "@/lib/city-server";

export const maxDuration = 60;

async function POST_(req: Request) {
  try {
    requireRole(req);
  } catch (e) {
    const a = e as AuthError;
    return NextResponse.json({ error: a.message }, { status: a.status });
  }
  if (rateLimited(req, "ai", 15)) return NextResponse.json({ error: "Тым жиі сұрау. Бір минуттан кейін қайталаңыз." }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { photo?: string; reportId?: string };
  if (!body.photo) return NextResponse.json({ error: "Фото керек" }, { status: 400 });
  const before = body.reportId ? await getPhoto(body.reportId, "photo") : null;
  try {
    return NextResponse.json(await verifyClean(before, body.photo, (req.headers.get("x-lang") === "ru" ? "ru" : "kk")));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export const POST = withCity(POST_);
