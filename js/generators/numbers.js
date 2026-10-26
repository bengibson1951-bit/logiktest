// Number puzzles for "Matematisk förmåga": series, mental arithmetic, x → f(x).

import { mulberry32, randInt, pick, shuffle } from "../rng.js";
import { makeQuestion, fmt } from "./common.js";

// Plausible wrong answers near the right one, as distinct strings.
function nearby(rand, ans, extras = []) {
  const step = Math.max(1, Math.round(Math.abs(ans) / 20));
  const cands = [...extras, ans + step, ans - step, ans + 2 * step, ans - 2 * step, ans + 10, ans - 10, ans + 1, ans - 1, ans + 3 * step];
  const seen = new Set([ans]);
  const out = [];
  for (const c of [...extras.filter((e) => Number.isInteger(e)), ...shuffle(rand, cands)]) {
    if (!Number.isInteger(c) || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
    if (out.length === 4) break;
  }
  return out;
}

export function talserie(seed, difficulty) {
  const rand = mulberry32(seed * 2654435 + 17);
  let terms, rule;
  if (difficulty === 1) {
    if (rand() < 0.6) {
      const a = randInt(rand, 1, 30), d = pick(rand, [2, 3, 4, 5, 6, 7, 8, 9, 11, 12, -3, -4, -6, -7]);
      const start = d < 0 ? a + 60 : a;
      terms = Array.from({ length: 6 }, (_, i) => start + i * d);
      rule = `talen ${d > 0 ? "ökar" : "minskar"} med ${Math.abs(d)} varje gång`;
    } else {
      const a = randInt(rand, 1, 5), r = pick(rand, [2, 3]);
      terms = Array.from({ length: 6 }, (_, i) => a * r ** i);
      rule = `varje tal multipliceras med ${r}`;
    }
  } else if (difficulty === 2) {
    const kind = pick(rand, ["growing", "alternating", "squares"]);
    if (kind === "growing") {
      const a = randInt(rand, 1, 20), d = randInt(rand, 1, 4), e = randInt(rand, 1, 3);
      terms = [a];
      for (let i = 1; i < 7; i++) terms.push(terms[i - 1] + d + (i - 1) * e);
      rule = `skillnaden mellan talen ökar med ${e} varje gång`;
    } else if (kind === "alternating") {
      const a = randInt(rand, 1, 10), b = randInt(rand, 20, 40), da = randInt(rand, 2, 5), db = -randInt(rand, 1, 4);
      terms = Array.from({ length: 7 }, (_, i) => (i % 2 === 0 ? a + (i / 2) * da : b + ((i - 1) / 2) * db));
      rule = `två serier varvas: varannat tal ökar med ${da}, varannat minskar med ${-db}`;
    } else {
      const s = randInt(rand, 1, 6);
      terms = Array.from({ length: 6 }, (_, i) => (s + i) ** 2);
      rule = "talen är kvadrater på heltal i följd";
    }
  } else {
    const kind = pick(rand, ["fib", "affine", "alt_ops"]);
    if (kind === "fib") {
      terms = [randInt(rand, 1, 5), randInt(rand, 2, 7)];
      for (let i = 2; i < 7; i++) terms.push(terms[i - 1] + terms[i - 2]);
      rule = "varje tal är summan av de två föregående";
    } else if (kind === "affine") {
      const m = pick(rand, [2, 3]), b = pick(rand, [-1, 1, 2, -2, 3]);
      terms = [randInt(rand, 1, 4)];
      for (let i = 1; i < 6; i++) terms.push(terms[i - 1] * m + b);
      rule = `varje tal gånger ${m} ${b < 0 ? "minus" : "plus"} ${Math.abs(b)}`;
    } else {
      const add = randInt(rand, 2, 6);
      terms = [randInt(rand, 1, 6)];
      for (let i = 1; i < 7; i++) terms.push(i % 2 ? terms[i - 1] + add : terms[i - 1] * 2);
      rule = `växelvis plus ${add} och gånger 2`;
    }
  }
  const answer = terms.pop();
  const shown = terms;
  const lastDiff = shown[shown.length - 1] - shown[shown.length - 2];
  const distractors = nearby(rand, answer, [shown[shown.length - 1] + lastDiff]).map(fmt);
  return makeQuestion({
    name: "talserie", seed, difficulty, rand,
    prompt: `Vilket tal kommer härnäst?\n${shown.map(fmt).join(", ")}, ?`,
    answer: fmt(answer), distractors,
    explanation: `Regeln: ${rule}. Nästa tal blir ${fmt(answer)}.`,
  });
}

export function huvudrakning(seed, difficulty) {
  const rand = mulberry32(seed * 48611 + 23);
  let expr, ans, extras = [];
  if (difficulty === 1) {
    const a = randInt(rand, 12, 99), b = randInt(rand, 11, 89);
    if (rand() < 0.5) { expr = `${a} + ${b}`; ans = a + b; } else { expr = `${a + b} − ${b}`; ans = a; }
  } else if (difficulty === 2) {
    if (rand() < 0.5) {
      const a = randInt(rand, 3, 9), b = randInt(rand, 12, 49);
      expr = `${a} × ${b}`; ans = a * b; extras = [a * b + a, a * b - b];
    } else {
      const d = randInt(rand, 3, 12), q = randInt(rand, 6, 25);
      expr = `${d * q} ÷ ${d}`; ans = q;
    }
  } else {
    const kind = pick(rand, ["neg", "mixed", "big"]);
    if (kind === "neg") {
      const a = randInt(rand, 2, 9) * 100, b = randInt(rand, 1, 9) * 50;
      expr = `${a} − (−${b})`; ans = a + b; extras = [a - b];
    } else if (kind === "mixed") {
      const a = randInt(rand, 4, 19), b = randInt(rand, 3, 9), d = randInt(rand, 2, 9), c = d * randInt(rand, 2, 9);
      expr = `${a} × ${b} − ${c} ÷ ${d}`; ans = a * b - c / d; extras = [(a * b - c) / d].filter(Number.isInteger);
    } else {
      const a = randInt(rand, 12, 25), b = randInt(rand, 12, 25);
      expr = `${a} × ${b}`; ans = a * b; extras = [a * b + 10, a * b - a];
    }
  }
  return makeQuestion({
    name: "huvudrakning", seed, difficulty, rand,
    prompt: `Räkna i huvudet: ${expr} = ?`,
    answer: fmt(ans), distractors: nearby(rand, ans, extras).map(fmt),
    explanation: `${expr} = ${fmt(ans)}${expr.includes("÷") && expr.includes("−") && difficulty === 3 ? " (multiplikation och division görs före subtraktion)" : ""}.`,
  });
}

export function talsamband(seed, difficulty) {
  const rand = mulberry32(seed * 7368787 + 31);
  const a = difficulty === 1 ? randInt(rand, 2, 5) : randInt(rand, 2, 9);
  const b = difficulty === 1 ? 0 : difficulty === 2 ? randInt(rand, 1, 9) : pick(rand, [-7, -5, -3, -1, 1, 3, 5, 7, 11]);
  const f = (x) => a * x + b;
  const x0 = randInt(rand, 1, 6), dx = randInt(rand, 1, 3);
  const xs = [x0, x0 + dx, x0 + 2 * dx];
  const xq = x0 + randInt(rand, 3, 6) * dx;
  const ans = f(xq);
  const rule = b === 0 ? `x × ${a}` : `x × ${a} ${b < 0 ? "−" : "+"} ${Math.abs(b)}`;
  return makeQuestion({
    name: "talsamband", seed, difficulty, rand,
    prompt: `${xs.map((x) => `${fmt(x)} → ${fmt(f(x))}`).join(",  ")}.\nVad blir ${fmt(xq)} → ?`,
    answer: fmt(ans), distractors: nearby(rand, ans, [a * xq, ans + a]).map(fmt),
    explanation: `Regeln är ${rule}, så ${fmt(xq)} → ${fmt(ans)}.`,
  });
}
