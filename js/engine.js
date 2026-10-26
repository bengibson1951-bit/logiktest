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
    subs = filter?.subtype ? [filter.subtype] : subtypesOf(filter?.area ?? AREAS[0]);
    subs = shuffle(rand, subs.filter(available));
    for (let i = 0; i < count && subs.length; i++) {
      const st = subs[i % subs.length];
      const q = take(st, levelFor(i, count));
      if (q) out.push(q);
    }
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
