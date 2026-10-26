// Builds the question list for a round.

import { AREAS, SUBTYPES, subtypesOf } from "./taxonomy.js";
import { mulberry32, randInt, shuffle } from "./rng.js";
import { generate } from "./generators/index.js";

export const MODES = {
  full: { count: 80, timeLimitS: 1800, label: "Fullt test" },
  quick: { count: 20, timeLimitS: 450, label: "Snabbrunda" },
  weak: { count: 20, timeLimitS: null, label: "Träna svagheter" },
  drill: { count: 15, timeLimitS: null, label: "Ämnesdrill" },
};

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
    const atLevel = pool.filter((q) => q.difficulty === difficulty);
    const list = atLevel.length ? atLevel : pool;
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

  const levelFor = (i, n) => 1 + Math.min(2, Math.floor((i * 3) / n));
  const out = [];

  if (mode === "full" || mode === "quick") {
    const perArea = count / AREAS.length;
    for (const area of AREAS) {
      const subs = shuffle(rand, subtypesOf(area).filter(available));
      for (let i = 0; i < perArea; i++) {
        const q = takeWithFallback(subs[i % subs.length], levelFor(i, perArea));
        if (q) out.push(q);
      }
    }
    // Difficulty rises gently: easy third first, then medium, then hard; shuffled within each.
    return [1, 2, 3].flatMap((d) => shuffle(rand, out.filter((q) => q.difficulty === d)));
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
