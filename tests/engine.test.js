import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRound } from "../js/engine.js";
import { validateQuestion } from "../js/bank.js";
import { SUBTYPES, AREAS, SYLLOGISM_OPTIONS } from "../js/taxonomy.js";

function fixtureBank(per = 8) {
  const bank = [];
  for (const [st, s] of Object.entries(SUBTYPES)) {
    if (s.source !== "bank") continue;
    for (let i = 0; i < per; i++) {
      bank.push({
        id: `${s.area}-${st}-${i}`, area: s.area, subtype: st, difficulty: 1 + (i % 3), source: "bank",
        prompt: "p", options: st === "syllogism" ? SYLLOGISM_OPTIONS : Array.from({ length: s.optionCount }, (_, j) => `o${j}`),
        correct: 0, explanation: "e",
      });
    }
  }
  return bank;
}

test("validateQuestion", () => {
  const ok = fixtureBank(1).find((q) => q.subtype === "synonym");
  assert.deepEqual(validateQuestion(ok), []);
  const syl = { ...fixtureBank(1).find((q) => q.subtype === "syllogism"), options: ["Sant", "Falskt", "Möjligt"] };
  assert.ok(validateQuestion(syl).length > 0);
  assert.ok(validateQuestion({ ...ok, options: ["a", "a", "b", "c", "d"] }).some((e) => e.includes("duplicate")));
  assert.ok(validateQuestion({ ...ok, correct: 9 }).length > 0);
});

test("full round: 80, 16 per area, no duplicates, rising difficulty", () => {
  const qs = buildRound({ mode: "full", bank: fixtureBank(), seed: 1 });
  assert.equal(qs.length, 80);
  for (const a of AREAS) assert.equal(qs.filter((q) => q.area === a).length, 16, a);
  assert.equal(new Set(qs.map((q) => q.id)).size, 80);
  for (let i = 1; i < qs.length; i++) assert.ok(qs[i].difficulty >= qs[i - 1].difficulty);
});

test("quick round: 20 with 4 per area", () => {
  const qs = buildRound({ mode: "quick", bank: fixtureBank(), seed: 2 });
  assert.equal(qs.length, 20);
  for (const a of AREAS) assert.equal(qs.filter((q) => q.area === a).length, 4);
});

test("drill restricted to subtype", () => {
  const qs = buildRound({ mode: "drill", bank: fixtureBank(), seed: 3, filter: { subtype: "talserie" } });
  assert.equal(qs.length, 15);
  assert.ok(qs.every((q) => q.subtype === "talserie"));
});

test("drill by area with a small bank does not duplicate", () => {
  const qs = buildRound({ mode: "drill", bank: fixtureBank(2), seed: 3, filter: { area: "sprak" } });
  assert.equal(new Set(qs.map((q) => q.id)).size, qs.length);
  assert.ok(qs.every((q) => q.area === "sprak"));
});

test("weak mode follows weights", () => {
  const w = Object.fromEntries(Object.keys(SUBTYPES).map((k) => [k, 0.15]));
  w.syllogism = 10;
  const qs = buildRound({ mode: "weak", bank: fixtureBank(), seed: 1, subtypeWeights: w });
  assert.equal(qs.length, 20);
  assert.ok(qs.filter((q) => q.subtype === "syllogism").length >= 8);
});

test("recent ids avoided while fresh ones remain", () => {
  const bank = fixtureBank(40);
  const syn = bank.filter((q) => q.subtype === "synonym");
  const fresh = syn.slice(0, 2).map((q) => q.id);
  const recent = new Set(syn.slice(2).map((q) => q.id));
  for (let seed = 1; seed <= 20; seed++) {
    const qs = buildRound({ mode: "quick", bank, seed, recentIds: recent }).filter((q) => q.subtype === "synonym");
    assert.ok(qs.every((q) => fresh.includes(q.id)), `seed ${seed}`);
  }
});

test("challenge: 20 hard questions, no language area, generated ones at level 4", () => {
  const bank = fixtureBank();
  bank.push({ ...bank.find((q) => q.subtype === "placering"), id: "komplex-placering-hard", difficulty: 4 });
  const qs = buildRound({ mode: "challenge", bank, seed: 9 });
  assert.equal(qs.length, 20);
  assert.ok(qs.every((q) => q.area !== "sprak"));
  assert.equal(qs.filter((q) => q.area === "uppfattning").length, 6);
  assert.ok(qs.filter((q) => q.source === "generated").every((q) => q.difficulty === 4));
  assert.ok(qs.some((q) => q.id === "komplex-placering-hard"));
});

test("full test ends with level-4 questions", () => {
  const qs = buildRound({ mode: "full", bank: fixtureBank(), seed: 4 });
  assert.ok(qs.slice(-10).every((q) => q.difficulty >= 3));
  assert.ok(qs.some((q) => q.difficulty === 4));
});
