import { NextResponse } from "next/server";
import { getSession, ROLE_LABEL } from "@/lib/auth";
import { withCity } from "@/lib/city-server";
import { DEFAULT_CITY } from "@/lib/cities";

async function GET_(req: Request) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(
    { user: { id: s.uid, role: s.role, roleLabel: ROLE_LABEL[s.role], name: s.name, workerId: s.workerId ?? null, brigadeId: s.brigadeId ?? null } },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = withCity(GET_, DEFAULT_CITY);
