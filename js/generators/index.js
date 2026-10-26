import { matris, figurserie, rotation, udda_figur } from "./figures.js";
import { talserie, huvudrakning, talsamband } from "./numbers.js";

const FNS = { matris, figurserie, rotation, udda_figur, talserie, huvudrakning, talsamband };

export const GENERATORS = Object.keys(FNS);

export function generate(name, seed, difficulty) {
  const fn = FNS[name];
  if (!fn) throw new Error(`unknown generator ${name}`);
  return fn(seed, difficulty);
}
