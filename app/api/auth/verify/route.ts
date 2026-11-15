import { NextResponse } from "next/server";
import { checkOtp, cookieOpts, encodeSession, normalizePhone, OTP_COOKIE, readOtp, SESSION_COOKIE, SESSION_MAX_AGE, sessionFor } from "@/lib/auth";
import { rateLimited } from "@/lib/ratelimit";
import { mutate, upsertCitizen } from "@/lib/store";
import { withCity } from "@/lib/city-server";
import { DEFAULT_CITY } from "@/lib/cities";

async function POST_(req: Request) {
  if (rateLimited(req, "verify", 10)) return NextResponse.json({ error: "Тым көп әрекет" }, { status: 429 });
  const { phone, code, name } = (await req.json().catch(() => ({}))) as { phone?: string; code?: string; name?: string };
  const p = normalizePhone(phone ?? "");
  const otp = readOtp(req);
  if (!p || !code || !otp) return NextResponse.json({ error: "Код ескірді. Қайта жіберіңіз." }, { status: 400 });
  if (!checkOtp(otp, p, code)) return NextResponse.json({ error: "Код қате" }, { status: 401 });
  const u = await mutate(() => upsertCitizen(p, name?.slice(0, 60)));
  const res = NextResponse.json({ ok: true, role: u.role, name: u.name });
  res.cookies.set(SESSION_COOKIE, encodeSession(sessionFor(u)), cookieOpts(SESSION_MAX_AGE));
  res.cookies.set(OTP_COOKIE, "", cookieOpts(0));
  return res;
}

export const POST = withCity(POST_, DEFAULT_CITY);
