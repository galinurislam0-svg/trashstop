import { NextResponse } from "next/server";
import { cookieOpts, encodeSession, SESSION_COOKIE, SESSION_MAX_AGE, sessionFor, verifyPassword } from "@/lib/auth";
import { rateLimited } from "@/lib/ratelimit";
import { findUserByLogin, sync } from "@/lib/store";
import { withCity } from "@/lib/city-server";
import { DEFAULT_CITY } from "@/lib/cities";

// Қызметкерлер: логин + құпиясөз
async function POST_(req: Request) {
  if (rateLimited(req, "login", 10)) return NextResponse.json({ error: "Тым көп әрекет. Бір минуттан кейін қайталаңыз." }, { status: 429 });
  const { login, password } = (await req.json().catch(() => ({}))) as { login?: string; password?: string };
  if (!login || !password) return NextResponse.json({ error: "Логин мен құпиясөзді енгізіңіз" }, { status: 400 });
  await sync();
  const u = findUserByLogin(login);
  if (!u || !verifyPassword(password, u.passHash)) return NextResponse.json({ error: "Логин немесе құпиясөз қате" }, { status: 401 });
  const res = NextResponse.json({ ok: true, role: u.role, name: u.name });
  res.cookies.set(SESSION_COOKIE, encodeSession(sessionFor(u)), cookieOpts(SESSION_MAX_AGE));
  return res;
}

export const POST = withCity(POST_, DEFAULT_CITY);
