import { test } from "node:test";
import assert from "node:assert/strict";
import { generate, GENERATORS } from "../js/generators/index.js";
import { sameUnderRotation, rotations, mirror, key } from "../js/generators/poly.js";
import { SUBTYPES } from "../js/taxonomy.js";
import { renderFigure, renderCell } from "../js/svg.js";

const SEEDS = 500;
const k = (x) => JSON.stringify(x);

test("every generator: distinct options, right count, deterministic", () => {
  for (const name of GENERATORS) {
    for (const d of [1, 2, 3, 4]) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const q = generate(name, seed, d);
        assert.equal(q.options.length, SUBTYPES[name].optionCount, `${name} d${d} s${seed} count`);
        assert.equal(new Set(q.options.map(k)).size, q.options.length, `${name} d${d} s${seed} distinct`);
        assert.ok(q.correct >= 0 && q.correct < q.options.length);
        assert.equal(q.id, `gen:${name}:${d}:${seed}`);
        assert.equal(q.area, SUBTYPES[name].area);
        if (seed <= 20) assert.deepEqual(generate(name, seed, d), q);
      }
    }
  }
});

test("rotation: exactly one option is a rotation of the target", () => {
  for (const d of [1, 2, 3, 4]) for (let s = 1; s <= SEEDS; s++) {
    const q = generate("rotation", s, d);
    const hits = q.options.filter((o) => sameUnderRotation(o.cells, q.figure.cell.cells));
    assert.equal(hits.length, 1);
    assert.equal(sameUnderRotation(q.options[q.correct].cells, q.figure.cell.cells), true);
  }
});

test("udda_figur: exactly one option differs from the other four", () => {
  for (const d of [1, 2, 3, 4]) for (let s = 1; s <= SEEDS; s++) {
    const q = generate("udda_figur", s, d);
    const odd = q.options.filter((o, i) => q.options.every((p, j) => i === j || !sameUnderRotation(o.cells, p.cells)));
    assert.equal(odd.length, 1);
    assert.equal(odd[0], q.options[q.correct]);
  }
});

// Independent rule check: for each attribute, row 2 / column 2 must match the pattern
// (all same vs all different, same value set) of rows/columns 0 and 1.
function fitsMatrix(cells, opt) {
  const g = [...cells.slice(0, 8), opt];
  const at = (r, c) => g[r * 3 + c];
  for (const a of ["shape", "count", "fill"]) {
    for (const line of [(i, j) => at(i, j), (i, j) => at(j, i)]) {
      const vals = (i) => [0, 1, 2].map((j) => line(i, j)[a]);
      const pat = (v) => (new Set(v).size === 1 ? "same" : new Set(v).size === 3 ? "diff" : "mixed");
      const p0 = pat(vals(0)), p1 = pat(vals(1)), p2 = pat(vals(2));
      if (p0 !== p1 || p2 !== p0) return false;
      if (p0 === "diff" && k([...vals(2)].sort()) !== k([...vals(0)].sort())) return false;
    }
  }
  return true;
}

test("matris: answer fits the rule, no distractor does", () => {
  for (const d of [1, 2, 3, 4]) for (let s = 1; s <= SEEDS; s++) {
    const q = generate("matris", s, d);
    q.options.forEach((o, i) => assert.equal(fitsMatrix(q.figure.cells, o), i === q.correct, `d${d} s${s} opt${i}`));
  }
});

test("figurserie: exactly the predicted next frame is correct", () => {
  for (const d of [1, 2, 3, 4]) for (let s = 1; s <= SEEDS; s++) {
    const q = generate("figurserie", s, d);
    const it = q.figure.items;
    const kp = (it[1].pos - it[0].pos + 8) % 8, ka = (it[1].arrow - it[0].arrow + 360) % 360;
    for (let i = 2; i < 4; i++) {
      assert.equal((it[i].pos - it[i - 1].pos + 8) % 8, kp);
      assert.equal((it[i].arrow - it[i - 1].arrow + 360) % 360, ka);
    }
    const pred = { t: "ring", pos: (it[3].pos + kp) % 8, arrow: (it[3].arrow + ka) % 360 };
    if (it[0].pos2 != null) {
      const k2 = (it[1].pos2 - it[0].pos2 + 8) % 8;
      for (let i = 2; i < 4; i++) assert.equal((it[i].pos2 - it[i - 1].pos2 + 8) % 8, k2);
      pred.pos2 = (it[3].pos2 + k2) % 8;
    }
    const hits = q.options.map((o, i) => (k(o) === k(pred) ? i : -1)).filter((i) => i >= 0);
    assert.deepEqual(hits, [q.correct]);
  }
});

test("number generators: correct option is the computed answer", () => {
  for (let s = 1; s <= 200; s++) {
    const q = generate("talsamband", s, 2);
    const nums = [...q.prompt.matchAll(/(−?\d+) → (−?\d+)/g)].map((m) => m.slice(1).map((x) => Number(x.replace("−", "-"))));
    const [[x1, y1], [x2, y2]] = nums;
    const a = (y2 - y1) / (x2 - x1), b = y1 - a * x1;
    const xq = Number(q.prompt.match(/Vad blir (−?\d+)/)[1].replace("−", "-"));
    assert.equal(q.options[q.correct], String(a * xq + b).replace("-", "−"));
  }
  for (let s = 1; s <= 200; s++) for (const d of [1, 2, 3, 4]) {
    const q = generate("huvudrakning", s, d);
    const expr = q.prompt.replace("Räkna i huvudet: ", "").replace(" = ?", "")
      .replace(/(\d+),(\d+) % av /, "$1.$2/100*").replace(" % av ", "/100*").replaceAll(" av ", "*")
      .replaceAll("×", "*").replaceAll("÷", "/").replaceAll("−", "-");
    const val = Math.round(Function(`return (${expr})`)() * 1e6) / 1e6;
    assert.equal(q.options[q.correct], String(val).replace("-", "−"));
  }
});

test("talsamband level 4: answer matches the quadratic through the three points", () => {
  for (let s = 1; s <= 300; s++) {
    const q = generate("talsamband", s, 4);
    const num = (x) => Number(x.replace("−", "-"));
    const pts = [...q.prompt.matchAll(/(−?\d+) → (−?\d+)/g)].map((m) => [num(m[1]), num(m[2])]);
    const xq = num(q.prompt.match(/Vad blir (−?\d+)/)[1]);
    const lag = pts.reduce((sum, [xi, yi], i) => sum + yi * pts.reduce((p, [xj], j) => (j === i ? p : (p * (xq - xj)) / (xi - xj)), 1), 0);
    assert.equal(num(q.options[q.correct]), Math.round(lag));
  }
});

test("figuranalogi: exactly one option is C under the A→B transform", () => {
  const sym = (c) => [...rotations(c), ...rotations(mirror(c))].map(key);
  for (const d of [1, 2, 3, 4]) for (let s = 1; s <= SEEDS; s++) {
    const q = generate("figuranalogi", s, d);
    const [A, B, C] = q.figure.items.map((i) => i.cells);
    const idx = sym(A).indexOf(key(B));
    assert.ok(idx >= 0);
    assert.equal(sym(A).filter((k) => k === key(B)).length, 1, "A→B transform must be unique");
    const want = sym(C)[idx];
    const hits = q.options.map((o, i) => (key(o.cells) === want ? i : -1)).filter((i) => i >= 0);
    assert.deepEqual(hits, [q.correct]);
  }
});

test("riktning: answer is start plus the sum of turns", () => {
  for (const d of [1, 2, 3, 4]) for (let s = 1; s <= SEEDS; s++) {
    const q = generate("riktning", s, d);
    const end = (((q.figure.start + q.figure.turns.reduce((a, b) => a + b, 0)) % 360) + 360) % 360;
    const hits = q.options.map((o, i) => (o.arrow === end ? i : -1)).filter((i) => i >= 0);
    assert.deepEqual(hits, [q.correct]);
  }
});

test("svg renders every figure spec", () => {
  for (const name of ["matris", "figurserie", "rotation", "udda_figur", "figuranalogi", "riktning"]) {
    for (let s = 1; s <= 50; s++) {
      const q = generate(name, s, 1 + (s % 3));
      if (q.figure) assert.ok(renderFigure(q.figure).startsWith("<svg"));
      for (const o of q.options) assert.ok(renderCell(o).startsWith("<svg"));
    }
  }
});
