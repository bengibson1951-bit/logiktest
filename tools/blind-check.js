// Usage: node tools/blind-check.js bank/<area>.json solutions/<area>.json
// solutions file: { "<id>": <chosen index> }. Lists every id where the blind solver disagrees with the key.
import { readFileSync } from "node:fs";

const [bankPath, solPath] = process.argv.slice(2);
const bank = JSON.parse(readFileSync(bankPath, "utf8"));
const sol = JSON.parse(readFileSync(solPath, "utf8"));
let bad = 0;
for (const q of bank) {
  const s = sol[q.id];
  if (s === undefined) { console.log(`MISSING ${q.id}`); bad++; continue; }
  if (s !== q.correct) {
    console.log(`DISAGREE ${q.id}: key=${q.correct} "${q.options[q.correct]}" solver=${s} "${q.options[s]}"`);
    bad++;
  }
}
console.log(`${bank.length - bad}/${bank.length} agree`);
process.exit(bad ? 1 : 0);
