import { NextResponse } from "next/server";
import { cookieOpts, makeOtp, normalizePhone, OTP_COOKIE } from "@/lib/auth";
import { rateLimited } from "@/lib/ratelimit";
import { sendSms, smsConfigured } from "@/lib/sms";
import { withCity } from "@/lib/city-server";
import { DEFAULT_CITY } from "@/lib/cities";

// Бір нөмірге минутына бір код (SMS ақшасын және спамды шектеу)
const lastSent = new Map<string, number>();
// Қазыларға арналған демо нөмір: SMS жіберілмейді, код экранда көрсетіледі
const DEMO_PHONES = new Set(["+77001234567"]);

async function POST_(req: Request) {
  if (rateLimited(req, "otp", 5)) return NextResponse.json({ error: "Тым жиі. Бір минуттан кейін қайталаңыз." }, { status: 429 });
  const { phone } = (await req.json().catch(() => ({}))) as { phone?: string };
  const p = normalizePhone(phone ?? "");
  if (!p) return NextResponse.json({ error: "Телефон нөмірі қате. Үлгі: +7 700 123 45 67" }, { status: 400 });
  const prev = lastSent.get(p) ?? 0;
  if (!DEMO_PHONES.has(p) && Date.now() - prev < 60_000) return NextResponse.json({ error: `Кодты ${Math.ceil((60_000 - (Date.now() - prev)) / 1000)} секундтан кейін қайта сұраңыз` }, { status: 429 });

  const { code, token } = makeOtp(p);
  let demoCode: string | undefined;
  let via: "sms" | "demo" = "demo";
  if (smsConfigured() && !DEMO_PHONES.has(p)) {
    const r = await sendSms(p, `TrashSTOP коды / код: ${code}. Ешкімге айтпаңыз / Никому не сообщайте.`);
    if (r.ok) via = "sms";
    else if (process.env.SMS_DEMO_FALLBACK === "1") demoCode = code; // SMS істемесе — демо үшін экранға
    else return NextResponse.json({ error: r.error }, { status: 502 });
  } else demoCode = code;

  lastSent.set(p, Date.now());
  if (lastSent.size > 5000) lastSent.clear();
  const res = NextResponse.json({ ok: true, phone: p, via, demoCode });
  res.cookies.set(OTP_COOKIE, token, cookieOpts(300));
  return res;
}

export const POST = withCity(POST_, DEFAULT_CITY);
