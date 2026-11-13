import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/ratelimit";
import { act, mutate, suggestBrigade, sync } from "@/lib/store";
import { AuthError, requireRole, type Role } from "@/lib/auth";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    requireRole(req, ["operator", "akimat"]);
  } catch (e) {
    const a = e as AuthError;
    return NextResponse.json({ error: a.message }, { status: a.status });
  }
  const { id } = await ctx.params;
  await sync();
  const ranked = suggestBrigade(id);
  if (!ranked) return NextResponse.json({ error: "Табылмады" }, { status: 404 });
  return NextResponse.json({
    suggestions: ranked.slice(0, 3).map((x) => ({ id: x.brigade.id, name: x.brigade.name, load: x.load, distM: x.dist })),
  });
}

// Әр әрекетке — кім рұқсат алады
const WHO: Record<string, Role[]> = {
  assign: ["operator", "akimat"],
  reject: ["operator", "akimat"],
  start: ["worker", "akimat", "operator"],
  complete: ["worker", "akimat", "operator"],
  rate: ["citizen", "akimat", "operator", "worker", "inspector", "green"],
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (rateLimited(req, "act", 60)) return NextResponse.json({ error: "Тым жиі сұрау. Бір минуттан кейін қайталаңыз." }, { status: 429 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");
  try {
    if (!WHO[action]) return NextResponse.json({ error: "Белгісіз әрекет" }, { status: 400 });
    const me = requireRole(req, WHO[action]);
    const s = await sync();
    const rep = s.reports.find((r) => r.id === id);
    if (!rep) return NextResponse.json({ error: "Шағым табылмады" }, { status: 404 });
    // Тазалықшы тек өз бригадасының тапсырмасын орындай алады
    if ((action === "start" || action === "complete") && me.role === "worker" && rep.brigadeId !== me.brigadeId)
      return NextResponse.json({ error: "Бұл тапсырма сіздің бригадаңызға берілмеген" }, { status: 403 });
    // Бағаны тек шағым иесі қояды
    if (action === "rate" && rep.reporterId !== me.uid) return NextResponse.json({ error: "Тек шағым иесі бағалай алады" }, { status: 403 });
    const payload = action === "complete" && me.role === "worker" ? { ...body, workerId: me.workerId } : body;
    const r = await mutate(() => act(id, payload));
    return NextResponse.json({ ok: true, status: r.status, verification: r.verification });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
