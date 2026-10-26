// Figure puzzles for "Logisk uppfattning". Cells are plain JSON rendered by svg.js:
//   {t:'glyphs', shape, count, fill}   {t:'poly', cells}   {t:'ring', pos, arrow}

import { mulberry32, randInt, pick, shuffle } from "../rng.js";
import { rotations, mirror, randomPolyomino } from "./poly.js";
import { makeQuestion } from "./common.js";

export const SHAPES = ["circle", "square", "triangle", "diamond", "hexagon"];
export const DOMAINS = { shape: SHAPES, count: [1, 2, 3], fill: ["none", "solid", "striped"] };
const ATTRS = ["shape", "count", "fill"];

const cellKey = (c) => JSON.stringify(c);

function attrValue(mode, vals, r, c, shift) {
  if (mode === "const") return vals[0];
  if (mode === "row") return vals[r];
  if (mode === "col") return vals[c];
  return vals[(c + shift * r) % 3]; // latin
}

export function matris(seed, difficulty) {
  const rand = mulberry32(seed * 7919 + 11);
  const varying = shuffle(rand, ATTRS).slice(0, difficulty);
  const spec = {};
  for (const a of ATTRS) {
    const vals = shuffle(rand, DOMAINS[a]).slice(0, 3);
    let mode = "const";
    // Level 4 avoids the easy row-constant rule.
    if (varying.includes(a)) mode = a === varying[0] ? "latin" : pick(rand, difficulty >= 4 ? ["latin", "col"] : ["latin", "row", "col"]);
    spec[a] = { mode, vals, shift: randInt(rand, 1, 2) };
  }
  const cellAt = (r, c) => {
    const cell = { t: "glyphs" };
    for (const a of ATTRS) cell[a] = attrValue(spec[a].mode, spec[a].vals, r, c, spec[a].shift);
    return cell;
  };
  const cells = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push(r === 2 && c === 2 ? null : cellAt(r, c));
  const answer = cellAt(2, 2);

  const near = [], far = [];
  for (const a of ATTRS) {
    for (const v of DOMAINS[a]) {
      if (v === answer[a]) continue;
      // Level 4: every distractor uses only values that appear in the grid, so none is obviously wrong.
      if (difficulty >= 4 && !spec[a].vals.includes(v)) continue;
      (varying.includes(a) ? near : far).push({ ...answer, [a]: v });
    }
  }
  const pool = [...shuffle(rand, near).slice(0, far.length ? 3 : 4), ...shuffle(rand, far)];
  const distractors = pool.slice(0, 4);

  return makeQuestion({
    name: "matris", seed, difficulty, rand,
    prompt: "Vilken figur saknas i matrisen?",
    answer, distractors,
    explanation: "Varje rad (och kolumn) följer samma mönster för form, antal och fyllning – rutan nere till höger fullbordar mönstret.",
    figure: { kind: "matrix", cells },
  });
}

export function figurserie(seed, difficulty) {
  const rand = mulberry32(seed * 104729 + 3);
  const p0 = randInt(rand, 0, 7);
  const a0 = randInt(rand, 0, 7) * 45;
  let k, da;
  if (difficulty === 1) {
    if (rand() < 0.5) { k = randInt(rand, 1, 2); da = 0; } else { k = 0; da = pick(rand, [90, 270]); }
  } else if (difficulty === 2) {
    k = pick(rand, [1, 2]); da = pick(rand, [90, 270]);
  } else {
    k = pick(rand, [3, 7, 5]); da = pick(rand, [45, 135, 315]);
  }
  // Level 4 adds a hollow second marker moving its own way.
  const k2 = difficulty >= 4 ? pick(rand, [6, 2, 3]) : 0;
  const q0 = (p0 + randInt(rand, 2, 6)) % 8;
  const frame = (i) => {
    const f = { t: "ring", pos: (p0 + i * k) % 8, arrow: (a0 + i * da) % 360 };
    if (difficulty >= 4) f.pos2 = (q0 + i * k2) % 8;
    return f;
  };
  const items = [0, 1, 2, 3].map(frame);
  const answer = frame(4);
  const last = items[3];
  const cands = [
    { ...answer, pos: (answer.pos + 1) % 8 },
    { ...answer, pos: (answer.pos + 7) % 8 },
    { ...answer, pos: last.pos },
    { ...answer, arrow: (answer.arrow + 45) % 360 },
    { ...answer, arrow: (answer.arrow + 315) % 360 },
    { ...answer, arrow: (answer.arrow + 180) % 360 },
    { ...answer, arrow: last.arrow },
    { ...answer, pos: (answer.pos + 4) % 8, arrow: (answer.arrow + 90) % 360 },
  ];
  if (difficulty >= 4) {
    cands.push(
      { ...answer, pos2: (answer.pos2 + 1) % 8 },
      { ...answer, pos2: (answer.pos2 + 7) % 8 },
      { ...answer, pos2: last.pos2 },
      { ...answer, pos: answer.pos2, pos2: answer.pos },
    );
  }
  const seen = new Set([cellKey(answer)]);
  const distractors = [];
  for (const c of shuffle(rand, cands)) {
    const kk = cellKey(c);
    if (seen.has(kk)) continue;
    seen.add(kk);
    distractors.push(c);
    if (distractors.length === 4) break;
  }
  const parts = [];
  if (k) parts.push(`pricken flyttar ${k > 4 ? 8 - k : k} steg ${k > 4 ? "moturs" : "medurs"} varje gång`);
  else parts.push("pricken står still");
  if (da) parts.push(`pilen vrids ${da > 180 ? 360 - da : da}° ${da > 180 ? "moturs" : "medurs"} varje gång`);
  else parts.push("pilen står still");
  if (k2) parts.push(`den ihåliga ringen flyttar ${k2 > 4 ? 8 - k2 : k2} steg ${k2 > 4 ? "moturs" : "medurs"}`);
  return makeQuestion({
    name: "figurserie", seed, difficulty, rand,
    prompt: "Vilken figur kommer härnäst i serien?",
    answer, distractors,
    explanation: `Mönster: ${parts.join(" och ")}.`,
    figure: { kind: "series", items },
  });
}

export function rotation(seed, difficulty) {
  const rand = mulberry32(seed * 15485863 + 5);
  const n = [4, 5, 6, 7][difficulty - 1];
  const shape = randomPolyomino(rand, n);
  const answer = { t: "poly", cells: rotations(shape)[randInt(rand, 1, 3)] };
  const distractors = shuffle(rand, rotations(mirror(shape))).slice(0, 3).map((cells) => ({ t: "poly", cells }));
  return makeQuestion({
    name: "rotation", seed, difficulty, rand,
    prompt: "Vilket alternativ är samma figur som den ovan, bara vriden (inte spegelvänd)?",
    answer, distractors,
    explanation: "De andra alternativen är spegelvända – de går inte att få fram bara genom att vrida figuren.",
    figure: { kind: "single", cell: { t: "poly", cells: shape } },
  });
}

export function udda_figur(seed, difficulty) {
  const rand = mulberry32(seed * 32452843 + 9);
  const n = [4, 5, 6, 7][difficulty - 1];
  const shape = randomPolyomino(rand, n);
  const answer = { t: "poly", cells: pick(rand, rotations(mirror(shape))) };
  const distractors = rotations(shape).map((cells) => ({ t: "poly", cells }));
  return makeQuestion({
    name: "udda_figur", seed, difficulty, rand,
    prompt: "Vilken figur passar inte ihop med de andra?",
    answer, distractors,
    explanation: "Fyra av figurerna är samma form i olika vridning. Den udda är spegelvänd.",
  });
}

// A : B = C : ?  — B is A under one rotation/mirror; apply the same to C.
// With a chiral shape that has four distinct rotations, the transform from A to B is unique.
const TRANSFORMS = [
  { key: "r90", label: "vrids 90° medurs", fn: (c) => rotations(c)[1] },
  { key: "r180", label: "vrids ett halvt varv", fn: (c) => rotations(c)[2] },
  { key: "r270", label: "vrids 90° moturs", fn: (c) => rotations(c)[3] },
  { key: "m", label: "spegelvänds", fn: (c) => mirror(c) },
  { key: "m90", label: "spegelvänds och vrids 90° medurs", fn: (c) => rotations(mirror(c))[1] },
  { key: "m180", label: "spegelvänds och vrids ett halvt varv", fn: (c) => rotations(mirror(c))[2] },
  { key: "m270", label: "spegelvänds och vrids 90° moturs", fn: (c) => rotations(mirror(c))[3] },
];

export function figuranalogi(seed, difficulty) {
  const rand = mulberry32(seed * 49979687 + 13);
  const n = [4, 5, 5, 6][difficulty - 1];
  const pool = difficulty === 1 ? TRANSFORMS.slice(0, 3) : difficulty === 2 ? TRANSFORMS.slice(0, 4) : TRANSFORMS.slice(3);
  const t = pick(rand, pool);
  const a = randomPolyomino(rand, n);
  let c = randomPolyomino(rand, difficulty >= 4 ? 7 : n);
  while (JSON.stringify(c) === JSON.stringify(a)) c = randomPolyomino(rand, n);
  const answer = { t: "poly", cells: t.fn(c) };
  // Wrong options: C under the other symmetries (all distinct from the answer).
  const others = shuffle(rand, [{ key: "id", fn: (x) => x }, ...TRANSFORMS].filter((o) => o.key !== t.key));
  const distractors = others.slice(0, 4).map((o) => ({ t: "poly", cells: o.fn(c) }));
  return makeQuestion({
    name: "figuranalogi", seed, difficulty, rand,
    prompt: "Första figuren förhåller sig till den andra som den tredje förhåller sig till …?",
    answer, distractors,
    explanation: `Figuren ${t.label}. Gör samma sak med den tredje figuren.`,
    figure: { kind: "analogy", items: [{ t: "poly", cells: a }, { t: "poly", cells: t.fn(a) }, { t: "poly", cells: c }] },
  });
}

// A start arrow plus a list of turns; where does it point afterwards?
export function riktning(seed, difficulty) {
  const rand = mulberry32(seed * 86028121 + 19);
  const start = randInt(rand, 0, 7) * 45;
  const steps = [[90, 180], [90, 180], [45, 90, 135, 180], [45, 90, 135, 180]][difficulty - 1];
  const count = [2, 3, 4, 5][difficulty - 1];
  const turns = Array.from({ length: count }, () => pick(rand, steps) * (rand() < 0.5 ? 1 : -1));
  const end = (((start + turns.reduce((s, x) => s + x, 0)) % 360) + 360) % 360;
  const answer = { t: "ring", pos: null, arrow: end };
  const step = difficulty >= 3 ? 45 : 90;
  const cands = [end + step, end - step, end + 180, end + 2 * step, start, end + 3 * step]
    .map((d) => ((d % 360) + 360) % 360)
    .filter((d, i, arr) => d !== end && arr.indexOf(d) === i);
  // Plausible mistakes first, then any other direction to make up five options.
  const rest = shuffle(rand, [0, 45, 90, 135, 180, 225, 270, 315].filter((d) => d !== end && !cands.includes(d)));
  const distractors = [...shuffle(rand, cands), ...rest].slice(0, 4).map((d) => ({ t: "ring", pos: null, arrow: d }));
  return makeQuestion({
    name: "riktning", seed, difficulty, rand,
    prompt: "Pilen vrids i tur och ordning enligt symbolerna (↻ medurs, ↺ moturs). Åt vilket håll pekar den till slut?",
    answer, distractors,
    explanation: `Summera vridningarna: ${turns.map((x) => `${x > 0 ? "+" : "−"}${Math.abs(x)}°`).join(" ")} = ${turns.reduce((s, x) => s + x, 0)}°.`,
    figure: { kind: "turns", start, turns },
  });
}
