import { NextResponse } from "next/server";
import { getSession, ROLE_LABEL } from "@/lib/auth";

export async function GET(req: Request) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(
    { user: { id: s.uid, role: s.role, roleLabel: ROLE_LABEL[s.role], name: s.name, workerId: s.workerId ?? null, brigadeId: s.brigadeId ?? null } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
