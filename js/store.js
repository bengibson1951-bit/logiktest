// localStorage state. Shape:
// { pass: string|null, resume: round|null, last: {metrics, mode, endedAt}|null, recentIds: string[] }

export const KEY = "logik.v1";
const RECENT_CAP = 400;

const DEFAULTS = () => ({ pass: null, resume: null, last: null, recentIds: [] });

export function load(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(KEY) ?? "null");
    if (!parsed || typeof parsed !== "object") return DEFAULTS();
    const s = { ...DEFAULTS(), ...parsed };
    if (!Array.isArray(s.recentIds)) s.recentIds = [];
    return s;
  } catch {
    return DEFAULTS();
  }
}

export function save(state, storage = globalThis.localStorage) {
  try { storage.setItem(KEY, JSON.stringify(state)); } catch { /* full or blocked */ }
}

export const setResume = (state, round) => { state.resume = round; };
export const clearResume = (state) => { state.resume = null; };

export function addRecent(state, ids) {
  state.recentIds = [...state.recentIds.filter((i) => !ids.includes(i)), ...ids].slice(-RECENT_CAP);
}
