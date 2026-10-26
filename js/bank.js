// Hand-written question bank: JSON files listed in bank/index.json.

import { SUBTYPES, SYLLOGISM_OPTIONS } from "./taxonomy.js";

const REQUIRED = ["id", "area", "subtype", "difficulty", "source", "prompt", "options", "correct", "explanation"];

export function validateQuestion(q) {
  const errs = [];
  for (const f of REQUIRED) if (q[f] === undefined || q[f] === null || q[f] === "") errs.push(`missing ${f}`);
  if (errs.length) return errs;
  const st = SUBTYPES[q.subtype];
  if (!st) return [`unknown subtype ${q.subtype}`];
  if (st.area !== q.area) errs.push(`area ${q.area} != ${st.area}`);
  if (![1, 2, 3, 4].includes(q.difficulty)) errs.push("difficulty not 1-4");
  if (q.source !== "bank") errs.push("source must be bank");
  if (!Array.isArray(q.options)) return [...errs, "options not array"];
  if (q.options.length !== st.optionCount) errs.push(`expected ${st.optionCount} options, got ${q.options.length}`);
  if (new Set(q.options.map((o) => String(o).trim().toLowerCase())).size !== q.options.length) errs.push("duplicate options");
  if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) errs.push("correct out of range");
  if (q.subtype === "syllogism" && JSON.stringify(q.options) !== JSON.stringify(SYLLOGISM_OPTIONS)) {
    errs.push("syllogism options must be Sant/Falskt/Möjligt/Osannolikt");
  }
  return errs;
}

export async function loadBank(fetchImpl = (...a) => fetch(...a), base = "bank/") {
  const names = await (await fetchImpl(`${base}index.json`)).json();
  const files = await Promise.all(names.map(async (n) => (await fetchImpl(`${base}${n}.json`)).json()));
  return files.flat();
}
