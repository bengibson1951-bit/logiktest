// Scoring mirrors the JobMatch report: Korrekt resonemang, Svarshastighet, Total andel korrekt.

import { SUBTYPES } from "./taxonomy.js";

export const TARGET_S = 22;

export function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const estimateLogik = (totalAndel) => Math.round(Math.min(160, Math.max(80, 83.5 + 65 * totalAndel)));

function group(answers, keyOf) {
  const out = {};
  for (const a of answers) {
    const k = keyOf(a);
    const g = (out[k] ??= { shown: 0, correct: 0, times: [] });
    g.shown += 1;
    if (a.isCorrect) g.correct += 1;
    if (!a.skipped) g.times.push(a.timeMs / 1000);
  }
  for (const g of Object.values(out)) {
    g.pct = g.correct / g.shown;
    g.medianS = median(g.times);
    delete g.times;
  }
  return out;
}

export function roundMetrics(answers, total, { mode }) {
  const answered = answers.filter((a) => !a.skipped).length;
  const correct = answers.filter((a) => a.isCorrect).length;
  const totalAndel = total ? correct / total : 0;
  return {
    answered,
    correct,
    total,
    korrekt: answered ? correct / answered : 0,
    hastighet: total ? answered / total : 0,
    totalAndel,
    estLogik: mode === "full" ? estimateLogik(totalAndel) : null,
    medianS: median(answers.filter((a) => !a.skipped).map((a) => a.timeMs / 1000)),
    byArea: group(answers, (a) => a.question.area),
    bySubtype: group(answers, (a) => a.question.subtype),
  };
}

// rows: lt_history().answers → {session_id, subtype, is_correct, skipped, time_ms, started_at}
export function subtypeStats(rows, { lastSessions = 3 } = {}) {
  const starts = new Map();
  for (const r of rows) starts.set(r.session_id, r.started_at ?? "");
  const keep = new Set(
    [...starts.entries()].sort((a, b) => (a[1] < b[1] ? 1 : -1)).slice(0, lastSessions).map(([id]) => id),
  );
  const acc = {};
  for (const r of rows) {
    if (!keep.has(r.session_id)) continue;
    const g = (acc[r.subtype] ??= { n: 0, right: 0, times: [] });
    g.n += 1;
    if (r.is_correct) g.right += 1;
    if (!r.skipped) g.times.push(r.time_ms / 1000);
  }
  const out = {};
  for (const [k, g] of Object.entries(acc)) out[k] = { n: g.n, accuracy: g.right / g.n, medianS: median(g.times) };
  return out;
}

export function flags(stats) {
  const out = {};
  for (const [k, s] of Object.entries(stats)) {
    if (s.n < 5) continue;
    const med = s.medianS ?? 0;
    if (s.accuracy < 0.6 && med < 15) out[k] = "fast_sloppy";
    else if (s.accuracy < 0.6) out[k] = "weak";
    else if (s.accuracy >= 0.75 && med > 30) out[k] = "slow_sure";
  }
  return out;
}

export const FLAG_LABELS = {
  slow_sure: "Långsam men säker",
  fast_sloppy: "Snabb men slarvig",
  weak: "Svag",
};

export function weights(stats, subtypes = Object.keys(SUBTYPES)) {
  const out = {};
  for (const k of subtypes) {
    const s = stats[k];
    if (!s) { out[k] = 1; continue; }
    const slow = Math.max(0, (s.medianS ?? TARGET_S) - TARGET_S) / TARGET_S;
    out[k] = Math.max(0.15, 1 - s.accuracy + slow);
  }
  return out;
}

export function targetSeconds(stat) {
  if (!stat || stat.n < 5 || stat.medianS == null) return TARGET_S;
  return Math.min(TARGET_S, Math.max(10, Math.round(stat.medianS * 0.9)));
}
