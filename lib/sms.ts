// SMS жіберу: Mobizon (Қазақстан). Кілт болмаса — null қайтарады (демо режим).
// Құжат: https://help.mobizon.com/help/api-docs/message
const g = globalThis as unknown as { __mobizonHost?: string };

export function smsConfigured() {
  return Boolean(process.env.MOBIZON_API_KEY);
}

export type SmsResult = { ok: true; id: string } | { ok: false; error: string };

export async function sendSms(phone: string, text: string): Promise<SmsResult> {
  const key = process.env.MOBIZON_API_KEY;
  if (!key) return { ok: false, error: "SMS провайдері қосылмаған" };
  const recipient = phone.replace(/\D/g, ""); // халықаралық формат, тек цифрлар: 77001234567
  let host = g.__mobizonHost || process.env.MOBIZON_API_HOST || "api.mobizon.kz";

  for (let attempt = 0; attempt < 2; attempt++) {
    const url = `https://${host}/service/Message/SendSmsMessage?output=json&api=v1&apiKey=${encodeURIComponent(key)}`;
    const body = new URLSearchParams({ recipient, text });
    if (process.env.MOBIZON_FROM) body.set("from", process.env.MOBIZON_FROM); // тіркелген альфа-атау (міндетті емес)
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "cache-control": "no-cache" },
        body,
        signal: AbortSignal.timeout(8000),
      });
      const j = (await r.json().catch(() => null)) as { code?: number; data?: unknown; message?: string } | null;
      if (!j) return { ok: false, error: `SMS сервері жауап бермеді (${r.status})` };
      if (j.code === 0) {
        const d = j.data as { messageId?: number } | undefined;
        return { ok: true, id: String(d?.messageId ?? "") };
      }
      // 13 — аккаунт басқа серверде: дұрыс домен data ішінде келеді
      if (j.code === 13 && typeof j.data === "string" && j.data) {
        host = j.data.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        g.__mobizonHost = host;
        continue;
      }
      console.error("[sms] Mobizon қатесі:", j.code, j.message);
      return { ok: false, error: j.code === 30 ? "SMS лимиті асып кетті, кейінірек қайталаңыз" : "SMS жіберілмеді" };
    } catch (e) {
      console.error("[sms] желі қатесі:", (e as Error).message);
      return { ok: false, error: "SMS сервері қолжетімсіз" };
    }
  }
  return { ok: false, error: "SMS жіберілмеді" };
}
