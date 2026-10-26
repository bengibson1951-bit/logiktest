// npm run validate — checks every bank file listed in bank/index.json.
import { readFileSync } from "node:fs";
import { validateQuestion } from "../js/bank.js";

const names = JSON.parse(readFileSync("bank/index.json", "utf8"));
const ids = new Set();
const counts = {};
let errors = 0;
for (const n of names) {
  for (const q of JSON.parse(readFileSync(`bank/${n}.json`, "utf8"))) {
    const errs = validateQuestion(q);
    if (ids.has(q.id)) errs.push("duplicate id");
    ids.add(q.id);
    for (const e of errs) { console.log(`${q.id ?? "?"}: ${e}`); errors++; }
    const k = `${q.area}/${q.subtype}`;
    counts[k] ??= [0, 0, 0];
    counts[k][q.difficulty - 1]++;
  }
}
for (const [k, c] of Object.entries(counts).sort()) console.log(`${k.padEnd(26)} ${c.reduce((a, b) => a + b)}  (d1 ${c[0]} / d2 ${c[1]} / d3 ${c[2]})`);
console.log(`${ids.size} questions, ${errors} errors`);
process.exit(errors ? 1 : 0);
