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
    if (varying.includes(a)) mode = a === varying[0] ? "latin" : pick(rand, ["latin", "row", "col"]);
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
  const frame = (i) => ({ t: "ring", pos: (p0 + i * k) % 8, arrow: (a0 + i * da) % 360 });
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
    { t: "ring", pos: (answer.pos + 4) % 8, arrow: (answer.arrow + 90) % 360 },
  ];
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
  const n = difficulty === 1 ? 4 : difficulty === 2 ? 5 : 6;
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
  const n = difficulty === 1 ? 4 : difficulty === 2 ? 5 : 6;
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
