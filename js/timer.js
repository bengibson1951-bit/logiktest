// Per-question stopwatch. Time while the tab is hidden is excluded and reported as pausedMs.

export function createStopwatch({ now = () => performance.now() } = {}) {
  let startedAt = 0;
  let pausedMs = 0;
  let hiddenAt = null;

  return {
    start() {
      startedAt = now();
      pausedMs = 0;
      hiddenAt = null;
    },
    hide() {
      if (hiddenAt === null) hiddenAt = now();
    },
    show() {
      if (hiddenAt !== null) {
        pausedMs += now() - hiddenAt;
        hiddenAt = null;
      }
    },
    read() {
      const t = now();
      const paused = pausedMs + (hiddenAt !== null ? t - hiddenAt : 0);
      return { timeMs: Math.round(t - startedAt - paused), pausedMs: Math.round(paused) };
    },
  };
}
