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
  } else if (difficulty >= 4) {
    const kind = pick(rand, ["second_geo", "mult_inc", "interleaved_geo", "square_shift"]);
    if (kind === "second_geo") {
      const d = randInt(rand, 1, 3), r = pick(rand, [2, 3]);
      let a = randInt(rand, 1, 15);
      if (a * (r - 1) === d) a += 1; // otherwise it collapses into a plain geometric series
      terms = [a];
      for (let i = 1; i < 7; i++) terms.push(terms[i - 1] + d * r ** (i - 1));
      rule = `skillnaderna mellan talen multipliceras med ${r} varje gång`;
    } else if (kind === "mult_inc") {
      const a = randInt(rand, 1, 3), m = randInt(rand, 1, 2);
      terms = [a];
      for (let i = 1; i < 6; i++) terms.push(terms[i - 1] * (m + i));
      rule = `talen multipliceras med ${m + 1}, ${m + 2}, ${m + 3} … i tur och ordning`;
    } else if (kind === "interleaved_geo") {
      const a = randInt(rand, 1, 4), b = randInt(rand, 3, 30), db = pick(rand, [3, 4, 5, -2, -3]);
      terms = Array.from({ length: 8 }, (_, i) => (i % 2 === 0 ? a * 2 ** (i / 2) : b + ((i - 1) / 2) * db));
      rule = `två serier varvas: varannat tal dubbleras, varannat ${db > 0 ? "ökar" : "minskar"} med ${Math.abs(db)}`;
    } else {
      const s = randInt(rand, 2, 6), c = pick(rand, [-3, -2, -1, 1, 2, 3]);
      terms = Array.from({ length: 6 }, (_, i) => (s + i) ** 2 + c * (s + i));
      rule = `talen är n² ${c < 0 ? "−" : "+"} ${Math.abs(c)}n för n = ${s}, ${s + 1}, ${s + 2} …`;
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
  } else if (difficulty >= 4) {
    const kind = pick(rand, ["pct", "twobytwo", "frac"]);
    if (kind === "pct") {
      const p = pick(rand, [15, 35, 45, 12.5, 7.5, 65]);
      const base = { 15: 20, 35: 20, 45: 20, 12.5: 8, 7.5: 40, 65: 20 }[p];
      const n = base * randInt(rand, 3, 24);
      expr = `${String(p).replace(".", ",")} % av ${n}`; ans = (p * n) / 100; extras = [n * p / 10].filter(Number.isInteger);
    } else if (kind === "twobytwo") {
      const a = randInt(rand, 13, 39), b = randInt(rand, 13, 39);
      expr = `${a} × ${b}`; ans = a * b; extras = [a * b + 10, a * b - b, a * b + a];
    } else {
      const [p1, q1] = pick(rand, [[2, 3], [3, 4], [3, 5], [2, 5], [5, 6]]);
      const [p2, q2] = pick(rand, [[1, 2], [3, 4], [2, 3], [4, 5]]);
      const n = q1 * q2 * randInt(rand, 2, 9);
      expr = `${p1}/${q1} av ${p2}/${q2} av ${n}`; ans = (n * p1 * p2) / (q1 * q2); extras = [(n * p1) / q1].filter(Number.isInteger);
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
  if (difficulty >= 4) return talsambandQuadratic(seed, rand);
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

// Level 4: the rule is not linear (x², x² ± c, x(x + 1)).
function talsambandQuadratic(seed, rand) {
  const kind = pick(rand, ["sq_plus", "x_x1", "two_sq"]);
  const c = randInt(rand, 1, 9) * pick(rand, [1, -1]);
  const f = kind === "sq_plus" ? (x) => x * x + c : kind === "x_x1" ? (x) => x * (x + 1) : (x) => 2 * x * x - c;
  const rule = kind === "sq_plus" ? `x² ${c < 0 ? "−" : "+"} ${Math.abs(c)}` : kind === "x_x1" ? "x × (x + 1)" : `2x² ${c < 0 ? "+" : "−"} ${Math.abs(c)}`;
  const x0 = randInt(rand, 2, 5);
  const xs = [x0, x0 + 1, x0 + 3];
  const xq = x0 + randInt(rand, 4, 6);
  const ans = f(xq);
  // Typical mistake: continuing linearly from the last two points.
  const lin = f(xs[2]) + ((f(xs[2]) - f(xs[1])) / (xs[2] - xs[1])) * (xq - xs[2]);
  return makeQuestion({
    name: "talsamband", seed, difficulty: 4, rand,
    prompt: `${xs.map((x) => `${fmt(x)} → ${fmt(f(x))}`).join(",  ")}.\nVad blir ${fmt(xq)} → ?`,
    answer: fmt(ans), distractors: nearby(rand, ans, [lin, f(xq - 1), f(xq) + xq]).map(fmt),
    explanation: `Regeln är ${rule}, så ${fmt(xq)} → ${fmt(ans)}.`,
  });
}
