"use client";
// Орыс тілі: беттегі мәтін түйіндері мен атрибуттарды сөздік бойынша аударады.
// Жаңадан пайда болған мәтінді MutationObserver арқылы бақылайды. Қазақшаға қайтқанда бет қайта жүктеледі.
import { useEffect } from "react";
import { RU, RU_RULES } from "@/lib/i18n-ru";

const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE"]);
const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const KZ = /[ӘәҒғҚқҢңӨөҰұҮүҺһІі]|[А-Яа-я]/;

function tr(text: string): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t || !KZ.test(t)) return null;
  if (RU[t] !== undefined) return RU[t];
  for (const [re, rep] of RU_RULES) {
    if (!re.test(t)) continue;
    const r = typeof rep === "string" ? t.replace(re, rep) : t.replace(re, rep as (...a: string[]) => string);
    // ережеден кейін қазақша бөлік қалса (мыс. «ул. X, 12, Ақмешіт») — үтір бойынша аударамыз
    if (/[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/.test(r) && r.includes(", ")) return r.split(", ").map((p) => RU[p] ?? p.replace(/^(.+?)( \(.*\))$/, (_m, x: string, y: string) => (RU[x] ?? x) + y)).join(", ");
    return r;
  }
  // Басындағы/соңындағы «·» белгісі: «Қызылорда ·» → «Кызылорда ·»
  const edge = t.match(/^(·\s*)?(.*?)(\s*·)?$/);
  if (edge && (edge[1] || edge[3]) && edge[2]) {
    const core = tr(edge[2]);
    if (core !== null) return `${edge[1] ?? ""}${core}${edge[3] ?? ""}`;
  }
  // Құрама жолдар — бөліктер бойынша: «X · Y» және «көше, 12, Аудан»
  for (const sep of [" · ", ", "]) {
    if (!t.includes(sep)) continue;
    const parts = t.split(sep);
    const out = parts.map((p) => (KZ.test(p) ? (RU[p] ?? tr(p) ?? p) : p));
    if (out.some((p, i) => p !== parts[i])) return out.join(sep);
  }
  return null;
}

function translateText(n: Text, done: WeakMap<Node, string>) {
  const v = n.nodeValue ?? "";
  if (done.get(n) === v) return; // өзіміз аударған
  const r = tr(v);
  if (r === null) return;
  const lead = v.match(/^\s*/)?.[0] ?? "";
  const trail = v.match(/\s*$/)?.[0] ?? "";
  const nv = lead + r + trail;
  done.set(n, nv);
  if (nv !== v) n.nodeValue = nv;
}

function skipEl(el: Element | null) {
  for (let e = el; e; e = e.parentElement) {
    if (SKIP.has(e.tagName) || e.hasAttribute("data-no-translate")) return true;
  }
  return false;
}

function walk(root: Node, done: WeakMap<Node, string>) {
  if (root.nodeType === Node.TEXT_NODE) {
    if (!skipEl(root.parentElement)) translateText(root as Text, done);
    return;
  }
  if (!(root instanceof Element) || skipEl(root)) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (n instanceof Element && (SKIP.has(n.tagName) || n.hasAttribute("data-no-translate")) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const elAttrs = (el: Element) => {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (!v) continue;
      const r = tr(v);
      if (r !== null && r !== v) el.setAttribute(a, r);
    }
  };
  elAttrs(root);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) translateText(n as Text, done);
    else elAttrs(n as Element);
  }
  // textarea/input мазмұнын аудармаймыз, бірақ placeholder-ін аударамыз
  root.querySelectorAll("textarea[placeholder],input[placeholder]").forEach((el) => elAttrs(el));
}

export function Translator() {
  useEffect(() => {
    const done = new WeakMap<Node, string>();
    let obs: MutationObserver | null = null;
    let raf = 0;
    const pending = new Set<Node>();
    const flush = () => {
      raf = 0;
      for (const n of pending) walk(n, done);
      pending.clear();
      const t = tr(document.title.replace(/ · TrashSTOP$/, ""));
      if (t && !document.title.startsWith(t)) document.title = document.title.includes(" · TrashSTOP") ? `${t} · TrashSTOP` : t;
    };
    const queue = (n: Node) => {
      pending.add(n);
      if (!raf) raf = requestAnimationFrame(flush);
    };
    const start = () => {
      if (obs) return;
      document.documentElement.lang = "ru";
      queue(document.body);
      obs = new MutationObserver((ms) => {
        for (const m of ms) {
          if (m.type === "characterData") queue(m.target);
          else if (m.type === "attributes") queue(m.target);
          else m.addedNodes.forEach((n) => queue(n));
        }
      });
      obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    };
    const onLang = (e: Event) => {
      const l = (e as CustomEvent).detail;
      if (l === "ru") start();
      else if (obs) location.reload(); // қазақшаға қайту — түпнұсқа мәтінмен қайта жүктеу
    };
    if (document.documentElement.dataset.lang === "ru") start();
    window.addEventListener("ts-lang", onLang);
    return () => {
      window.removeEventListener("ts-lang", onLang);
      obs?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
