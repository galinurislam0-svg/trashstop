import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/ratelimit";
import { AuthError, requireRole } from "@/lib/auth";
import { z } from "zod";
import { createReport, mutate } from "@/lib/store";

const Body = z.object({
  lat: z.number().min(40).max(56),
  lng: z.number().min(46).max(88),
  address: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  category: z.enum(["household", "bulky", "construction", "container", "car", "tree", "burning"]).optional(),
  photo: z.string().max(3_000_000).nullable().optional(),
  source: z.enum(["app", "egov", "bot", "109", "ai"]).optional(),
  plate: z.string().max(20).nullable().optional(),
  ai: z
    .object({
      category: z.enum(["household", "bulky", "construction", "container", "car", "tree", "burning"]),
      volume: z.enum(["small", "medium", "large"]),
      hazard: z.enum(["low", "medium", "high"]),
      confidence: z.number(),
      summary: z.string().max(500),
      plate: z.string().max(20).nullable().optional(),
      demo: z.boolean().optional(),
      items: z.array(z.string().max(80)).max(10).optional(),
      volumeM3: z.number().min(0).max(500).optional(),
      reason: z.string().max(300).optional(),
    })
    .nullable()
    .optional(),
});

export async function POST(req: Request) {
  if (rateLimited(req, "reports", 20)) return NextResponse.json({ error: "Тым жиі сұрау. Бір минуттан кейін қайталаңыз." }, { status: 429 });
  let me;
  try {
    me = requireRole(req);
  } catch (e) {
    const a = e as AuthError;
    return NextResponse.json({ error: a.message }, { status: a.status });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Деректер қате" }, { status: 400 });
  // «ЖИ анықтады», eGov, бот көздерін тек қызметкерлер қоя алады; тұрғыннан келгені әрқашан — қосымша
  const staff = me.role !== "citizen";
  const data = { ...parsed.data, source: staff ? parsed.data.source : ("app" as const) };
  const { report, mergedInto } = await mutate(() => createReport({ ...data, reporterId: me.uid }));
  return NextResponse.json({ id: report.id, code: report.code, mergedInto: mergedInto ?? null });
}
