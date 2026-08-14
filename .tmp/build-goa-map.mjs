import { writeFileSync, readFileSync } from "node:fs";
import sharp from "sharp";

// Goa bounding box (state extent, land + coast)
const BBOX = { west: 73.62, east: 74.36, south: 14.88, north: 15.82 };
const ZOOM = 12;
const TILE = 256;
const STYLE = "light_nolabels"; // CARTO Positron, no text baked in

function lon2x(lon, z) {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}
function lat2y(lat, z) {
  const r = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z
  );
}
function x2lon(x, z) {
  return (x / 2 ** z) * 360 - 180;
}
function y2lat(y, z) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

const xmin = lon2x(BBOX.west, ZOOM);
const xmax = lon2x(BBOX.east, ZOOM);
const ymin = lat2y(BBOX.north, ZOOM);
const ymax = lat2y(BBOX.south, ZOOM);
const cols = xmax - xmin + 1;
const rows = ymax - ymin + 1;
console.log("tiles:", cols, "x", rows, "=", cols * rows);

import { existsSync, mkdirSync, readFileSync as readF, writeFileSync as writeF } from "node:fs";
const cacheDir = new URL("./tile-cache/", import.meta.url);
if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });

const subs = ["a", "b", "c", "d"];
let si = 0;
async function fetchTile(x, y) {
  const cachePath = new URL(`${ZOOM}_${x}_${y}.png`, cacheDir);
  if (existsSync(cachePath)) return readF(cachePath);
  const s = subs[si++ % subs.length];
  const url = `https://${s}.basemaps.cartocdn.com/${STYLE}/${ZOOM}/${x}/${y}.png`;
  const res = await fetch(url, { headers: { "User-Agent": "tbp-map-preview/1.0" } });
  if (!res.ok) throw new Error(`tile fetch failed ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeF(cachePath, buf);
  return buf;
}

const composites = [];
for (let ty = ymin; ty <= ymax; ty++) {
  for (let tx = xmin; tx <= xmax; tx++) {
    const buf = await fetchTile(tx, ty);
    composites.push({
      input: buf,
      left: (tx - xmin) * TILE,
      top: (ty - ymin) * TILE,
    });
  }
}
console.log("fetched", composites.length, "tiles");

const canvasW = cols * TILE;
const canvasH = rows * TILE;

let mosaic = sharp({
  create: {
    width: canvasW,
    height: canvasH,
    channels: 4,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  },
}).composite(composites);

// crop mosaic to the exact requested bbox (tile edges cover a slightly larger area)
const pxPerLon = canvasW / (x2lon(xmax + 1, ZOOM) - x2lon(xmin, ZOOM));
const mosaicWestLon = x2lon(xmin, ZOOM);
const mosaicNorthLat = y2lat(ymin, ZOOM);
const mosaicSouthLat = y2lat(ymax + 1, ZOOM);
const pxPerLat = canvasH / (mosaicNorthLat - mosaicSouthLat);

const cropLeft = Math.round((BBOX.west - mosaicWestLon) * pxPerLon);
const cropRight = Math.round((BBOX.east - mosaicWestLon) * pxPerLon);
const cropTop = Math.round((mosaicNorthLat - BBOX.north) * pxPerLat);
const cropBottom = Math.round((mosaicNorthLat - BBOX.south) * pxPerLat);

const cropW = cropRight - cropLeft;
const cropH = cropBottom - cropTop;
console.log("crop:", cropLeft, cropTop, cropW, cropH);

const cropped = await mosaic
  .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
  .raw()
  .toBuffer({ resolveWithObject: true });

// match Kolkata's target aspect/output width for consistency
const TARGET_W = 2000;
const TARGET_H = 1126;

const resized = await sharp(cropped.data, { raw: cropped.info })
  .resize(TARGET_W, TARGET_H, { fit: "cover", position: "centre" })
  // CARTO's stock water tint is more saturated than Kolkata's muted export;
  // pull it toward the same near-monochrome palette
  .modulate({ saturation: 0.25, brightness: 1.04 })
  .png()
  .toBuffer();

// reuse the *actual* fade layer from the original Kolkata export so both
// backgrounds share identical edge treatment instead of an approximation
const kolkataSrc = readFileSync(
  new URL("../public/map/kolkata-map.svg", import.meta.url),
  "utf8"
);
const fadeMatch = kolkataSrc.match(
  /id="overlay-layer-fades">\s*<image href="data:image\/png;base64,([^"]+)"/
);
const fadeBuf = Buffer.from(fadeMatch[1], "base64");
const fadeResized = await sharp(fadeBuf)
  .resize(TARGET_W, TARGET_H, { fit: "fill" })
  .png()
  .toBuffer();

const withFade = await sharp(resized)
  .composite([{ input: fadeResized }])
  .png()
  .toBuffer();

const webp = await sharp(withFade).webp({ quality: 82 }).toBuffer();
console.log("final webp bytes:", webp.length);

const b64 = webp.toString("base64");
const outSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${TARGET_W}" height="${TARGET_H}" viewBox="0 0 ${TARGET_W} ${TARGET_H}">
  <image href="data:image/webp;base64,${b64}" width="${TARGET_W}" height="${TARGET_H}" preserveAspectRatio="none" />
</svg>
`;

writeFileSync(new URL("../public/map/goa-map-bg.svg", import.meta.url), outSvg);
console.log("wrote goa-map-bg.svg, bytes:", Buffer.byteLength(outSvg));
