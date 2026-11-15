import { NextResponse } from "next/server";
import { cookieOpts, SESSION_COOKIE } from "@/lib/auth";
import { withCity } from "@/lib/city-server";
import { DEFAULT_CITY } from "@/lib/cities";

async function POST_() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", cookieOpts(0));
  return res;
}

export const POST = withCity(POST_, DEFAULT_CITY);
