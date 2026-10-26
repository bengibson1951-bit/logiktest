// Renders figure specs to inline SVG strings. Colours come from currentColor so CSS themes them.

const HATCH = `<defs><pattern id="hatch" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" stroke-width="2"/></pattern></defs>`;

function glyph(shape, cx, cy, r, fill) {
  const f = fill === "solid" ? "currentColor" : fill === "striped" ? "url(#hatch)" : "none";
  const a = `fill="${f}" stroke="currentColor" stroke-width="2"`;
  const pts = (n, rot) =>
    Array.from({ length: n }, (_, i) => {
      const t = rot + (i * 2 * Math.PI) / n;
      return `${(cx + r * Math.cos(t)).toFixed(1)},${(cy + r * Math.sin(t)).toFixed(1)}`;
    }).join(" ");
  switch (shape) {
    case "circle": return `<circle cx="${cx}" cy="${cy}" r="${r * 0.9}" ${a}/>`;
    case "square": return `<rect x="${cx - r * 0.8}" y="${cy - r * 0.8}" width="${r * 1.6}" height="${r * 1.6}" ${a}/>`;
    case "triangle": return `<polygon points="${pts(3, -Math.PI / 2)}" ${a}/>`;
    case "diamond": return `<polygon points="${pts(4, -Math.PI / 2)}" ${a}/>`;
    case "hexagon": return `<polygon points="${pts(6, 0)}" ${a}/>`;
    default: return "";
  }
}

const GLYPH_LAYOUT = {
  1: [[0.5, 0.5]],
  2: [[0.3, 0.5], [0.7, 0.5]],
  3: [[0.5, 0.3], [0.3, 0.7], [0.7, 0.7]],
};

function cellBody(cell, s) {
  if (!cell) return `<text x="${s / 2}" y="${s / 2}" text-anchor="middle" dominant-baseline="central" font-size="${s * 0.4}" fill="currentColor" opacity="0.6">?</text>`;
  if (cell.t === "glyphs") {
    const r = cell.count === 1 ? s * 0.22 : s * 0.15;
    return GLYPH_LAYOUT[cell.count].map(([x, y]) => glyph(cell.shape, x * s, y * s, r, cell.fill)).join("");
  }
  if (cell.t === "poly") {
    const h = Math.max(...cell.cells.map((c) => c[0])) + 1;
    const w = Math.max(...cell.cells.map((c) => c[1])) + 1;
    const u = (s * 0.8) / Math.max(h, w, 3);
    const ox = (s - w * u) / 2, oy = (s - h * u) / 2;
    return cell.cells
      .map(([r, c]) => `<rect x="${(ox + c * u).toFixed(1)}" y="${(oy + r * u).toFixed(1)}" width="${u.toFixed(1)}" height="${u.toFixed(1)}" fill="currentColor" fill-opacity="0.85" stroke="var(--bg, #fff)" stroke-width="1.5"/>`)
      .join("");
  }
  if (cell.t === "ring") {
    const m = s * 0.14, e = s - m;
    const P = [[m, m], [s / 2, m], [e, m], [e, s / 2], [e, e], [s / 2, e], [m, e], [m, s / 2]];
    let out = `<rect x="${m}" y="${m}" width="${e - m}" height="${e - m}" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.5"/>`;
    for (const [x, y] of P) out += `<circle cx="${x}" cy="${y}" r="${s * 0.025}" fill="currentColor" opacity="0.25"/>`;
    if (cell.pos2 != null) out += `<circle cx="${P[cell.pos2][0]}" cy="${P[cell.pos2][1]}" r="${s * 0.1}" fill="none" stroke="currentColor" stroke-width="2.5"/>`;
    if (cell.pos != null) out += `<circle cx="${P[cell.pos][0]}" cy="${P[cell.pos][1]}" r="${s * 0.075}" fill="currentColor"/>`;
    if (cell.arrow != null) {
      const c = s / 2, L = s * 0.2;
      out += `<g transform="rotate(${cell.arrow} ${c} ${c})"><line x1="${c}" y1="${c + L}" x2="${c}" y2="${c - L * 0.6}" stroke="currentColor" stroke-width="3"/><polygon points="${c},${c - L * 1.15} ${c - L * 0.45},${c - L * 0.45} ${c + L * 0.45},${c - L * 0.45}" fill="currentColor"/></g>`;
    }
    return out;
  }
  return "";
}

export function renderCell(cell, size = 84) {
  return `<svg class="fig" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${HATCH}${cellBody(cell, size)}</svg>`;
}

export function renderFigure(spec, size = 84) {
  if (spec.kind === "single") return renderCell(spec.cell, size * 1.4);
  if (spec.kind === "series") {
    const items = [...spec.items, null];
    const W = items.length * size + (items.length - 1) * 8;
    const inner = items
      .map((c, i) => `<g transform="translate(${i * (size + 8)},0)"><rect width="${size}" height="${size}" rx="6" fill="none" stroke="currentColor" stroke-opacity="0.2"/>${cellBody(c, size)}</g>`)
      .join("");
    return `<svg class="fig" viewBox="0 0 ${W} ${size}" width="${W}" height="${size}" xmlns="http://www.w3.org/2000/svg">${HATCH}${inner}</svg>`;
  }
  if (spec.kind === "analogy") {
    // A  :  B   =   C  :  ?
    const gap = 30;
    const cells = [...spec.items, null];
    const seps = [":", "=", ":"];
    const W = cells.length * size + seps.length * gap;
    let x = 0, inner = "";
    cells.forEach((c, i) => {
      inner += `<g transform="translate(${x},0)"><rect width="${size}" height="${size}" rx="6" fill="none" stroke="currentColor" stroke-opacity="0.2"/>${cellBody(c, size)}</g>`;
      x += size;
      if (i < seps.length) {
        inner += `<text x="${x + gap / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central" font-size="${size * 0.3}" fill="currentColor">${seps[i]}</text>`;
        x += gap;
      }
    });
    return `<svg class="fig" viewBox="0 0 ${W} ${size}" width="${W}" height="${size}" xmlns="http://www.w3.org/2000/svg">${HATCH}${inner}</svg>`;
  }
  if (spec.kind === "turns") {
    // Start arrow followed by turn chips such as "↻ 90°".
    const chipW = size * 0.95, gap = 10;
    const W = size + spec.turns.length * (chipW + gap);
    let inner = `<g><rect width="${size}" height="${size}" rx="6" fill="none" stroke="currentColor" stroke-opacity="0.2"/>${cellBody({ t: "ring", pos: null, arrow: spec.start }, size)}</g>`;
    spec.turns.forEach((t, i) => {
      const x = size + gap + i * (chipW + gap);
      inner += `<g transform="translate(${x},${size * 0.25})"><rect width="${chipW}" height="${size * 0.5}" rx="${size * 0.12}" fill="none" stroke="currentColor" stroke-opacity="0.5"/><text x="${chipW / 2}" y="${size * 0.25}" text-anchor="middle" dominant-baseline="central" font-size="${size * 0.22}" fill="currentColor">${t > 0 ? "↻" : "↺"} ${Math.abs(t)}°</text></g>`;
    });
    return `<svg class="fig" viewBox="0 0 ${W} ${size}" width="${W}" height="${size}" xmlns="http://www.w3.org/2000/svg">${HATCH}${inner}</svg>`;
  }
  if (spec.kind === "matrix") {
    const W = 3 * size;
    const inner = spec.cells
      .map((c, i) => `<g transform="translate(${(i % 3) * size},${Math.floor(i / 3) * size})"><rect width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-opacity="0.3"/>${cellBody(c, size)}</g>`)
      .join("");
    return `<svg class="fig" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}" xmlns="http://www.w3.org/2000/svg">${HATCH}${inner}</svg>`;
  }
  return "";
}
