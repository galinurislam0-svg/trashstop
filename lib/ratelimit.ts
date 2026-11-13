// Қарапайым жылдамдық шегі (IP бойынша, жадта): ашық демоны спамнан қорғайды
const hits = new Map<string, number[]>();

export function rateLimited(req: Request, key: string, max: number, windowMs = 60_000) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const k = `${key}:${ip}`;
  const now = Date.now();
  const arr = (hits.get(k) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(k, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}
