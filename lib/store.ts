// Сервердегі жады-қойма (демо үшін). Жоба өндіріске шыққанда Supabase/PostgreSQL-ге ауыстырылады.
import type { AiResult, Category, CityState, Family, FamTask, Report, Source, TreeHealth } from "./types";
import { FAM_MAX_TOPUP, FAM_TEMPLATES, type FamTemplate } from "./family";
import { buildSeed, buildUsers, districtsFor } from "./seed";
import { serverCity, runInCity } from "./city-server";
import { CITIES, CITY_IDS, DEFAULT_CITY, inBounds, type CityId } from "./cities";
import type { Role, User } from "./auth";
import { CARE_KINDS, CATEGORY, distanceM, type CareKind } from "./meta";

import fs from "node:fs";
import { pool, ready } from "./db";
import path from "node:path";

// Әр қаланың күйі бөлек «слотта» сақталады: қалалардың деректері ешқашан араласпайды.
type Slot = { state?: CityState; seq?: number; version?: number; save?: ReturnType<typeof setTimeout> };
const g = globalThis as unknown as { __tsCities?: Partial<Record<CityId, Slot>> };
function slot(city: CityId = serverCity()): Slot {
  g.__tsCities ??= {};
  return (g.__tsCities[city] ??= {});
}

// Деректер дискіге сақталады: сервер қайта іске қосылса да шағымдар мен фотолар жоғалмайды.
// Vercel-де жобаның папкасы тек оқуға арналған, сондықтан /tmp қолданылады.
function dataFile(city: CityId) {
  const base = process.env.DATA_FILE || (process.env.VERCEL ? "/tmp/trashstop-state.json" : path.join(process.cwd(), ".data", "state.json"));
  return city === DEFAULT_CITY ? base : base.replace(/\.json$/, `-${city}.json`);
}

function load(city: CityId): { state: CityState; seq: number } | null {
  try {
    const raw = JSON.parse(fs.readFileSync(dataFile(city), "utf8"));
    if (raw?.state?.reports && raw?.state?.workers) return raw;
  } catch {
    /* файл жоқ немесе бүлінген — жаңадан бастаймыз */
  }
  return null;
}

/** Өзгерістен кейін 400 мс күтіп, дискіге бір рет жазамыз (атомарлы: уақытша файл → ауыстыру) */
export function persist() {
  if (pool) return; // дерекқор режимінде сақтауды mutate() жасайды
  const city = serverCity();
  const sl = slot(city);
  if (sl.save) clearTimeout(sl.save);
  sl.save = setTimeout(() => {
    try {
      const file = dataFile(city);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ state: sl.state, seq: sl.seq }));
      fs.renameSync(tmp, file);
    } catch (e) {
      console.error("[store] сақтау қатесі:", (e as Error).message);
    }
  }, 400);
}

export function getState(): CityState {
  const city = serverCity();
  const sl = slot(city);
  if (!sl.state) {
    const saved = load(city);
    sl.state = saved?.state ?? buildSeed(Date.now(), city);
    sl.seq = saved?.seq ?? CITIES[city].codeBase + 100;
  }
  ensureUsers(sl.state);
  sl.state.now = Date.now();
  return sl.state;
}

/** Шағым нөмірінің есептегіші (қала бойынша) */
function nextSeq() {
  const sl = slot();
  sl.seq = (sl.seq ?? CITIES[serverCity()].codeBase + 100) + 1;
  return sl.seq;
}

/** Ескі сақталған күйде аккаунттар болмаса — қосамыз (миграция) */
function ensureUsers(s: CityState) {
  if (!s.users || !s.users.length) s.users = buildUsers(s.workers, s.brigades);
}

// Аккаунттар ортақ: олар әрқашан негізгі қаланың күйінде сақталады (auth маршруттары сол қалада жұмыс істейді)
export function findUserByLogin(login: string): User | undefined {
  return runInCity(DEFAULT_CITY, () => getState().users!.find((u) => u.login === login.trim().toLowerCase()));
}
export function findUserById(id: string): User | undefined {
  return runInCity(DEFAULT_CITY, () => getState().users!.find((u) => u.id === id));
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
  const sl = slot();
  sl.state = buildSeed(Date.now(), serverCity());
  sl.seq = CITIES[serverCity()].codeBase + 100;
  persist();
}

function nearestDistrict(lat: number, lng: number) {
  const ds = districtsFor(serverCity());
  let best = ds[0];
  let bd = Infinity;
  for (const d of ds) {
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
  const seqNo = nextSeq();
  const report: Report = {
    id: `r${now}`,
    code: `TS-${seqNo}`,
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
  const cc = CITIES[serverCity()];
  if (!inBounds(cc, input)) throw new Error(`Орын ${cc.name} шегінен тыс`);
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

/** Оқу алдында: дерекқордағы нұсқа өзгерсе, күйді қайта жүктейміз (әр қала — өз жолы) */
export async function sync(): Promise<CityState> {
  if (!pool) return getState();
  await ready();
  const city = serverCity();
  const id = CITIES[city].dbId;
  const sl = slot(city);
  const v = await pool.query<{ version: string }>("SELECT version FROM ts_state WHERE id = $1", [id]);
  if (!v.rowCount) {
    const seed = buildSeed(Date.now(), city);
    await pool.query("INSERT INTO ts_state (id, doc, seq, version) VALUES ($1, $2, $3, 1) ON CONFLICT (id) DO NOTHING", [id, JSON.stringify(seed), CITIES[city].codeBase + 100]);
    return sync();
  }
  const version = Number(v.rows[0].version);
  if (version !== sl.version || !sl.state) {
    const r = await pool.query<{ doc: CityState; seq: number; version: string }>("SELECT doc, seq, version FROM ts_state WHERE id = $1", [id]);
    sl.state = r.rows[0].doc;
    sl.seq = r.rows[0].seq;
    sl.version = Number(r.rows[0].version);
  }
  ensureUsers(sl.state!);
  sl.state!.now = Date.now();
  return sl.state!;
}

/** Фото кілті: негізгі қалада бұрынғыдай, басқа қалаларда — қала атауымен (кілттер қақтығыспауы үшін) */
function photoKey(base: string) {
  const city = serverCity();
  return city === DEFAULT_CITY ? base : `${city}:${base}`;
}

/** Фотоларды бөлек кестеге шығарып, құжатта тек сілтеме қалдырамыз */
async function offloadPhotos(client: import("pg").PoolClient, s: CityState) {
  for (const f of s.families ?? [])
    for (const t of f.tasks)
      for (const k of ["beforePhoto", "afterPhoto"] as const) {
        const v = t[k];
        if (v && v.startsWith("data:")) {
          const key = photoKey(`fam:${t.id}:${k}`);
          await client.query("INSERT INTO ts_photo (key, data) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data", [key, v]);
          t[k] = `db:${key}`;
        }
      }
  for (const r of s.reports) {
    for (const k of ["photo", "afterPhoto"] as const) {
      const v = r[k];
      if (v && v.startsWith("data:")) {
        const key = photoKey(`${r.id}:${k}`);
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
  const city = serverCity();
  const id = CITIES[city].dbId;
  const sl = slot(city);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query<{ doc: CityState; seq: number; version: string }>("SELECT doc, seq, version FROM ts_state WHERE id = $1 FOR UPDATE", [id]);
    sl.state = r.rows[0].doc;
    sl.seq = r.rows[0].seq;
    ensureUsers(sl.state);
    sl.state.now = Date.now();
    const out = fn();
    await offloadPhotos(client, sl.state);
    const u = await client.query<{ version: string }>("UPDATE ts_state SET doc = $1, seq = $2, version = version + 1 WHERE id = $3 RETURNING version", [
      JSON.stringify(sl.state),
      sl.seq ?? CITIES[city].codeBase + 100,
      id,
    ]);
    await client.query("COMMIT");
    sl.version = Number(u.rows[0].version);
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    sl.version = undefined; // келесі оқуда қайта жүктейміз
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

/** Ағымдағы қаланың демо деректерін қайта жасау */
export async function resetAll() {
  if (!pool) return resetState();
  const city = serverCity();
  await mutate(() => {
    const sl = slot(city);
    sl.state = buildSeed(Date.now(), city);
    sl.seq = CITIES[city].codeBase + 100;
  });
}

/** Барлық қаланың демо деректерін қайта жасау */
export async function resetEveryCity() {
  for (const c of CITY_IDS) await runInCity(c, () => resetAll());
}


// ───────── «Таза ұрпақ»: отбасы әмияны және балаға экологиялық тапсырмалар ─────────

function famOf(s: CityState, parentId: string): Family {
  s.families ??= [];
  let f = s.families.find((x) => x.parentId === parentId);
  if (!f) {
    f = { parentId, balance: 0, kids: [], tasks: [] };
    s.families.push(f);
  }
  return f;
}

/** Ата-ана өз отбасын ғана көреді (фото — сілтеме ретінде) */
export function familyView(parentId: string) {
  const s = getState();
  const f = (s.families ?? []).find((x) => x.parentId === parentId) ?? { parentId, balance: 0, kids: [], tasks: [] };
  return {
    ...f,
    tasks: [...f.tasks]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((t) => ({
        ...t,
        beforePhoto: t.beforePhoto ? `/api/family/photo?task=${t.id}&k=before` : null,
        afterPhoto: t.afterPhoto ? `/api/family/photo?task=${t.id}&k=after` : null,
      })),
  };
}

export function familyAct(parentId: string, body: Record<string, unknown>): void {
  const s = getState();
  const f = famOf(s, parentId);
  const now = Date.now();
  const a = String(body.action ?? "");
  const task = (id: unknown) => {
    const t = f.tasks.find((x) => x.id === id);
    if (!t) throw new Error("Тапсырма табылмады");
    return t;
  };

  if (a === "topup") {
    const amt = Math.round(Number(body.amount));
    if (!(amt > 0 && amt <= FAM_MAX_TOPUP)) throw new Error("Сома қате");
    if (f.balance + amt > 100000) throw new Error("Демо әмиянның шегі — 100 000 ₸");
    f.balance += amt;
  } else if (a === "addKid") {
    const name = String(body.name ?? "").trim().slice(0, 24);
    if (name.length < 2) throw new Error("Баланың атын жазыңыз");
    if (f.kids.length >= 6) throw new Error("Ең көбі 6 бала");
    f.kids.push({ id: `k${now}`, name, saved: 0 });
  } else if (a === "addTask") {
    const tpl = FAM_TEMPLATES[String(body.template) as FamTemplate];
    if (!tpl) throw new Error("Тапсырма түрі қате");
    const kid = f.kids.find((k) => k.id === body.kidId);
    if (!kid) throw new Error("Баланы таңдаңыз");
    const reward = Math.round(Number(body.reward) || tpl.reward);
    if (!(reward >= 100 && reward <= 10000)) throw new Error("Сыйақы 100–10 000 ₸ аралығында болсын");
    if (f.balance < reward) throw new Error("Әмиянда ақша жеткіліксіз — алдымен толтырыңыз");
    f.balance -= reward; // резервке аламыз: бала орындап, ата-ана растағанда беріледі
    const t: FamTask = {
      id: `ft${now}`, kidId: kid.id, template: String(body.template), title: tpl.title, level: tpl.level, reward, status: "open",
      createdAt: now, startedAt: null, submittedAt: null, doneAt: null, beforePhoto: null, afterPhoto: null,
      lat: null, lng: null, distanceM: null, aiClean: null, aiComment: null, note: null,
    };
    f.tasks.push(t);
  } else if (a === "cancel") {
    const t = task(body.taskId);
    if (t.status !== "open" && t.status !== "started") throw new Error("Бұл тапсырманы енді тоқтатуға болмайды");
    f.balance += t.reward;
    f.tasks = f.tasks.filter((x) => x.id !== t.id);
  } else if (a === "start") {
    const t = task(body.taskId);
    if (t.status !== "open" && t.status !== "rejected") throw new Error("Тапсырма басталып қойған");
    if (typeof body.photo !== "string" || !body.photo.startsWith("data:image/")) throw new Error("«Дейін» фотосы керек");
    t.beforePhoto = body.photo;
    t.afterPhoto = null;
    t.lat = Number.isFinite(Number(body.lat)) ? Number(body.lat) : null;
    t.lng = Number.isFinite(Number(body.lng)) ? Number(body.lng) : null;
    t.status = "started";
    t.startedAt = now;
    t.note = null;
  } else if (a === "submit") {
    const t = task(body.taskId);
    if (t.status !== "started") throw new Error("Алдымен «дейін» фотосын түсіріңіз");
    if (typeof body.photo !== "string" || !body.photo.startsWith("data:image/")) throw new Error("«Кейін» фотосы керек");
    const lat = Number(body.lat), lng = Number(body.lng);
    t.distanceM = t.lat !== null && t.lng !== null && Number.isFinite(lat) && Number.isFinite(lng) ? Math.round(distanceM({ lat: t.lat, lng: t.lng }, { lat, lng })) : null;
    t.aiClean = typeof body.aiClean === "boolean" ? body.aiClean : null;
    t.aiComment = typeof body.aiComment === "string" ? body.aiComment.slice(0, 200) : null;
    t.afterPhoto = body.photo;
    t.submittedAt = now;
    t.status = "review";
  } else if (a === "approve") {
    const t = task(body.taskId);
    if (t.status !== "review") throw new Error("Растайтын тапсырма жоқ");
    const kid = f.kids.find((k) => k.id === t.kidId);
    if (kid) kid.saved += t.reward;
    t.status = "paid";
    t.doneAt = now;
  } else if (a === "reject") {
    const t = task(body.taskId);
    if (t.status !== "review") throw new Error("Қайтаратын тапсырма жоқ");
    t.status = "rejected";
    t.note = String(body.note ?? "").slice(0, 160) || "Қайта жасап көр";
  } else throw new Error("Белгісіз әрекет");
}

export async function getFamilyPhoto(parentId: string, taskId: string, which: "beforePhoto" | "afterPhoto"): Promise<string | null> {
  const s = await sync();
  const t = (s.families ?? []).find((x) => x.parentId === parentId)?.tasks.find((x) => x.id === taskId);
  const v = t?.[which] ?? null;
  if (!v) return null;
  if (v.startsWith("db:") && pool) {
    const r = await pool.query<{ data: string }>("SELECT data FROM ts_photo WHERE key = $1", [v.slice(3)]);
    return r.rows[0]?.data ?? null;
  }
  return v.startsWith("data:") ? v : null;
}
