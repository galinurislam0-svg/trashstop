import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { rateLimited } from "@/lib/ratelimit";
import { mutate, thankWorker } from "@/lib/store";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    requireRole(req);
  } catch (e) {
    const a = e as AuthError;
    return NextResponse.json({ error: a.message }, { status: a.status });
  }
  if (rateLimited(req, "thanks", 30)) return NextResponse.json({ error: "Тым жиі сұрау. Бір минуттан кейін қайталаңыз." }, { status: 429 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { rating?: number };
  try {
    const w = await mutate(() => thankWorker(id, Number(body.rating) || 5));
    return NextResponse.json({ ok: true, rating: w.rating, thanks: w.thanks });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
