// Claude's analysis CLI: per-subtype stats + session trend, via the passphrase RPC.
// Usage: LT_PASS=<passphrase> node tools/stats.js [lastSessions=3]
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../js/config.js";
import { createDb } from "../js/db.js";
import { subtypeStats, flags, FLAG_LABELS } from "../js/metrics.js";
import { SUBTYPES } from "../js/taxonomy.js";

const pass = process.env.LT_PASS;
if (!pass) { console.error("Set LT_PASS"); process.exit(1); }
const last = Number(process.argv[2] ?? 3);
const h = await createDb({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY }).history(pass, 50);

console.log("Sessions (newest first):");
for (const s of h.sessions) {
  const m = s.metrics ?? {};
  const p = (x) => (x == null ? "  –" : `${Math.round(x * 100)}%`.padStart(4));
  console.log(`  ${s.started_at.slice(0, 16)}  ${s.mode.padEnd(5)}  ${String(s.answered ?? "-").padStart(2)}/${s.total}  hast ${p(m.hastighet)}  korr ${p(m.korrekt)}  median ${m.medianS?.toFixed(1) ?? "-"} s`);
}
const st = subtypeStats(h.answers, { lastSessions: last });
const f = flags(st);
console.log(`\nSubtypes over last ${last} sessions (slowest first):`);
for (const [k, s] of Object.entries(st).sort((a, b) => (b[1].medianS ?? 0) - (a[1].medianS ?? 0))) {
  console.log(`  ${(SUBTYPES[k]?.label ?? k).padEnd(26)} n=${String(s.n).padStart(3)}  rätt ${String(Math.round(s.accuracy * 100)).padStart(3)}%  median ${s.medianS?.toFixed(1) ?? "-"} s  ${f[k] ? FLAG_LABELS[f[k]] : ""}`);
}
