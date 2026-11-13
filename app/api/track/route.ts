import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/ratelimit";
import { sync } from "@/lib/store";
import { CATEGORY } from "@/lib/meta";

// Өтінішті нөмірі бойынша тексеру — кірусіз, тек жеке мәліметсіз ақпарат (eOtinish логикасы)
export async function GET(req: Request) {
  if (rateLimited(req, "track", 30)) return NextResponse.json({ error: "Тым жиі" }, { status: 429 });
  const code = (new URL(req.url).searchParams.get("code") ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const norm = /^\d+$/.test(code) ? `TS-${code}` : code;
  if (!/^TS-\d{3,6}$/.test(norm)) return NextResponse.json({ error: "Өтініш нөмірі қате. Үлгі: TS-1101" }, { status: 400 });
  const s = await sync();
  const r = s.reports.find((x) => x.code === norm);
  if (!r) return NextResponse.json({ error: "Мұндай нөмірмен өтініш табылмады" }, { status: 404 });
  const brigade = s.brigades.find((b) => b.id === r.brigadeId);
  return NextResponse.json(
    {
      code: r.code,
      category: r.category,
      categoryLabel: CATEGORY[r.category].label,
      status: r.status,
      rated: r.rating !== null,
      address: r.address,
      district: r.district,
      createdAt: r.createdAt,
      assignedAt: r.assignedAt,
      startedAt: r.startedAt,
      doneAt: r.doneAt,
      deadline: r.deadline,
      executor: brigade ? brigade.name : null,
      verified: r.verification?.ok ?? null,
      distanceM: r.verification?.ok ? r.verification.distanceM : null,
      afterPhoto: r.afterPhoto ? `/api/photo/${r.id}?k=after&v=${r.timeline.length}` : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
