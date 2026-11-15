import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { rateLimited } from "@/lib/ratelimit";
import { familyAct, familyView, getFamilyPhoto, mutate, sync } from "@/lib/store";
import { verifyClean } from "@/lib/ai";
import { withCity } from "@/lib/city-server";

export const maxDuration = 60;
// «Таза ұрпақ»: тек ата-ана (тұрғын аккаунты) өз отбасын көреді және басқарады. Демо жүргізуші (әкімдік) — көрсету үшін.
const ROLES = ["citizen", "akimat"] as const;

async function GET_(req: Request) {
  try {
    const me = requireRole(req, [...ROLES]);
    await sync();
    return NextResponse.json(familyView(me.uid), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const a = e as AuthError;
    return NextResponse.json({ error: a.message }, { status: a.status ?? 400 });
  }
}

async function POST_(req: Request) {
  if (rateLimited(req, "family", 40)) return NextResponse.json({ error: "Тым жиі сұрау" }, { status: 429 });
  let me;
  try {
    me = requireRole(req, [...ROLES]);
  } catch (e) {
    const a = e as AuthError;
    return NextResponse.json({ error: a.message }, { status: a.status });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.photo === "string" && body.photo.length > 3_000_000) return NextResponse.json({ error: "Фото тым үлкен" }, { status: 400 });
  try {
    // «Кейін» фотосын ЖИ сервердің өзі тексереді: «дейін» суретімен салыстырады
    if (body.action === "submit" && typeof body.photo === "string") {
      const before = await getFamilyPhoto(me.uid, String(body.taskId), "beforePhoto");
      try {
        const v = await verifyClean(before, body.photo, req.headers.get("x-lang") === "ru" ? "ru" : "kk");
        body.aiClean = v.demo ? null : v.clean;
        body.aiComment = v.demo ? null : v.comment;
      } catch {
        body.aiClean = null;
        body.aiComment = null;
      }
    }
    await mutate(() => familyAct(me.uid, body));
    return NextResponse.json(familyView(me.uid));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export const GET = withCity(GET_);
export const POST = withCity(POST_);
