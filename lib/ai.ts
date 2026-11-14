import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { AiResult } from "./types";

const MODEL = "claude-opus-5-5";

const TrashSchema = z.object({
  is_trash: z.boolean(),
  needs_retake: z.boolean(),
  retake_reason: z.string().nullable(),
  items: z.array(z.string()),
  category: z.enum(["household", "bulky", "construction", "container", "car", "tree", "burning"]),
  reason: z.string(),
  volume_m3: z.number(),
  volume: z.enum(["small", "medium", "large"]),
  hazard: z.enum(["low", "medium", "high"]),
  confidence: z.number(),
  summary: z.string(),
  plate: z.string().nullable(),
});

// Санаттардың нақты анықтамасы — модель шатаспауы үшін
const TRASH_GUIDE = `Сен — Қызылорда қаласының тазалық қызметінің сарапшысысың. Фотоны мұқият қарап, тек көрініп тұрған нәрсеге сүйен, ойдан қоспа.

1) Алдымен фотода нақты не бар екенін анықта: items — көрінген заттардың қазақша тізімі (3–8 зат, нақты: «қара полиэтилен пакеттер», «пластик бөтелкелер», «ескі диван», «кірпіш сынықтары», «толған жасыл контейнер»).

2) category — ТЕК біреуі, мына ережемен:
- container: қоқыс контейнері/урна КӨРІНІП ТҰР және ол толы немесе айналасы шашылған. Контейнер көрінсе — басымдық осы санатқа.
- bulky: басым бөлігі ірі заттар — диван, кереует, матрас, шкаф, үстел, есік, кілем, тоңазытқыш, кір жуғыш машина.
- construction: құрылыс қалдығы — кірпіш, бетон, сылақ, гипсокартон, плитка, құм/қиыршық үйіндісі, құрылыс қаптары, арматура.
- household: тұрмыстық қоқыс контейнерден тыс жерде — пакеттер, тамақ қалдықтары, пластик, қағаз, шыны, ұсақ заттар.
- car: көліктен қоқыс тастау сәті немесе қоқыс жанында тұрған көлік (көлік анық көрінсе ғана).
- tree: жасыл екпе мәселесі — қураған/сынған ағаш, кесілген бұтақтар үйіндісі, тапталған гүлзар.
- burning: қоқыс, шөп, жапырақ, шина, пакет ӨРТЕЛІП жатыр немесе өртелген — от, түтін, күл, күйген қоқыс іздері көрінсе. От немесе түтін көрінсе — басымдық ОСЫ санатқа (контейнер көрінсе де).
Аралас болса — көлемі бойынша басым түрін таңда. reason — неге осы санатты таңдағаныңды 1 сөйлеммен түсіндір.

3) volume_m3 — шамамен көлем (м³). Эталондар: 1 үлкен пакет ≈ 0,05 м³; стандарт контейнер = 1,1 м³; диван ≈ 1,5 м³; жеңіл жүк көлігінің шанағы ≈ 3 м³. volume: small (< 0,5 м³), medium (0,5–3 м³), large (> 3 м³) — volume_m3-пен сәйкес болсын.

4) hazard: high — шприц/медициналық қалдық, химия, аккумулятор, шина, асбест, өрт/түтін, жолды немесе балалар алаңын бөгеп тұр, шіріген тамақ көп; medium — үлкен үйінді, жаяу жүргіншіге кедергі; low — аз және қауіпсіз.

5) Түтін, от немесе күйген қоқыс көрінсе — бұл дұрыс шағым (is_trash = true), қайта түсіруді сұрама, тіпті қоқыс аз көрінсе де. Белсенді от/қою түтін болса — hazard: high.
   needs_retake = true, егер фотода қоқыс мүлде жоқ, тым қараңғы/бұлдыр, немесе бұл тазалыққа қатысы жоқ сурет (скриншот, адамның беті, бөлме іші). Сонда retake_reason — тұрғынға 1 сөйлем кеңес; is_trash = false.

6) confidence — 0..1, шын сенімділігің (күмәнді болса 0,6-дан төмен). summary — тұрғынға арналған 1 қысқа сөйлем (мысалы: «Аула шетінде 6–8 қоқыс пакеті үйілген, шамамен 0,4 м³»).
7) plate — көлік нөмірі анық оқылса ғана, әйтпесе null.`;

const VerifySchema = z.object({
  same_place: z.boolean(),
  clean: z.boolean(),
  confidence: z.number(),
  comment: z.string(),
});

const TreeSchema = z.object({
  health: z.enum(["good", "weak", "dry"]),
  confidence: z.number(),
  comment: z.string(),
});

// Модельдер тізбегі: біріншісі бос емес/лимиті біткен болса — келесісі (әр модельдің тегін лимиті бөлек)
const GEMINI_MODELS = (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || "gemini-3.8-flash,gemini-3.5-flash,gemini-3.6-flash,gemini-3.7-flash,gemini-3.5-flash-lite").split(",").map((x) => x.trim()).filter(Boolean);
function thinking(model: string) {
  return /^gemini-2\./.test(model) ? undefined : { thinkingLevel: ThinkingLevel.LOW };
}

// Бірнеше кілт: GEMINI_API_KEYS="k1,k2,k3" (немесе GEMINI_API_KEY). Әр Google жобасының тегін лимиті бөлек.
const GEMINI_KEYS = [...new Set((process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "").split(/[,\s]+/).filter(Boolean))];
function geminiEnabled() {
  return GEMINI_KEYS.length > 0;
}
function claudeEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
export function aiEnabled() {
  return geminiEnabled() || claudeEnabled();
}
export function aiProvider() {
  return claudeEnabled() ? "Claude" : geminiEnabled() ? "Gemini" : "демо";
}

/** Claude-тың ақшасы біткенде немесе кілт қате болса — біраз уақыт Gemini-мен ғана жұмыс істейміз */
let claudeBlockedUntil = 0;
function claudeReady() {
  return claudeEnabled() && Date.now() > claudeBlockedUntil;
}
function claudeFailed(e: unknown) {
  const err = e as { status?: number; message?: string };
  const msg = String(err.message ?? "");
  // 401/403 — кілт; 402/400 «credit balance» — ақша бітті; 429 — жиілік шегі
  if (err.status === 401 || err.status === 403 || /credit balance|billing/i.test(msg)) claudeBlockedUntil = Date.now() + 60 * 60_000;
  else if (err.status === 429 || err.status === 529) claudeBlockedUntil = Date.now() + 60_000;
  console.error(`[ai] Claude қате (${err.status ?? "?"}): ${msg.slice(0, 160)} → Gemini`);
}

const clients = new Map<string, GoogleGenAI>();
function gclient(k: string) {
  let c = clients.get(k);
  if (!c) clients.set(k, (c = new GoogleGenAI({ apiKey: k, httpOptions: { apiVersion: "v1beta" } })));
  return c;
}
function withTimeout<T>(p: Promise<T>, ms = 25_000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("ЖИ уақыты бітті")), ms))]);
}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
function geminiParts(content: Anthropic.Beta.Messages.BetaContentBlockParam[]): Part[] {
  return content.map((b) => {
    if (b.type === "image" && b.source.type === "base64") return { inlineData: { mimeType: b.source.media_type, data: b.source.data } };
    if (b.type === "text") return { text: b.text };
    throw new Error("Қолдау жоқ блок");
  });
}

/** Лимит таусылса (429), сол кілтке біраз уақыт сұрау жібермейміз; келесі кілтке ауысамыз */
const keyBlockedUntil = new Map<string, number>();
function nextPacificMidnight() {
  // Gemini күндік лимиті Тынық мұхит уақытымен түн ортасында жаңарады (≈ UTC 08:00, қарашада)
  const d = new Date();
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8, 5);
  return t > Date.now() ? t : t + 864e5;
}
function combos() {
  const now = Date.now();
  const out: { k: string; model: string }[] = [];
  for (const model of GEMINI_MODELS) for (const k of GEMINI_KEYS) if ((keyBlockedUntil.get(`${k}|${model}`) ?? 0) < now) out.push({ k, model });
  return out;
}
export function aiQuotaBlocked() {
  return geminiEnabled() && combos().length === 0;
}

/** Кілт × модель жұптарын кезекпен байқау: 429 → келесі жұп; 503 → бір рет қайталап, келесісіне */
async function withKeys<T>(fn: (c: GoogleGenAI, model: string) => Promise<T>): Promise<T> {
  const list = combos();
  if (!list.length) throw new Error("Gemini квотасы таусылған");
  let last: unknown;
  const deadline = Date.now() + 48_000; // Vercel функциясы 60 с-тан аспауы керек
  for (const { k, model } of list) {
    const id = `${k}|${model}`;
    for (let i = 0; i < 2 && Date.now() < deadline; i++) {
      try {
        return await fn(gclient(k), model);
      } catch (e) {
        last = e;
        const msg = String((e as Error).message);
        const tag = `…${k.slice(-4)} · ${model}`;
        if (/RESOURCE_EXHAUSTED|429/.test(msg)) {
          keyBlockedUntil.set(id, /PerDay|per day|daily/i.test(msg) ? nextPacificMidnight() : Date.now() + 2 * 60_000);
          console.error(`[ai] ${tag}: лимит таусылды, келесісіне`);
          break;
        }
        if (/API_KEY_INVALID|PERMISSION_DENIED|403|API key not valid|NOT_FOUND|404/.test(msg)) {
          keyBlockedUntil.set(id, Date.now() + 864e5);
          console.error(`[ai] ${tag}: қолжетімсіз, келесісіне`);
          break;
        }
        if (!/503|UNAVAILABLE|high demand|уақыты бітті/.test(msg)) throw e;
        // бос емес / баяу: уақытты жоғалтпай келесі модельге көшеміз
        console.error(`[ai] ${tag}: ${/уақыты бітті/.test(msg) ? "баяу (уақыт бітті)" : "сервер бос емес (503)"}`);
        keyBlockedUntil.set(id, Date.now() + 60_000); // 1 минут бұл жұпты айналып өтеміз
        break;
      }
    }
    if (Date.now() >= deadline) break;
  }
  throw last ?? new Error("Gemini квотасы таусылған");
}

async function geminiJson<T extends z.ZodType>(schema: T, content: Anthropic.Beta.Messages.BetaContentBlockParam[]) {
  return withKeys((c, m) => geminiJsonOnce(c, m, schema, content));
}

async function geminiJsonOnce<T extends z.ZodType>(gemini: GoogleGenAI, model: string, schema: T, content: Anthropic.Beta.Messages.BetaContentBlockParam[]) {
  const res = await withTimeout(
    gemini.models.generateContent({
      model,
      contents: [{ role: "user", parts: geminiParts(content) }],
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(schema),
        thinkingConfig: thinking(model),
      },
    }),
    14_000,
  );
  const text = res.text;
  if (!text) throw new Error("Gemini бос жауап қайтарды");
  return schema.parse(JSON.parse(text)) as z.infer<T>;
}

async function geminiText(prompt: string) {
  return withKeys((c, m) => geminiTextOnce(c, m, prompt));
}
async function geminiTextOnce(gemini: GoogleGenAI, model: string, prompt: string) {
  const res = await withTimeout(
    gemini.models.generateContent({ model, contents: prompt, config: { systemInstruction: SYSTEM, thinkingConfig: thinking(model) } }),
    14_000,
  );
  return (res.text ?? "").trim();
}

function imageBlock(dataUrl: string) {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("Сурет форматы қате");
  return {
    type: "image" as const,
    source: { type: "base64" as const, media_type: m[1] as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: m[2] },
  };
}

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic({ timeout: 40_000, maxRetries: 1 });
  return client;
}

export type Lang = "kk" | "ru";
/** Орыс тілі режимінде — барлық мәтін өрістері орысша */
const RU_NOTE = "ВАЖНО: все текстовые поля ответа (items, reason, summary, retake_reason, comment) пиши строго на русском языке, даже если выше сказано писать по-казахски.";
const langBlock = (lang: Lang) => (lang === "ru" ? [{ type: "text" as const, text: RU_NOTE }] : []);

const SYSTEM =
  "Сен Қызылорда қаласының тазалық қызметіне арналған TrashSTOP жүйесінің көру модулісің. " +
  "Фотоларды тек тазалық, қоқыс және жасыл екпелер тұрғысынан бағала. Барлық мәтінді қазақ тілінде, қысқа (1 сөйлем) жаз. " +
  "Адамдардың жүзін немесе жеке басын сипаттама.";

/** Алдымен Claude (сапасы жоғары, күндік шектеу жоқ), болмаса — Gemini кілттері */
async function parse<T extends z.ZodType>(schema: T, content: Anthropic.Beta.Messages.BetaContentBlockParam[]): Promise<z.infer<T>> {
  if (claudeReady()) {
    try {
      return await claudeJson(schema, content);
    } catch (e) {
      claudeFailed(e);
      if (!geminiEnabled()) throw e;
    }
  }
  return geminiJson(schema, content);
}

async function claudeJson<T extends z.ZodType>(schema: T, content: Anthropic.Beta.Messages.BetaContentBlockParam[]): Promise<z.infer<T>> {
  const res = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(schema) },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("ЖИ жауап бермеді");
  return res.parsed_output as z.infer<T>;
}

// ── Кілтсіз демо режим: интернет/кілт болмаса да демо құламайды ──
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i += 97) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

async function analyzeTrashRaw(photo: string, hint?: string, lang: Lang = "kk"): Promise<AiResult & { is_trash: boolean }> {
  if (aiEnabled()) {
    try {
      const out = await parse(TrashSchema, [
        imageBlock(photo),
        {
          type: "text",
          text:
            TRASH_GUIDE +
            (hint === "car" ? "\n\nТұрғын «көліктен тастады» режимін таңдады — көлік пен нөмірге ерекше назар аудар." : "") +
            (hint === "burning" ? "\n\nТұрғын «түтін / өртеу» режимін таңдады — от, түтін, күл бар-жоғына ерекше назар аудар; көрінсе category = burning." : ""),
        },
        ...langBlock(lang),
      ]);
      const m3 = Math.max(0, Math.round(out.volume_m3 * 100) / 100);
      // көлем санаты мен м³ сәйкес болуы үшін серверде түзетеміз
      const volume = m3 < 0.5 ? "small" : m3 <= 3 ? "medium" : "large";
      return {
        is_trash: out.is_trash,
        category: out.category,
        volume: m3 > 0 ? volume : out.volume,
        volumeM3: m3 || undefined,
        hazard: out.hazard,
        confidence: Math.max(0, Math.min(1, out.confidence)),
        summary: out.summary,
        reason: out.reason,
        items: out.items.slice(0, 8),
        plate: out.plate,
        needsRetake: out.needs_retake,
        retakeReason: out.retake_reason,
      };
    } catch (e) {
      console.error("[ai] analyzeTrash fallback:", (e as Error).message);
    }
  }
  // ЖИ қолжетімсіз: ештеңені ойдан шығармаймыз — тұрғын санатты өзі таңдайды
  return {
    is_trash: true,
    category: hint === "car" ? "car" : hint === "burning" ? "burning" : "household",
    volume: "medium",
    hazard: "medium",
    confidence: 0,
    summary: "",
    plate: null,
    demo: true,
  };
}

async function verifyCleanRaw(before: string | null, after: string, lang: Lang = "kk"): Promise<{ clean: boolean; same_place: boolean; comment: string; demo?: boolean }> {
  if (aiEnabled()) {
    try {
      const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];
      if (before) content.push({ type: "text", text: "«ДЕЙІН» фотосы:" }, imageBlock(before));
      content.push({ type: "text", text: "«КЕЙІН» фотосы:" }, imageBlock(after));
      content.push({
        type: "text",
        text: "Тазалықшы жұмысты бітірдім деп «кейін» фотосын жіберді. clean — кейінгі фотода қоқыс жоқ па? same_place — екі фото бір жерде түсірілген сияқты ма (дейін фото жоқ болса true)? comment — 1 сөйлем.",
      });
      return await parse(VerifySchema, [...content, ...langBlock(lang)]);
    } catch (e) {
      console.error("[ai] verifyClean fallback:", (e as Error).message);
    }
  }
  return { clean: true, same_place: true, comment: "Аумақ тазаланған, қоқыс көрінбейді", demo: true };
}

async function treeHealthRaw(photo: string, lang: Lang = "kk"): Promise<{ health: "good" | "weak" | "dry"; confidence: number; comment: string; demo?: boolean }> {
  if (aiEnabled()) {
    try {
      return await parse(TreeSchema, [
        imageBlock(photo),
        { type: "text", text: "Фотодағы ағаштың күйін бағала: good (сау), weak (әлсіз, жапырағы сарғайған/сирек), dry (қураған). comment — 1 сөйлем, не істеу керегін айт." },
        ...langBlock(lang),
      ]);
    } catch (e) {
      console.error("[ai] treeHealth fallback:", (e as Error).message);
    }
  }
  const h = hash(photo) % 3;
  return {
    health: (["good", "weak", "dry"] as const)[h],
    confidence: 0.84,
    comment: ["Ағаш сау, күтім жоспар бойынша", "Жапырақтары сарғайған — суаруды күшейту керек", "Ағаш қураған — ауыстыру керек"][h],
    demo: true,
  };
}

export async function weeklySummary(facts: string, lang: Lang = "kk"): Promise<string> {
  const ask = (lang === "ru" ? "Напиши по-русски в официальном деловом стиле. " : "") + `Мына көрсеткіштер бойынша әкімдікке арналған апталық есептің қорытындысын 4–5 сөйлеммен ресми ${lang === "ru" ? "орыс" : "қазақ"} тілінде жаз. Ұсыныстар қос. Тақырыпсыз, тек мәтін. Сызықша (тире) қолданба.\n\n${facts}`;
  if (claudeReady()) {
    try {
      const res = await getClient().beta.messages.create({
        model: MODEL,
        max_tokens: 2048,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: ask,
          },
        ],
      });
      const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
      if (text) return text;
    } catch (e) {
      claudeFailed(e);
    }
  }
  if (geminiEnabled()) {
    try {
      const t = await geminiText(ask);
      if (t) return t;
    } catch (e) {
      console.error("[ai] gemini summary fallback:", (e as Error).message);
    }
  }
  return "";
}

// ── Бір фотоны екі рет талдамау: нәтижелер кэші (квотаны үнемдейді) ──
import { createHash } from "node:crypto";
import { pool, ready } from "./db";
const cache = new Map<string, unknown>();
// Кэш нұсқасы: модель/нұсқаулық өзгергенде ескі жауаптар қолданылмауы үшін ауыстырамыз
const CACHE_VER = "claude-1";
function key(...parts: (string | null | undefined)[]) {
  const h = createHash("sha1");
  h.update(CACHE_VER);
  for (const p of parts) h.update(p ?? "-");
  return h.digest("hex");
}
async function cached<T extends { demo?: boolean }>(k: string, fn: () => Promise<T>): Promise<T> {
  if (cache.has(k)) return cache.get(k) as T;
  // Ортақ дерекқордағы кэш: бір фото қайта жіберілсе (мыс. демо дайындығы) — квота жұмсалмайды
  if (pool) {
    try {
      await ready();
      const r = await pool.query("SELECT data FROM ts_ai_cache WHERE key = $1", [k]);
      if (r.rows[0]) {
        cache.set(k, r.rows[0].data);
        return r.rows[0].data as T;
      }
    } catch {}
  }
  const v = await fn();
  if (!v.demo) {
    cache.set(k, v);
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
    if (pool) pool.query("INSERT INTO ts_ai_cache (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING", [k, JSON.stringify(v)]).catch(() => {});
  }
  return v;
}

export function analyzeTrash(photo: string, hint?: string, lang: Lang = "kk") {
  return cached(key("trash", lang, photo, hint), () => analyzeTrashRaw(photo, hint, lang));
}
export function verifyClean(before: string | null, after: string, lang: Lang = "kk") {
  return cached(key("verify", lang, before, after), () => verifyCleanRaw(before, after, lang));
}
export function treeHealth(photo: string, lang: Lang = "kk") {
  return cached(key("tree", lang, photo), () => treeHealthRaw(photo, lang));
}
