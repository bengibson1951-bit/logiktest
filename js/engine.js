// Builds the question list for a round.

import { AREAS, SUBTYPES, subtypesOf } from "./taxonomy.js";
import { mulberry32, randInt, shuffle } from "./rng.js";
import { generate } from "./generators/index.js";

export const MODES = {
  full: { count: 80, timeLimitS: 1800, label: "Fullt test" },
  quick: { count: 20, timeLimitS: 450, label: "Snabbrunda" },
  weak: { count: 20, timeLimitS: null, label: "Träna svagheter" },
  drill: { count: 15, timeLimitS: null, label: "Ämnesdrill" },
  challenge: { count: 20, timeLimitS: 600, label: "Utmaning" },
  logiq: { count: 60, timeLimitS: null, label: "LogiQ-simulering" },
};

// Utmaning: only the hardest level, weighted toward the language-independent areas
// that the adaptive JobMatch LogiQ escalates in.
const CHALLENGE_QUOTA = { uppfattning: 6, matte: 6, komplex: 4, logik: 4 };

export function buildRound({ mode, bank, seed, subtypeWeights = null, filter = null, recentIds = new Set() }) {
  const rand = mulberry32(seed);
  const used = new Set();
  const { count } = MODES[mode];

  const bankBy = {};
  for (const q of bank) (bankBy[q.subtype] ??= []).push(q);
  const available = (st) => SUBTYPES[st].source === "generated" || (bankBy[st] ?? []).some((q) => !used.has(q.id));

  function take(st, difficulty) {
    if (SUBTYPES[st].source === "generated") {
      for (;;) {
        const q = generate(st, randInt(rand, 1, 2 ** 30), difficulty);
        if (!used.has(q.id)) { used.add(q.id); return q; }
      }
    }
    const free = (bankBy[st] ?? []).filter((q) => !used.has(q.id));
    if (!free.length) return null;
    const fresh = free.filter((q) => !recentIds.has(q.id));
    const pool = fresh.length ? fresh : free;
    // Nearest available difficulty, so a missing level degrades gracefully.
    const gap = Math.min(...pool.map((q) => Math.abs(q.difficulty - difficulty)));
    const list = pool.filter((q) => Math.abs(q.difficulty - difficulty) === gap);
    const q = list[Math.floor(rand() * list.length)];
    used.add(q.id);
    return q;
  }

  // Falls back to another subtype in the same area, then to any area, if a bank subtype runs dry.
  function takeWithFallback(st, difficulty) {
    const area = SUBTYPES[st].area;
    const tries = [st, ...shuffle(rand, subtypesOf(area).filter((s) => s !== st)), ...shuffle(rand, Object.keys(SUBTYPES))];
    for (const s of tries) {
      const q = take(s, difficulty);
      if (q) return q;
    }
    return null;
  }

  const levelFor = (i, n, levels = 3) => 1 + Math.min(levels - 1, Math.floor((i * levels) / n));
  const out = [];

  if (mode === "full" || mode === "quick") {
    // The full test ends with a hard quarter (level 4), like a test that gets harder towards the end.
    const levels = mode === "full" ? 4 : 3;
    const perArea = count / AREAS.length;
    for (const area of AREAS) {
      const subs = shuffle(rand, subtypesOf(area).filter(available));
      for (let i = 0; i < perArea; i++) {
        const q = takeWithFallback(subs[i % subs.length], levelFor(i, perArea, levels));
        if (q) out.push(q);
      }
    }
    // Difficulty rises gently; shuffled within each level.
    return [1, 2, 3, 4].flatMap((d) => shuffle(rand, out.filter((q) => q.difficulty === d)));
  }

  if (mode === "challenge") {
    const hasHard = (st) => SUBTYPES[st].source === "generated" || (bankBy[st] ?? []).some((q) => q.difficulty === 4);
    for (const [area, n] of Object.entries(CHALLENGE_QUOTA)) {
      let subs = subtypesOf(area).filter(hasHard);
      if (!subs.length) subs = subtypesOf(area).filter(available);
      subs = shuffle(rand, subs);
      for (let i = 0; i < n; i++) {
        const q = takeWithFallback(subs[i % subs.length], 4);
        if (q) out.push(q);
      }
    }
    return shuffle(rand, out);
  }

  let subs;
  if (mode === "drill") {
    subs = filter?.subtypes ?? (filter?.subtype ? [filter.subtype] : subtypesOf(filter?.area ?? AREAS[0]));
    subs = shuffle(rand, subs.filter(available));
    const n = filter?.count ?? count;
    const [lo, hi] = filter?.levels ?? [1, 3];
    for (let i = 0; i < n && subs.length; i++) {
      const st = subs[i % subs.length];
      const level = lo + Math.min(hi - lo, Math.floor((i * (hi - lo + 1)) / n));
      // Only fall back within the requested subtypes, never to another area.
      let q = null;
      for (const s of [st, ...subs.filter((x) => x !== st)]) if ((q = take(s, level))) break;
      if (q) out.push(q);
    }
    // Easier first within a block.
    if (filter?.levels) return [1, 2, 3, 4].flatMap((d) => shuffle(rand, out.filter((q) => q.difficulty === d)));
  } else {
    const w = subtypeWeights ?? {};
    for (let i = 0; i < count; i++) {
      const cands = Object.keys(SUBTYPES).filter(available);
      const total = cands.reduce((s, k) => s + (w[k] ?? 1), 0);
      let r = rand() * total, st = cands[0];
      for (const k of cands) { r -= w[k] ?? 1; if (r <= 0) { st = k; break; } }
      const q = take(st, randInt(rand, 1, 3));
      if (q) out.push(q);
    }
  }
  return shuffle(rand, out);
}

// ---------- LogiQ simulation ----------
// Block reference times come from JobMatch's public LogiQ example reports (20 items per block).
const FIGURAL = ["matris", "figurserie", "figuranalogi", "udda_figur", "rotation", "riktning"];
const BLOCKS = {
  numeric: { label: "Numerisk förståelse", subtypes: ["huvudrakning", "talserie", "talsamband"], levels: [1, 3] },
  general: { label: "Generell logik", subtypes: FIGURAL, levels: [1, 3] },
  advanced: { label: "Avancerad logik", subtypes: FIGURAL, levels: [2, 4] },
  complex: { label: "Komplex problemlösning", subtypes: ["matris", "figurserie", "placering", "rangordning", "flerstegs"], levels: [3, 4] },
};

export const LOGIQ_VERSIONS = {
  qts: {
    label: "Kvalificerade teoretiska tjänster",
    hint: "Troligast för ombudsman, rådgivare, utredare",
    blocks: [["numeric", 330], ["advanced", 600], ["complex", 555]],
  },
  lead: {
    label: "Ledarskap",
    hint: "Troligast för chefsroller",
    blocks: [["numeric", 345], ["general", 375], ["complex", 585]],
  },
};

export function buildLogiq({ version, bank, seed, recentIds = new Set() }) {
  const v = LOGIQ_VERSIONS[version];
  const questions = [];
  const blocks = [];
  const used = new Set();
  let s = seed;
  for (const [key, refS] of v.blocks) {
    const b = BLOCKS[key];
    const start = questions.length;
    // Reuse the drill builder per subtype group so bank/generated handling stays in one place.
    const pool = buildRound({ mode: "drill", bank: bank.filter((q) => !used.has(q.id)), seed: s++, filter: { subtypes: b.subtypes, levels: b.levels, count: 20 }, recentIds });
    pool.forEach((q) => used.add(q.id));
    questions.push(...pool);
    blocks.push({ key, label: b.label, start, count: pool.length, refS });
  }
  return { questions, blocks };
}
