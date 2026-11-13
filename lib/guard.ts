// Беттерді серверде қорғау: сессия жоқ немесе рөл сәйкес келмесе — кіру бетіне
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeSession, SESSION_COOKIE, type Role } from "./auth";

export async function guard(path: string, roles: Role[]) {
  const s = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (!roles.includes(s.role)) redirect(`/login?next=${encodeURIComponent(path)}&denied=1`);
  return s;
}
