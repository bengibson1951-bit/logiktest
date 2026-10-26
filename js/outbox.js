// Persistent FIFO of pending uploads. Answers land here first so a network blip never loses one.

export function createOutbox({ storage, key = "logik.outbox", send }) {
  let queue = [];
  try { queue = JSON.parse(storage.getItem(key) ?? "[]") || []; } catch { queue = []; }
  let running = null;

  const persist = () => {
    try { storage.setItem(key, JSON.stringify(queue)); } catch { /* storage full */ }
  };

  async function drain() {
    let sent = 0;
    while (queue.length) {
      try {
        await send(queue[0]);
      } catch {
        break;
      }
      queue.shift();
      persist();
      sent += 1;
    }
    return sent;
  }

  return {
    enqueue(item) {
      queue.push(item);
      persist();
    },
    // A second flush while one runs waits for it, then drains whatever is left.
    async flush() {
      if (running) {
        await running;
      }
      running = drain();
      try { return await running; } finally { running = null; }
    },
    size: () => queue.length,
  };
}
