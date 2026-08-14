// One-off generator for a stylized, label-free decorative "map" background for Goa.
// Not traced from real geodata — an original vector illustration in the same
// visual language as the Kolkata raster export (thin road lines, muted river,
// small city dots, no text).
import { writeFileSync } from "node:fs";

const W = 1600;
const H = 900;

// seeded PRNG so the output is reproducible
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2026);
const lerp = (a, b, t) => a + (b - a) * t;

// --- coastline (Arabian Sea on the west, land on the east) -----------------
// A wavy vertical-ish boundary with a couple of bays/inlets, running full height.
const coastPoints = [];
const coastBaseX = 560;
for (let i = 0; i <= 20; i++) {
  const y = (H * i) / 20;
  const wobble =
    Math.sin(i * 0.9) * 55 + Math.sin(i * 2.3 + 1) * 22 + (rand() - 0.5) * 18;
  coastPoints.push([coastBaseX + wobble, y]);
}
function smoothPath(points, close) {
  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    d += ` Q ${x0.toFixed(1)} ${y0.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  d += ` L ${points[points.length - 1][0].toFixed(1)} ${points[points.length - 1][1].toFixed(1)}`;
  if (close) d += ` L -20 ${H + 20} L -20 -20 Z`;
  return d;
}
const seaPath = smoothPath(coastPoints, true);

// small offshore island near the coast
const islandCx = 470,
  islandCy = 430;

// --- rivers: two estuaries running from the Western Ghats (east) to the sea (west)
function riverPath(startY, endY, sag) {
  const pts = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = lerp(W + 40, coastBaseX - 10, t);
    const y = lerp(startY, endY, t) + Math.sin(t * Math.PI) * sag;
    pts.push([x, y]);
  }
  return smoothPath(pts, false);
}
const river1 = riverPath(260, 380, -70);
const river2 = riverPath(560, 470, 60);

// --- road network: organic random-walk lines confined to the land side -----
function isOnLand(x) {
  return x > coastBaseX + 40;
}
function roadPath(startX, startY) {
  let x = startX,
    y = startY;
  let d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
  const segments = 4 + Math.floor(rand() * 5);
  for (let i = 0; i < segments; i++) {
    const nx = x + lerp(-90, 160, rand());
    const ny = y + lerp(-90, 90, rand());
    const cx = x + (nx - x) * 0.5 + lerp(-40, 40, rand());
    const cy = y + (ny - y) * 0.5 + lerp(-40, 40, rand());
    d += ` Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`;
    x = nx;
    y = ny;
  }
  return d;
}

const minorRoads = [];
const majorRoads = [];
for (let i = 0; i < 46; i++) {
  const sx = lerp(coastBaseX + 60, W - 40, rand());
  const sy = lerp(30, H - 30, rand());
  if (!isOnLand(sx)) continue;
  const d = roadPath(sx, sy);
  (rand() < 0.22 ? majorRoads : minorRoads).push(d);
}

// a light highway-ish backbone roughly parallel to the coast (NH66 style)
const backbone = smoothPath(
  coastPoints.map(([x, y]) => [x + 95 + Math.sin(y * 0.02) * 12, y]),
  false
);

// --- city / town dot markers ------------------------------------------------
const markers = [];
for (let i = 0; i < 16; i++) {
  const x = lerp(coastBaseX + 70, W - 60, rand());
  const y = lerp(40, H - 40, rand());
  if (!isOnLand(x)) continue;
  markers.push({ x, y, r: 3 + rand() * 2.5 });
}
// one larger "capital" marker near the coast (stand-in for Panaji, no label)
markers.push({ x: coastBaseX + 140, y: 400, r: 8 });

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="0" y="0" width="${W}" height="${H}" fill="#f7f7f5" />
  <path d="${seaPath}" fill="#e8f0f2" />
  <circle cx="${islandCx}" cy="${islandCy}" r="7" fill="#e8f0f2" stroke="#cfdfe3" stroke-width="1" />

  <g fill="none" stroke="#d6d6d2" stroke-width="1.1" stroke-linecap="round">
    ${minorRoads.map((d) => `<path d="${d}" />`).join("\n    ")}
  </g>

  <g fill="none" stroke="#bdbdb8" stroke-width="2" stroke-linecap="round">
    ${majorRoads.map((d) => `<path d="${d}" />`).join("\n    ")}
    <path d="${backbone}" />
  </g>

  <path d="${coastPoints.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#c3d6da" stroke-width="1.5" />

  <g fill="none" stroke="#9fc7c2" stroke-width="2.5" stroke-linecap="round">
    <path d="${river1}" />
    <path d="${river2}" />
  </g>

  <g fill="#8a8a85">
    ${markers
      .map((m) => `<circle cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="${m.r.toFixed(1)}" />`)
      .join("\n    ")}
  </g>
</svg>
`;

writeFileSync(new URL("../public/map/goa-map-bg.svg", import.meta.url), svg);
console.log("wrote goa-map-bg.svg, bytes:", Buffer.byteLength(svg));
