import { NextResponse } from "next/server";
import { resetAll, sync } from "@/lib/store";
import { aiEnabled } from "@/lib/ai";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const s = await sync();
  const me = getSession(req);
  const canSeePlates = me?.role === "inspector" || me?.role === "akimat";
  // Фотолар — тек сілтеме; көлік нөмірі — тек инспектор мен әкімдікке; аккаунттар тізімі ешқашан жіберілмейді
  const reports = s.reports.map((r) => ({
    ...r,
    plate: canSeePlates ? r.plate : r.plate ? "•••" : null,
    reporterId: r.reporterId && r.reporterId === me?.uid ? r.reporterId : null,
    mine: Boolean(me && r.reporterId === me.uid),
    // /demo/... — тестілік ашық лицензиялы фотолар, тікелей беріледі
    photo: r.photo ? (r.photo.startsWith("/demo/") ? r.photo : `/api/photo/${r.id}?k=before&v=${r.timeline.length}`) : null,
    afterPhoto: r.afterPhoto ? (r.afterPhoto.startsWith("/demo/") ? r.afterPhoto : `/api/photo/${r.id}?k=after&v=${r.timeline.length}`) : null,
  }));
  const { users, ...pub } = s;
  void users;
  return NextResponse.json({ ...pub, reports, ai: aiEnabled() }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req: Request) {
  const token = process.env.ADMIN_TOKEN;
  const given = new URL(req.url).searchParams.get("token") ?? req.headers.get("x-admin-token");
  const me = getSession(req);
  if (me?.role !== "akimat" && (!token || given !== token)) return NextResponse.json({ error: "Рұқсат жоқ" }, { status: 403 });
  await resetAll();
  return NextResponse.json({ ok: true });
}
