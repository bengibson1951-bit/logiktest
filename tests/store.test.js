import { test } from "node:test";
import assert from "node:assert/strict";
import { load, save, setResume, addRecent, KEY } from "../js/store.js";
import { newRound, recordAnswer } from "../js/round.js";

function mem() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

test("resume round survives save/load", () => {
  const st = mem();
  const s = load(st);
  const round = newRound({ sessionId: "s", mode: "quick", questions: [{ id: "a", correct: 0 }, { id: "b", correct: 1 }], timeLimitS: 450, startedAt: "t" });
  recordAnswer(round, 0, { timeMs: 3000, pausedMs: 0 }, "t");
  setResume(s, round);
  save(s, st);
  const back = load(st);
  assert.deepEqual(back.resume, round);
  assert.equal(back.resume.position, 1);
  assert.equal(back.resume.remainingMs, 447000);
});

test("corrupt json loads defaults", () => {
  const st = mem();
  st.setItem(KEY, "{nope");
  assert.deepEqual(load(st), { pass: null, resume: null, last: null, recentIds: [] });
});

test("recentIds capped at 400, oldest dropped", () => {
  const s = load(mem());
  addRecent(s, Array.from({ length: 390 }, (_, i) => `a${i}`));
  addRecent(s, Array.from({ length: 20 }, (_, i) => `b${i}`));
  assert.equal(s.recentIds.length, 400);
  assert.equal(s.recentIds[0], "a10");
  assert.equal(s.recentIds.at(-1), "b19");
});
