// Аутентификация: scrypt құпиясөз хэштері, HMAC-қолтаңбалы сессия cookie (серверде күй сақтамайды —
// Vercel-дің кез келген данасы тексере алады), телефонға бір реттік код (OTP).
import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

export type Role = "citizen" | "worker" | "operator" | "inspector" | "green" | "akimat";

export const ROLE_LABEL: Record<Role, string> = {
  citizen: "Тұрғын",
  worker: "Тазалықшы",
  operator: "Оператор",
  inspector: "Инспектор",
  green: "Көгалдандыру маманы",
  akimat: "Әкімдік",
};

export interface User {
  id: string;
  role: Role;
  name: string;
  login?: string;
  phone?: string;
  passHash?: string;
  workerId?: string;
  brigadeId?: string;
  createdAt: number;
}

export interface Session {
  uid: string;
  role: Role;
  name: string;
  workerId?: string;
  brigadeId?: string;
  exp: number;
}

export const SESSION_COOKIE = "ts_session";
export const OTP_COOKIE = "ts_otp";
const SESSION_DAYS = 14;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.VERCEL) throw new Error("SESSION_SECRET орнатылмаған");
  return "dev-only-trashstop-secret-change-me";
}

// ── Құпиясөз ──
export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(pw, salt, 32).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}
export function verifyPassword(pw: string, stored?: string) {
  if (!stored?.startsWith("scrypt$")) return false;
  const [, salt, hash] = stored.split("$");
  const got = scryptSync(pw, salt, 32);
  const want = Buffer.from(hash, "base64url");
  return want.length === got.length && timingSafeEqual(got, want);
}

// ── Қолтаңбалы токен ──
function sign(payload: object) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}
function unsign<T extends { exp: number }>(token?: string | null): T | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const want = createHmac("sha256", secret()).update(body).digest();
  const got = Buffer.from(mac, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as T;
    return p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}

export function sessionFor(u: User): Session {
  return { uid: u.id, role: u.role, name: u.name, workerId: u.workerId, brigadeId: u.brigadeId, exp: Date.now() + SESSION_DAYS * 864e5 };
}
export const encodeSession = (s: Session) => sign(s);
export const decodeSession = (t?: string | null) => unsign<Session>(t);

export function cookieOpts(maxAgeSec: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: maxAgeSec };
}
export const SESSION_MAX_AGE = SESSION_DAYS * 86400;

function readCookie(req: Request, name: string) {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

export function getSession(req: Request): Session | null {
  return decodeSession(readCookie(req, SESSION_COOKIE));
}

/** Рұқсат тексеру: жоқ болса — 401/403 жауабын лақтырамыз */
export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}
export function requireRole(req: Request, roles?: Role[]): Session {
  const s = getSession(req);
  if (!s) throw new AuthError(401, "Алдымен жүйеге кіріңіз");
  if (roles && !roles.includes(s.role)) throw new AuthError(403, "Бұл әрекетке рұқсатыңыз жоқ");
  return s;
}

// ── Телефонға бір реттік код ──
export function normalizePhone(p: string) {
  const d = p.replace(/\D/g, "");
  const n = d.length === 11 && (d.startsWith("8") || d.startsWith("7")) ? d.slice(1) : d.length === 10 ? d : null;
  return n && n.startsWith("7") ? `+7${n}` : null;
}
export function makeOtp(phone: string) {
  const code = String(randomInt(1000, 10000));
  const codeHash = createHmac("sha256", secret()).update(`${phone}:${code}`).digest("base64url");
  return { code, token: sign({ phone, codeHash, tries: 0, exp: Date.now() + 5 * 60_000 }) };
}
export function readOtp(req: Request) {
  return unsign<{ phone: string; codeHash: string; exp: number }>(readCookie(req, OTP_COOKIE));
}
export function checkOtp(otp: { phone: string; codeHash: string }, phone: string, code: string) {
  if (otp.phone !== phone) return false;
  const h = createHmac("sha256", secret()).update(`${phone}:${code.trim()}`).digest();
  const want = Buffer.from(otp.codeHash, "base64url");
  return h.length === want.length && timingSafeEqual(h, want);
}
