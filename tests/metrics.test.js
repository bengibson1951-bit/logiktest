import { test } from "node:test";
import assert from "node:assert/strict";
import { roundMetrics, estimateLogik, subtypeStats, flags, weights, targetSeconds } from "../js/metrics.js";
import { createOutbox } from "../js/outbox.js";

const ans = (area, subtype, { correct = true, skipped = false, timeMs = 20000 } = {}) => ({
  question: { area, subtype },
  isCorrect: skipped ? null : correct,
  skipped,
  timeMs,
});

test("roundMetrics core ratios", () => {
  const answers = [];
  for (let i = 0; i < 9; i++) answers.push(ans("matte", "talserie"));
  for (let i = 0; i < 3; i++) answers.push(ans("logik", "syllogism", { correct: false }));
  const m = roundMetrics(answers, 20, { mode: "quick" });
  assert.equal(m.answered, 12);
  assert.equal(m.correct, 9);
  assert.equal(m.korrekt, 0.75);
  assert.equal(m.hastighet, 0.6);
  assert.equal(m.totalAndel, 0.45);
  assert.equal(m.estLogik, null);
  assert.equal(m.byArea.matte.pct, 1);
  assert.equal(m.byArea.matte.medianS, 20);
  assert.equal(m.bySubtype.syllogism.correct, 0);
});

test("skips do not count as answered", () => {
  const m = roundMetrics([ans("matte", "talserie", { skipped: true }), ans("matte", "talserie")], 80, { mode: "full" });
  assert.equal(m.answered, 1);
  assert.equal(m.byArea.matte.shown, 2);
  assert.equal(typeof m.estLogik, "number");
});

test("estimateLogik anchors and clamp", () => {
  assert.equal(estimateLogik(0.3), 103);
  assert.equal(estimateLogik(0.5), 116);
  assert.equal(estimateLogik(1), 149);
  assert.equal(estimateLogik(0), 84);
  assert.ok(estimateLogik(-5) >= 80);
});

const row = (subtype, is_correct, time_ms, session_id = "s1", skipped = false) => ({
  subtype, is_correct, time_ms, skipped, session_id, started_at: "2026-10-26T10:00:00Z",
});

test("subtypeStats, flags and weights", () => {
  const rows = [];
  for (let i = 0; i < 5; i++) rows.push(row("talserie", true, 40000));        // slow_sure
  for (let i = 0; i < 5; i++) rows.push(row("udda_ord", i < 2, 10000));       // fast_sloppy
  for (let i = 0; i < 5; i++) rows.push(row("synonym", i < 2, 25000));        // weak
  for (let i = 0; i < 4; i++) rows.push(row("analogi", false, 50000));        // n=4 → no flag
  for (let i = 0; i < 5; i++) rows.push(row("motsats", true, 12000));         // good
  const st = subtypeStats(rows);
  assert.equal(st.talserie.n, 5);
  assert.equal(st.talserie.medianS, 40);
  assert.deepEqual(flags(st), { talserie: "slow_sure", udda_ord: "fast_sloppy", synonym: "weak" });
  const w = weights(st, ["talserie", "motsats", "matris"]);
  assert.equal(w.matris, 1);
  assert.equal(w.motsats, 0.15);
  assert.ok(Math.abs(w.talserie - 18 / 22) < 1e-9);
});

test("subtypeStats only uses the last 3 sessions; skips count wrong, not timed", () => {
  const rows = [
    { ...row("talserie", false, 99000, "old"), started_at: "2026-10-20T00:00:00Z" },
    { ...row("talserie", true, 10000, "a"), started_at: "2026-10-24T00:00:00Z" },
    { ...row("talserie", true, 20000, "b"), started_at: "2026-10-25T00:00:00Z" },
    { ...row("talserie", null, 30000, "c", true), started_at: "2026-10-26T00:00:00Z" },
  ];
  const st = subtypeStats(rows);
  assert.equal(st.talserie.n, 3);
  assert.ok(Math.abs(st.talserie.accuracy - 2 / 3) < 1e-9);
  assert.equal(st.talserie.medianS, 15);
});

test("targetSeconds", () => {
  assert.equal(targetSeconds(undefined), 22);
  assert.equal(targetSeconds({ n: 3, medianS: 40 }), 22);
  assert.equal(targetSeconds({ n: 9, medianS: 40 }), 22);
  assert.equal(targetSeconds({ n: 9, medianS: 15 }), 14);
  assert.equal(targetSeconds({ n: 9, medianS: 5 }), 10);
});

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

test("outbox keeps FIFO order and survives failures and reloads", async () => {
  const storage = memStorage();
  const sent = [];
  let fail = true;
  const send = async (item) => {
    if (item.n === 2 && fail) throw new Error("offline");
    sent.push(item.n);
  };
  const ob = createOutbox({ storage, send });
  ob.enqueue({ n: 1 }); ob.enqueue({ n: 2 }); ob.enqueue({ n: 3 });
  assert.equal(await ob.flush(), 1);
  assert.equal(ob.size(), 2);
  const ob2 = createOutbox({ storage, send });
  assert.equal(ob2.size(), 2);
  fail = false;
  assert.equal(await ob2.flush(), 2);
  assert.deepEqual(sent, [1, 2, 3]);
  assert.equal(ob2.size(), 0);
});

test("concurrent flushes don't double-send", async () => {
  const sent = [];
  const ob = createOutbox({ storage: memStorage(), send: async (i) => { await new Promise((r) => setTimeout(r, 5)); sent.push(i.n); } });
  ob.enqueue({ n: 1 }); ob.enqueue({ n: 2 });
  await Promise.all([ob.flush(), ob.flush()]);
  assert.deepEqual(sent, [1, 2]);
});

test("blockMetrics and overallEfficiency", async () => {
  const { blockMetrics, overallEfficiency } = await import("../js/metrics.js");
  const blocks = [{ key: "numeric", label: "N", start: 0, count: 2, refS: 30 }, { key: "complex", label: "C", start: 2, count: 2, refS: 60 }];
  const a = (position, isCorrect, timeMs, skipped = false) => ({ position, isCorrect: skipped ? null : isCorrect, skipped, timeMs });
  const bm = blockMetrics([a(0, true, 15000), a(1, true, 15000), a(2, true, 60000), a(3, null, 60000, true)], blocks);
  assert.equal(bm[0].efficiency, 1);              // 2 right in exactly the reference time
  assert.equal(bm[1].correct, 1);
  assert.equal(bm[1].answered, 1);
  assert.equal(bm[1].efficiency, 0.25);           // 1 right in twice the reference time
  assert.ok(Math.abs(overallEfficiency(bm) - (3 / 150) / (4 / 90)) < 1e-12);
});
