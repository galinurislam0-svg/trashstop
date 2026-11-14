// Сервердегі жады-қойма (демо үшін). Жоба өндіріске шыққанда Supabase/PostgreSQL-ге ауыстырылады.
import type { AiResult, Category, CityState, Report, Source, TreeHealth } from "./types";
import { buildSeed, buildUsers, DISTRICTS } from "./seed";
import type { Role, User } from "./auth";
import { CARE_KINDS, CATEGORY, distanceM, type CareKind } from "./meta";

import fs from "node:fs";
import { pool, ready } from "./db";
import path from "node:path";

const g = globalThis as unknown as { __trashstop?: CityState; __trashstopSeq?: number; __tsSave?: ReturnType<typeof setTimeout>; __tsVersion?: number };

// Деректер дискіге сақталады: сервер қайта іске қосылса да шағымдар мен фотолар жоғалмайды.
// Vercel-де жобаның папкасы тек оқуға арналған, сондықтан /tmp қолданылады.
const DATA_FILE =
  process.env.DATA_FILE || (process.env.VERCEL ? "/tmp/trashstop-state.json" : path.join(process.cwd(), ".data", "state.json"));

function load(): { state: CityState; seq: number } | null {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (raw?.state?.reports && raw?.state?.workers) return raw;
  } catch {
    /* файл жоқ немесе бүлінген — жаңадан бастаймыз */
  }
  return null;
}

/** Өзгерістен кейін 400 мс күтіп, дискіге бір рет жазамыз (атомарлы: уақытша файл → ауыстыру) */
export function persist() {
  if (pool) return; // дерекқор режимінде сақтауды mutate() жасайды
  if (g.__tsSave) clearTimeout(g.__tsSave);
  g.__tsSave = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      const tmp = `${DATA_FILE}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ state: g.__trashstop, seq: g.__trashstopSeq }));
      fs.renameSync(tmp, DATA_FILE);
    } catch (e) {
      console.error("[store] сақтау қатесі:", (e as Error).message);
    }
  }, 400);
}

export function getState(): CityState {
  if (!g.__trashstop) {
    const saved = load();
    g.__trashstop = saved?.state ?? buildSeed();
    g.__trashstopSeq = saved?.seq ?? 1100;
  }
  ensureUsers(g.__trashstop);
  g.__trashstop.now = Date.now();
  return g.__trashstop;
}

/** Ескі сақталған күйде аккаунттар болмаса — қосамыз (миграция) */
function ensureUsers(s: CityState) {
  if (!s.users || !s.users.length) s.users = buildUsers(s.workers, s.brigades);
}

export function findUserByLogin(login: string): User | undefined {
  return getState().users!.find((u) => u.login === login.trim().toLowerCase());
}
export function findUserById(id: string): User | undefined {
  return getState().users!.find((u) => u.id === id);
}
/** Телефон бойынша тұрғынды табу немесе жаңасын тіркеу */
export function upsertCitizen(phone: string, name?: string): User {
  const s = getState();
  let u = s.users!.find((x) => x.phone === phone);
  if (!u) {
    u = { id: `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, role: "citizen" as Role, name: name?.trim() || "Тұрғын", phone, createdAt: Date.now() };
    s.users!.push(u);
  } else if (name?.trim()) u.name = name.trim();
  persist();
  return u;
}

export function resetState() {
  g.__trashstop = buildSeed();
  g.__trashstopSeq = 1100;
  persist();
}

function nearestDistrict(lat: number, lng: number) {
  let best = DISTRICTS[0];
  let bd = Infinity;
  for (const d of DISTRICTS) {
    const dist = distanceM({ lat, lng }, d);
    if (dist < bd) {
      bd = dist;
      best = d;
    }
  }
  return best.name;
}

/** ЖИ басымдығы: санат, көлем, қауіп, қайталану және ошақ тарихы бойынша */
function scorePriority(s: CityState, cat: Category, ai: AiResult | null, lat: number, lng: number) {
  const nearby = s.reports.filter((r) => distanceM(r, { lat, lng }) < 250 && Date.now() - r.createdAt < 14 * 864e5).length;
  let score = 0;
  const reasons: string[] = [];
  if (cat === "container" || cat === "car") (score += 2), reasons.push("санитарлық қауіп");
  if (cat === "burning") (score += 3), reasons.push("өрт қаупі, ауа ластануы");
  if (ai?.hazard === "high") (score += 2), reasons.push("ЖИ: қауіптілігі жоғары");
  if (ai?.volume === "large") (score += 1), reasons.push("көлемі үлкен");
  if (nearby >= 3) (score += 2), reasons.push(`маңайда 2 аптада ${nearby} шағым — ошақ`);
  const priority = (score >= 3 ? 3 : score >= 1 ? 2 : 1) as 1 | 2 | 3;
  return { priority, reason: reasons.length ? reasons.join(" · ") : "Стандартты" };
}

export function createReport(input: {
  lat: number;
  lng: number;
  address?: string;
  description?: string;
  category?: Category;
  photo?: string | null;
  ai?: AiResult | null;
  source?: Source;
  plate?: string | null;
  reporterId?: string | null;
}): { report: Report; mergedInto?: string } {
  const s = getState();
  const now = Date.now();
  const cat = input.ai?.category ?? input.category ?? "household";

  // Қайталанған шағымдарды біріктіру: 60 м ішінде, сол санат, әлі жабылмаған
  const dup = s.reports.find(
    (r) => r.category === cat && r.status !== "done" && r.status !== "rejected" && distanceM(r, input) < 60,
  );
  if (dup && cat !== "car" && input.source !== "plan") {
    dup.merged += 1;
    dup.timeline.push({ at: now, text: "Қайталанған шағым біріктірілді", kind: "merge" });
    if (!dup.photo && input.photo) dup.photo = input.photo;
    persist();
    return { report: dup, mergedInto: dup.code };
  }

  const { priority, reason } = scorePriority(s, cat, input.ai ?? null, input.lat, input.lng);
  g.__trashstopSeq = (g.__trashstopSeq ?? 1100) + 1;
  const report: Report = {
    id: `r${now}`,
    code: `TS-${g.__trashstopSeq}`,
    createdAt: now,
    category: cat,
    status: "new",
    priority,
    priorityReason: reason,
    lat: input.lat,
    lng: input.lng,
    address: input.address || "Мекенжай анықталуда",
    district: nearestDistrict(input.lat, input.lng),
    description: input.description || input.ai?.summary || CATEGORY[cat].label,
    source: input.source ?? "app",
    photo: input.photo ?? null,
    ai: input.ai ?? null,
    brigadeId: null,
    workerId: null,
    deadline: null,
    assignedAt: null,
    startedAt: null,
    doneAt: null,
    afterPhoto: null,
    verification: null,
    rating: null,
    thanks: null,
    merged: 0,
    plate: input.plate ?? input.ai?.plate ?? null,
    reporterId: input.reporterId ?? null,
    timeline: [{ at: now, text: "Шағым түсті", kind: "create" }],
  };
  if (input.ai) report.timeline.push({ at: now, text: `ЖИ талдады: ${input.ai.summary}`, kind: "ai" });
  s.reports.unshift(report);
  if (s.reports.length > 400) s.reports.length = 400; // жадты шектеу (ашық демо)
  persist();
  return { report };
}

/** ЖИ диспетчер: ең жақын әрі ең бос бригада */
export function suggestBrigade(reportId: string) {
  const s = getState();
  const r = s.reports.find((x) => x.id === reportId);
  if (!r) return null;
  const pool = r.category === "tree" ? s.brigades.filter((b) => b.id === "b7") : s.brigades.filter((b) => b.id !== "b7");
  const ranked = pool
    .map((b) => {
      const load = s.reports.filter((x) => x.brigadeId === b.id && (x.status === "assigned" || x.status === "in_progress")).length;
      const dist = distanceM(b, r);
      // өртеу/түтін — бірінші кезекте жедел топ (b8)
      const rapid = r.category === "burning" && b.id === "b8" ? -3 : 0;
      return { brigade: b, load, dist, score: dist / 1000 + load * 0.8 + rapid };
    })
    .sort((a, b) => a.score - b.score);
  return ranked;
}

export function act(id: string, body: Record<string, unknown>) {
  const s = getState();
  const r = s.reports.find((x) => x.id === id);
  if (!r) throw new Error("Шағым табылмады");
  const now = Date.now();
  const action = body.action as string;

  if (action === "assign") {
    const brigadeId = (body.brigadeId as string) || suggestBrigade(id)?.[0]?.brigade.id || "b1";
    const ws = s.workers.filter((w) => w.brigadeId === brigadeId);
    const worker = (body.workerId as string) || (ws.length ? ws.sort((a, b) => b.rating - a.rating)[0].id : s.workers[0].id);
    r.brigadeId = brigadeId;
    r.workerId = worker;
    r.status = "assigned";
    r.assignedAt = now;
    const customH = Number(body.deadlineHours);
    r.deadline = now + (customH > 0 ? customH : CATEGORY[r.category].slaHours * (r.priority === 3 ? 0.5 : 1)) * 3600000;
    const b = s.brigades.find((x) => x.id === brigadeId);
    r.timeline.push({ at: now, text: `${b?.name ?? "Бригада"} тағайындалды`, kind: "assign" });
  } else if (action === "start") {
    r.status = "in_progress";
    r.startedAt = now;
    r.timeline.push({ at: now, text: "Орындаушы жолға шықты", kind: "start" });
  } else if (action === "complete") {
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const dist = Number.isFinite(lat) && Number.isFinite(lng) ? distanceM(r, { lat, lng }) : 9999;
    const aiClean = typeof body.aiClean === "boolean" ? (body.aiClean as boolean) : null;
    const minutes = Math.round((now - (r.assignedAt ?? r.createdAt)) / 60000);
    const reasons: string[] = [];
    if (dist > 100) reasons.push(`Фото шағым орнынан ${dist >= 1000 ? (dist / 1000).toFixed(1).replace(".", ",") + " км" : dist + " м"} қашықта түсірілген`);
    if (aiClean === false) reasons.push("ЖИ: фотода қоқыс әлі көрініп тұр");
    if (!body.photo) reasons.push("«Кейін» фотосы жоқ");
    const ok = reasons.length === 0;
    r.verification = { ok, distanceM: dist, minutesAfterAssign: minutes, aiClean, reasons };
    if (ok) {
      r.status = "done";
      r.doneAt = now;
      r.afterPhoto = (body.photo as string) ?? null;
      if (typeof body.workerId === "string") r.workerId = body.workerId;
      r.timeline.push({ at: now, text: "Фото мен геоорын расталды ✓", kind: "done" });
      const w = s.workers.find((x) => x.id === r.workerId);
      if (w) w.tasksDone += 1;
    } else {
      r.timeline.push({ at: now, text: `Растау сәтсіз: ${reasons.join("; ")}`, kind: "reject" });
    }
  } else if (action === "rate") {
    const stars = Math.max(1, Math.min(5, Number(body.rating) || 5));
    r.rating = stars;
    r.thanks = (body.thanks as string) || null;
    r.timeline.push({ at: now, text: `Тұрғын бағалады: ${"★".repeat(stars)}`, kind: "rate" });
    const w = s.workers.find((x) => x.id === r.workerId);
    if (w) {
      w.rating = Math.round(((w.rating * w.ratingsCount + stars) / (w.ratingsCount + 1)) * 10) / 10;
      w.ratingsCount += 1;
      if (r.thanks) w.thanks += 1;
    }
  } else if (action === "reject") {
    r.status = "rejected";
    r.timeline.push({ at: now, text: "Оператор қабылдамады (жалған/қайталанған)", kind: "reject" });
  } else {
    throw new Error("Белгісіз әрекет");
  }
  persist();
  return r;
}

export function thankWorker(workerId: string, stars: number) {
  const s = getState();
  const w = s.workers.find((x) => x.id === workerId);
  if (!w) throw new Error("Қызметкер табылмады");
  const st = Math.max(1, Math.min(5, stars));
  w.rating = Math.round(((w.rating * w.ratingsCount + st) / (w.ratingsCount + 1)) * 10) / 10;
  w.ratingsCount += 1;
  w.thanks += 1;
  persist();
  return w;
}

/** Картада жоқ ағашты тіркеу (фото + GPS бойынша). Аймақ, күтетін мердігер, суару — ең жақын ағаштан */
export function addTree(input: { lat: number; lng: number; species?: string; health: TreeHealth; note?: string }) {
  const s = getState();
  if (!(input.lat > 44.78 && input.lat < 44.92 && input.lng > 65.4 && input.lng < 65.62)) throw new Error("Орын Қызылорда шегінен тыс");
  const nearest = [...s.trees].sort((a, b) => distanceM(a, input) - distanceM(b, input))[0];
  const near = nearest && distanceM(nearest, input) < 600 ? nearest : null; // алыс ағаштан мәлімет көшірмейміз
  const max = s.trees.reduce((m, t) => Math.max(m, Number(t.id.slice(1)) || 0), 0);
  const now = Date.now();
  const t = {
    id: `t${max + 1}`,
    lat: input.lat,
    lng: input.lng,
    species: (input.species || "").trim().slice(0, 40) || "Белгісіз ағаш",
    planted: 0, // белгісіз
    health: input.health,
    lastWatered: near?.lastWatered ?? 0, // 0 — белгісіз
    zone: near ? near.zone : "Жаңа тіркелген нүкте",
    contractor: near?.contractor ?? "Белгісіз",
    autoIrrigation: near?.autoIrrigation ?? false,
    checkedAt: now,
    checkNote: (input.note || "").slice(0, 200) || undefined,
  };
  s.trees.push(t);
  persist();
  return t;
}

/** Көгалдандыру маманы ағаштың жағдайын тіркейді */
export function updateTree(id: string, health: TreeHealth, note?: string) {
  const s = getState();
  const t = s.trees.find((x) => x.id === id);
  if (!t) throw new Error("Ағаш табылмады");
  t.health = health;
  t.checkedAt = Date.now();
  t.checkNote = (note || "").slice(0, 200) || undefined;
  persist();
  return t;
}

/** Күтім тапсырмасын жоспарлау: жауапты (көгалдандыру бригадасы) + мерзім → орындаушыға түседі, фотомен жабылады */
export function planCare(id: string, kind: CareKind, days: number) {
  const s = getState();
  const t = s.trees.find((x) => x.id === id);
  if (!t) throw new Error("Ағаш табылмады");
  const k = CARE_KINDS[kind];
  if (!k) throw new Error("Тапсырма түрі қате");
  const { report } = createReport({
    lat: t.lat,
    lng: t.lng,
    address: `${t.zone} · ағаш #${t.id.slice(1)}`,
    description: `${k.emoji} ${k.label}: ${t.species} (#${t.id.slice(1)})`,
    category: "tree",
    source: "plan",
  });
  act(report.id, { action: "assign", brigadeId: "b7", deadlineHours: Math.max(1, Math.min(30, days)) * 24 });
  return report;
}

export function waterZone(zone: string) {
  const s = getState();
  const now = Date.now();
  let n = 0;
  for (const t of s.trees) if (t.zone === zone) (t.lastWatered = now), n++;
  persist();
  return n;
}


// ───────── Дерекқор режимі (Vercel: бірнеше сервер даналары бір күйді көреді) ─────────

/** Оқу алдында: дерекқордағы нұсқа өзгерсе, күйді қайта жүктейміз */
export async function sync(): Promise<CityState> {
  if (!pool) return getState();
  await ready();
  const v = await pool.query<{ version: string }>("SELECT version FROM ts_state WHERE id = 1");
  if (!v.rowCount) {
    const seed = buildSeed();
    await pool.query("INSERT INTO ts_state (id, doc, seq, version) VALUES (1, $1, 1100, 1) ON CONFLICT (id) DO NOTHING", [JSON.stringify(seed)]);
    return sync();
  }
  const version = Number(v.rows[0].version);
  if (version !== g.__tsVersion || !g.__trashstop) {
    const r = await pool.query<{ doc: CityState; seq: number; version: string }>("SELECT doc, seq, version FROM ts_state WHERE id = 1");
    g.__trashstop = r.rows[0].doc;
    g.__trashstopSeq = r.rows[0].seq;
    g.__tsVersion = Number(r.rows[0].version);
  }
  ensureUsers(g.__trashstop!);
  g.__trashstop!.now = Date.now();
  return g.__trashstop!;
}

/** Фотоларды бөлек кестеге шығарып, құжатта тек сілтеме қалдырамыз */
async function offloadPhotos(client: import("pg").PoolClient, s: CityState) {
  for (const r of s.reports) {
    for (const k of ["photo", "afterPhoto"] as const) {
      const v = r[k];
      if (v && v.startsWith("data:")) {
        const key = `${r.id}:${k}`;
        await client.query("INSERT INTO ts_photo (key, data) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data", [key, v]);
        r[k] = `db:${key}`;
      }
    }
  }
}

/** Өзгерту: дерекқорда жолды құлыптап (FOR UPDATE), өзгерісті қолданып, нұсқаны арттырамыз */
export async function mutate<T>(fn: () => T): Promise<T> {
  if (!pool) {
    getState();
    const out = fn();
    persist();
    return out;
  }
  await ready();
  await sync();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query<{ doc: CityState; seq: number; version: string }>("SELECT doc, seq, version FROM ts_state WHERE id = 1 FOR UPDATE");
    g.__trashstop = r.rows[0].doc;
    g.__trashstopSeq = r.rows[0].seq;
    ensureUsers(g.__trashstop);
    g.__trashstop.now = Date.now();
    const out = fn();
    await offloadPhotos(client, g.__trashstop);
    const u = await client.query<{ version: string }>("UPDATE ts_state SET doc = $1, seq = $2, version = version + 1 WHERE id = 1 RETURNING version", [
      JSON.stringify(g.__trashstop),
      g.__trashstopSeq ?? 1100,
    ]);
    await client.query("COMMIT");
    g.__tsVersion = Number(u.rows[0].version);
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    g.__tsVersion = undefined; // келесі оқуда қайта жүктейміз
    throw e;
  } finally {
    client.release();
  }
}

/** Фото: дерекқордан немесе жадтан */
export async function getPhoto(id: string, which: "photo" | "afterPhoto"): Promise<string | null> {
  const s = await sync();
  const v = s.reports.find((r) => r.id === id)?.[which] ?? null;
  if (!v || v.startsWith("/demo/")) return null; // тестілік фото ЖИ салыстыруына берілмейді
  if (v.startsWith("db:") && pool) {
    const r = await pool.query<{ data: string }>("SELECT data FROM ts_photo WHERE key = $1", [v.slice(3)]);
    return r.rows[0]?.data ?? null;
  }
  return v;
}

export async function resetAll() {
  if (!pool) return resetState();
  await mutate(() => {
    g.__trashstop = buildSeed();
    g.__trashstopSeq = 1100;
  });
}
