import { test } from "node:test";
import assert from "node:assert/strict";
import { mulberry32, randInt, shuffle } from "../js/rng.js";
import { createStopwatch } from "../js/timer.js";
import { newRound, recordAnswer, recordSkip, timeUp } from "../js/round.js";

test("rng is deterministic and shuffle is a permutation", () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 10; i++) assert.equal(a(), b());
  const r = mulberry32(1);
  const s = shuffle(r, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...s].sort(), [1, 2, 3, 4, 5, 6]);
  for (let i = 0; i < 200; i++) {
    const n = randInt(r, 3, 5);
    assert.ok(n >= 3 && n <= 5 && Number.isInteger(n));
  }
});

test("stopwatch excludes hidden time", () => {
  let t = 0;
  const sw = createStopwatch({ now: () => t });
  sw.start();
  t = 5000; sw.hide();
  t = 65000; sw.show();
  t = 70000;
  assert.deepEqual(sw.read(), { timeMs: 10000, pausedMs: 60000 });
});

test("stopwatch read while hidden counts up to the hide", () => {
  let t = 0;
  const sw = createStopwatch({ now: () => t });
  sw.start();
  t = 3000; sw.hide();
  t = 9000;
  assert.deepEqual(sw.read(), { timeMs: 3000, pausedMs: 6000 });
});

const q = (i) => ({ id: `q${i}`, correct: 1 });

test("round records answers and skips, ends after last", () => {
  const round = newRound({ sessionId: "s", mode: "quick", questions: [q(0), q(1)], timeLimitS: 60, startedAt: "x" });
  const a = recordAnswer(round, 1, { timeMs: 4000, pausedMs: 0 }, "t1");
  assert.equal(a.isCorrect, true);
  assert.equal(a.position, 0);
  assert.equal(round.remainingMs, 56000);
  const s = recordSkip(round, { timeMs: 1000, pausedMs: 5 }, "t2");
  assert.deepEqual([s.skipped, s.chosen, s.isCorrect], [true, null, null]);
  assert.equal(round.done, true);
});

test("timeUp ends without recording current question", () => {
  const qs = Array.from({ length: 20 }, (_, i) => q(i));
  const round = newRound({ sessionId: "s", mode: "quick", questions: qs, timeLimitS: 450, startedAt: "x" });
  for (let i = 0; i < 7; i++) recordAnswer(round, 0, { timeMs: 1000, pausedMs: 0 }, "t");
  timeUp(round);
  assert.equal(round.answers.length, 7);
  assert.equal(round.done, true);
  assert.equal(round.remainingMs, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(round)), round);
});

test("untimed round keeps remainingMs null", () => {
  const round = newRound({ sessionId: "s", mode: "drill", questions: [q(0)], timeLimitS: null, startedAt: "x" });
  recordAnswer(round, 0, { timeMs: 1000, pausedMs: 0 }, "t");
  assert.equal(round.remainingMs, null);
  assert.equal(round.answers[0].isCorrect, false);
});
