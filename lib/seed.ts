// ТЕСТІЛІК ДЕРЕКТЕР. Қызылорда көшелерінің атаулары нақты, бірақ шағымдар, адамдар мен ағаштар ойдан құрастырылған.
import type { Brigade, Category, CityState, Report, Source, Tree, Worker } from "./types";
import { CATEGORY } from "./meta";
import REAL_ADDR from "./seed-addresses.json";

// Тестілік нүктелердің нақты мекенжайлары (OpenStreetMap-тен алдын ала алынған). Кездейсоқ тізбек өзгермеуі үшін
// fallback әрқашан есептеледі, тек нақтысы бар болса — сол қолданылады.
const realOr = (id: string, fallback: string) => (REAL_ADDR as Record<string, string>)[id] ?? fallback;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DISTRICTS = [
  { name: "Орталық", lat: 44.8495, lng: 65.5065, r: 0.006 },
  { name: "Ескі базар маңы", lat: 44.8435, lng: 65.5155, r: 0.004 },
  { name: "Ақмешіт", lat: 44.8605, lng: 65.4935, r: 0.006 },
  { name: "Шұғыла", lat: 44.8575, lng: 65.5285, r: 0.006 },
  { name: "Теміржол вокзалы", lat: 44.8395, lng: 65.4985, r: 0.005 },
  { name: "Солтүстік өнеркәсіп аймағы", lat: 44.8705, lng: 65.5155, r: 0.007 },
];

const STREETS = [
  "Әйтеке би к-сі",
  "Жібек жолы к-сі",
  "Абай даңғылы",
  "Қорқыт Ата к-сі",
  "Тоқмағамбетов к-сі",
  "Желтоқсан к-сі",
  "Қайнарбаев к-сі",
  "Сұлтан Бейбарыс к-сі",
  "Әл-Фараби к-сі",
  "Байтұрсынов к-сі",
  "Қазыбек би к-сі",
  "Мұратбаев к-сі",
];

const DESCRIPTIONS: Record<Category, string[]> = {
  household: [
    "Аула ішінде қоқыс үйіліп жатыр, иісі шығып тұр",
    "Аялдаманың жанында пакеттермен қоқыс тасталған",
    "Бос жерге тұрмыстық қоқыс төгілген",
    "Балалар алаңының қасында қоқыс шашылып жатыр",
  ],
  bulky: ["Ескі диван мен шкаф тасталған", "Ескі жиһаз бен кілемдер жол жиегінде жатыр", "Ескі тоңазытқыш тасталып кеткен"],
  construction: ["Құрылыс қалдықтары (кірпіш, бетон) төгілген", "Жөндеуден қалған қоқыс қаптармен тасталған"],
  container: ["Контейнерлер толып, айналасына қоқыс шашылған", "Контейнер 3 күннен бері босатылмаған"],
  car: ["Жүріп бара жатқан көліктен қоқыс лақтырды", "Көліктен пакетпен қоқыс тастап кетті"],
  tree: ["Жас ағаштар қурап барады, суарылмаған", "Сынған бұтақ жолға құлап жатыр", "Гүлзар тапталып, қоқысқа толған"],
  burning: ["Көрші ауласында қоқыс өртеп жатыр, түтін үйге кіріп тұр", "Бос жерде құрғақ шөп пен қоқыс жағылып жатыр", "Кешке қарай шина мен пакет өртейді, иісі қатты"],
};

const PLATES = ["123 ABC 11", "777 KZO 11", "456 BKA 11", "908 AAS 11", "315 NRT 11"];

const FIRST = [
  "Гүлжан", "Бақыт", "Сәуле", "Нұрлан", "Мәдина", "Ерлан", "Күләш", "Серік", "Райхан", "Жанат",
  "Әлия", "Қайрат", "Бибігүл", "Талғат", "Салтанат", "Мұрат", "Роза", "Асқар", "Гүлназ", "Болат",
  "Ақмарал", "Дәулет", "Шолпан", "Бауыржан", "Мейрамгүл", "Оразалы", "Зәуре", "Тұрсын", "Қаламқас", "Әбдіғали",
  "Жұпар", "Ғалым", "Күлпаш", "Сапарбек", "Ырысты", "Әділбек", "Нәзира", "Мақсат", "Перизат", "Ержан",
];
const FEMALE = new Set(["Гүлжан", "Сәуле", "Мәдина", "Күләш", "Райхан", "Әлия", "Бибігүл", "Салтанат", "Роза", "Гүлназ", "Ақмарал", "Шолпан", "Мейрамгүл", "Зәуре", "Қаламқас", "Жұпар", "Күлпаш", "Ырысты", "Нәзира", "Перизат"]);
const LAST = ["Әбенова", "Сейітов", "Құрманова", "Жұмабаев", "Әлиева", "Байменов", "Тоқтарова", "Исаев", "Нұрмаханова", "Омаров"];

const SPECIES = ["Қарағаш", "Тал", "Үйеңкі", "Шаған", "Ақ акация", "Гледичия", "Айлант", "Терек"];
const CONTRACTORS = ["«Жасыл Сыр» ЖШС", "«Көгал Сервис» ЖШС", "«Арал Green» ЖШС"];

export function buildSeed(now = Date.now()): CityState {
  const r = rng(20261113);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const around = (d: (typeof DISTRICTS)[number]) => ({
    lat: d.lat + (r() - 0.5) * 2 * d.r,
    lng: d.lng + (r() - 0.5) * 2 * d.r * 1.4,
  });

  const brigades: Brigade[] = DISTRICTS.map((d, i) => ({
    id: `b${i + 1}`,
    name: `${i + 1}-бригада`,
    district: d.name,
    lat: d.lat,
    lng: d.lng,
    vehicle: i % 2 ? "Қоқыс тасушы КамАЗ" : "Шағын жүк көлігі",
  }));
  brigades.push({ id: "b7", name: "7-бригада (көгалдандыру)", district: "Барлық аудан", lat: 44.852, lng: 65.512, vehicle: "Су тасушы көлік" });
  brigades.push({ id: "b8", name: "8-бригада (жедел топ)", district: "Барлық аудан", lat: 44.848, lng: 65.5, vehicle: "Жедел топ көлігі" });

  const workers: Worker[] = FIRST.map((f, i) => {
    const female = FEMALE.has(f);
    const last = pick(LAST);
    const base = last.replace(/(ов|ев)а$/, "$1");
    const lastName = female ? `${base}а` : base;
    return {
      id: `w${i + 1}`,
      name: `${f} ${lastName}`,
      age: 52 + Math.floor(r() * 17),
      brigadeId: `b${(i % 8) + 1}`,
      rating: Math.round((3.9 + r() * 1.1) * 10) / 10,
      ratingsCount: 8 + Math.floor(r() * 60),
      thanks: Math.floor(r() * 40),
      tasksDone: 20 + Math.floor(r() * 120),
      onTimePct: 72 + Math.floor(r() * 27),
    };
  });
  // Демо кейіпкері — тазалықшы апа
  workers[0] = { ...workers[0], name: "Гүлжан Әбенова", age: 63, brigadeId: "b2", rating: 4.9, ratingsCount: 74, thanks: 52, tasksDone: 186, onTimePct: 97 };

  const reports: Report[] = [];
  const sources: Source[] = ["egov", "bot", "109", "app", "app", "bot", "egov"];
  const H = 3600000;
  for (let i = 0; i < 78; i++) {
    // Ескі базар маңы — «ыстық нүкте»: шағымдардың үлкен бөлігі сонда
    const d = i % 4 === 0 ? DISTRICTS[1] : pick(DISTRICTS);
    const cat0: Category = pick(["household", "household", "household", "bulky", "construction", "container", "container", "car", "tree"] as Category[]);
    // бірнеше тұрмыстық шағым — «қоқыс өртеу, түтін» (кездейсоқ тізбекті өзгертпейміз)
    const cat: Category = cat0 === "household" && i % 6 === 1 && i < 70 ? "burning" : cat0;
    const createdAt = now - Math.floor(r() * 7 * 24 * H);
    const age = now - createdAt;
    const sla = CATEGORY[cat].slaHours * H;
    let status: Report["status"];
    const roll = r();
    if (age > 30 * H) status = roll < 0.82 ? "done" : roll < 0.92 ? "in_progress" : "assigned";
    else if (age > 6 * H) status = roll < 0.45 ? "done" : roll < 0.7 ? "in_progress" : roll < 0.9 ? "assigned" : "new";
    else status = roll < 0.15 ? "done" : roll < 0.35 ? "assigned" : "new";
    const p = around(d);
    const brigade = brigades.find((b) => b.district === d.name) ?? brigades[0];
    const bw = workers.filter((w) => w.brigadeId === brigade.id);
    const worker = status !== "new" ? pick(bw.length ? bw : workers) : null;
    const assignedAt = status !== "new" ? createdAt + Math.floor((0.2 + r() * 2) * H) : null;
    const deadline = assignedAt ? createdAt + sla : null;
    const lateRoll = r();
    const doneAt =
      status === "done" && assignedAt ? Math.min(now - 5 * 60000, assignedAt + Math.floor((lateRoll < 0.85 ? 0.2 + r() * 0.7 : 1.05 + r() * 0.5) * sla)) : null;
    const startedAt = status === "in_progress" || status === "done" ? (assignedAt ?? createdAt) + Math.floor(0.3 * H) : null;
    const priority = (cat === "container" || cat === "car" || d === DISTRICTS[1] ? 3 : cat === "household" ? 2 : 1) as 1 | 2 | 3;
    const rep: Report = {
      id: `r${i + 1}`,
      code: `TS-${1001 + i}`,
      createdAt,
      category: cat,
      status,
      priority,
      priorityReason: d === DISTRICTS[1] ? "Жиі қайталанатын ошақ (ескі базар)" : cat === "container" ? "Санитарлық қауіп" : "Стандартты",
      lat: p.lat,
      lng: p.lng,
      address: realOr(`r${i + 1}`, `${pick(STREETS)}, ${1 + Math.floor(r() * 120)}`),
      district: d.name,
      description: pick(DESCRIPTIONS[cat]),
      source: pick(sources),
      photo: null,
      ai: null,
      brigadeId: status !== "new" ? brigade.id : null,
      workerId: worker?.id ?? null,
      deadline,
      assignedAt,
      startedAt,
      doneAt,
      afterPhoto: null,
      verification:
        status === "done" ? { ok: true, distanceM: 8 + Math.floor(r() * 40), minutesAfterAssign: 40 + Math.floor(r() * 300), aiClean: true, reasons: [] } : null,
      rating: status === "done" && r() < 0.6 ? (r() < 0.75 ? 5 : 4) : null,
      thanks: null,
      merged: d === DISTRICTS[1] && r() < 0.5 ? 1 + Math.floor(r() * 3) : 0,
      plate: cat === "car" ? pick(PLATES) : null,
      timeline: [],
    };
    rep.timeline.push({ at: createdAt, text: `Шағым түсті: ${rep.source === "app" ? "TrashSTOP" : rep.source}`, kind: "create" });
    if (assignedAt) rep.timeline.push({ at: assignedAt, text: `${brigade.name} тағайындалды`, kind: "assign" });
    if (startedAt) rep.timeline.push({ at: startedAt, text: "Орындаушы жолға шықты", kind: "start" });
    if (doneAt) rep.timeline.push({ at: doneAt, text: "Фотомен расталды ✓", kind: "done" });
    reports.push(rep);
  }
  reports.sort((a, b) => b.createdAt - a.createdAt);
  // Ең соңғы 5 шағым — әлі ешкімге тағайындалмаған «жаңа» сигналдар
  for (const rep of reports.slice(0, 5)) {
    Object.assign(rep, { status: "new", brigadeId: null, workerId: null, deadline: null, assignedAt: null, startedAt: null, doneAt: null, verification: null, rating: null });
    rep.timeline = rep.timeline.slice(0, 1);
  }
  // Жаңалардың бірі — «көрші қоқыс өртеп жатыр» (демода оператор көруі үшін)
  const fresh = reports.slice(0, 5).find((x) => x.category === "household" && !x.plate) ?? reports[2];
  Object.assign(fresh, { category: "burning", description: DESCRIPTIONS.burning[0], priority: 3, priorityReason: "өрт қаупі, ауа ластануы" });
  // Мерзімі өткендер — тек 3-еуі (шынайы көрініс), қалғандарының мерзімі әлі бар
  const open = reports.filter((x) => x.status === "assigned" || x.status === "in_progress");
  open.forEach((rep, i) => {
    rep.deadline = i < 3 ? now - Math.floor((1 + r() * 5) * H) : now + Math.floor((2 + r() * 20) * H);
  });
  // Демо кейіпкері Гүлжанға 2 белсенді тапсырма
  open.slice(3, 5).forEach((rep, i) => {
    rep.workerId = "w1";
    rep.brigadeId = "b2";
    rep.status = i === 0 ? "in_progress" : "assigned";
  });

  const trees: Tree[] = [];
  const zones = [
    { name: "Абай даңғылы аллеясы", lat: 44.8515, lng: 65.5035, auto: true },
    { name: "Орталық саябақ", lat: 44.8478, lng: 65.5112, auto: true },
    { name: "Жібек жолы бойы", lat: 44.8555, lng: 65.5185, auto: false },
    { name: "Ақмешіт скверi", lat: 44.8615, lng: 65.4955, auto: false },
    { name: "Вокзал алаңы", lat: 44.8405, lng: 65.4995, auto: false },
    { name: "Шұғыла жаңа көшеттері", lat: 44.8585, lng: 65.5305, auto: false },
  ];
  for (let i = 0; i < 320; i++) {
    const z = zones[i % zones.length];
    const planted = 2018 + Math.floor(r() * 9);
    const young = planted >= 2024;
    const hr = r();
    const health = z.auto ? (hr < 0.82 ? "good" : hr < 0.95 ? "weak" : "dry") : young ? (hr < 0.48 ? "good" : hr < 0.75 ? "weak" : "dry") : hr < 0.7 ? "good" : hr < 0.9 ? "weak" : "dry";
    trees.push({
      id: `t${i + 1}`,
      lat: z.lat + (r() - 0.5) * 0.0045,
      lng: z.lng + (r() - 0.5) * 0.0065,
      species: pick(SPECIES),
      planted,
      health,
      lastWatered: now - Math.floor(r() * (z.auto ? 2 : 9) * 24 * H),
      zone: z.name,
      contractor: CONTRACTORS[i % 3],
      autoIrrigation: z.auto,
    });
  }

  return { users: buildUsers(workers, brigades), reports, workers, brigades, trees, now };
}

// ── Демо аккаунттар (құпиясөздер кіру бетінде көрсетіледі — тек демо үшін) ──
import { hashPassword, type User } from "./auth";
export const DEMO_STAFF = [
  { login: "operator", password: "operator2026", role: "operator", name: "Айгерім Сәрсенова" },
  { login: "inspector", password: "inspector2026", role: "inspector", name: "Нұржан Әлиев" },
  { login: "green", password: "green2026", role: "green", name: "Мадина Жүсіпова" },
  { login: "akimat", password: "akimat2026", role: "akimat", name: "Әкімдік өкілі" },
] as const;

export function buildUsers(workers: Worker[], brigades: Brigade[]): User[] {
  const now = Date.now();
  const users: User[] = DEMO_STAFF.map((d) => ({ id: `u-${d.login}`, role: d.role, name: d.name, login: d.login, passHash: hashPassword(d.password), createdAt: now }));
  // Әр бригаданың жетекшісі (бригада тапсырмаларын көреді) + Гүлжан апа
  for (const b of brigades) {
    const lead = workers.find((w) => w.brigadeId === b.id);
    if (!lead) continue;
    const n = b.id.slice(1);
    users.push({ id: `u-brigada${n}`, role: "worker", name: lead.name, login: `brigada${n}`, passHash: hashPassword(`brigada${n}`), workerId: lead.id, brigadeId: b.id, createdAt: now });
  }
  const g = workers.find((w) => w.id === "w1");
  if (g) users.push({ id: "u-gulzhan", role: "worker", name: g.name, login: "gulzhan", passHash: hashPassword("gulzhan2026"), workerId: g.id, brigadeId: g.brigadeId, createdAt: now });
  return users;
}
