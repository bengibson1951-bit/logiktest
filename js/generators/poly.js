// Polyomino helpers. A shape is an array of [row, col] cells; normalized = shifted to origin and sorted.

export function normalize(cells) {
  const minR = Math.min(...cells.map((c) => c[0]));
  const minC = Math.min(...cells.map((c) => c[1]));
  return cells
    .map(([r, c]) => [r - minR, c - minC])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

export const key = (cells) => JSON.stringify(normalize(cells));
export const rotate90 = (cells) => normalize(cells.map(([r, c]) => [c, -r]));
export const mirror = (cells) => normalize(cells.map(([r, c]) => [r, -c]));

export function rotations(cells) {
  const out = [normalize(cells)];
  for (let i = 1; i < 4; i++) out.push(rotate90(out[i - 1]));
  return out;
}

export const sameUnderRotation = (a, b) => rotations(a).some((r) => key(r) === key(b));
export const isChiral = (cells) => !sameUnderRotation(cells, mirror(cells));
export const hasFourRotations = (cells) => new Set(rotations(cells).map(key)).size === 4;

// Grows a random connected shape; retries until it is chiral with four distinct rotations,
// so both the shape and its mirror image give four visually different orientations.
export function randomPolyomino(rand, n) {
  for (;;) {
    const cells = [[0, 0]];
    const has = (r, c) => cells.some((x) => x[0] === r && x[1] === c);
    while (cells.length < n) {
      const [r, c] = cells[Math.floor(rand() * cells.length)];
      const [dr, dc] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rand() * 4)];
      if (!has(r + dr, c + dc)) cells.push([r + dr, c + dc]);
    }
    const shape = normalize(cells);
    const h = Math.max(...shape.map((x) => x[0])) + 1;
    const w = Math.max(...shape.map((x) => x[1])) + 1;
    if (h > 4 || w > 4) continue; // keep shapes compact enough to read at a glance
    if (isChiral(shape) && hasFourRotations(shape)) return shape;
  }
}
