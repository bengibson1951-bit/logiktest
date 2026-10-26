import { SUBTYPES } from "../taxonomy.js";
import { shuffle } from "../rng.js";

// Shuffles options with the seeded rand and returns a full Question.
export function makeQuestion({ name, seed, difficulty, rand, prompt, answer, distractors, explanation, figure = null }) {
  const opts = shuffle(rand, [answer, ...distractors]);
  const correct = opts.indexOf(answer);
  return {
    id: `gen:${name}:${difficulty}:${seed}`,
    area: SUBTYPES[name].area,
    subtype: name,
    difficulty,
    source: "generated",
    generator: name,
    seed,
    prompt,
    options: opts,
    correct,
    explanation,
    figure,
  };
}

export const fmt = (n) => (n < 0 ? `−${Math.abs(n)}` : String(n));
