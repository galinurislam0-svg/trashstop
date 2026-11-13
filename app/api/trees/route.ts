import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { mutate, planCare, updateTree, waterZone } from "@/lib/store";
import type { CareKind } from "@/lib/meta";
import type { TreeHealth } from "@/lib/types";

// Жасыл қор: аймақты суару, ағаш жағдайын тіркеу, күтім тапсырмасын жоспарлау
export async function POST(req: Request) {
  try {
    requireRole(req, ["green", "akimat"]);
  } catch (e) {
    const a = e as AuthError;
    return NextResponse.json({ error: a.message }, { status: a.status });
  }
  const body = (await req.json().catch(() => ({}))) as { action?: string; zone?: string; id?: string; health?: TreeHealth; note?: string; kind?: CareKind; days?: number };
  try {
    if (body.action === "health") {
      if (!body.id || !["good", "weak", "dry"].includes(body.health ?? "")) return NextResponse.json({ error: "Дерек қате" }, { status: 400 });
      return NextResponse.json({ ok: true, tree: await mutate(() => updateTree(body.id!, body.health!, body.note)) });
    }
    if (body.action === "care") {
      if (!body.id || !body.kind) return NextResponse.json({ error: "Дерек қате" }, { status: 400 });
      const r = await mutate(() => planCare(body.id!, body.kind!, Number(body.days) || 3));
      return NextResponse.json({ ok: true, code: r.code, id: r.id });
    }
    if (!body.zone) return NextResponse.json({ error: "Аймақ керек" }, { status: 400 });
    return NextResponse.json({ ok: true, watered: await mutate(() => waterZone(body.zone!)) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
