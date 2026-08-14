import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const svgPath = new URL("../public/map/kolkata-map-bg.svg", import.meta.url);
const src = readFileSync(svgPath, "utf8");

const matches = [...src.matchAll(/href="data:image\/png;base64,([^"]+)"/g)];
console.log("layers found:", matches.length);

const rawBuffers = matches.map((m) => Buffer.from(m[1], "base64"));

const meta = await sharp(rawBuffers[0]).metadata();
console.log("native size:", meta.width, meta.height);

// each layer's <image> is stretched via preserveAspectRatio="none" to the doc
// size; normalize every layer to identical raw RGBA pixel grids before
// compositing so sharp's dimension check can't trip on metadata mismatches
const rawLayers = await Promise.all(
  rawBuffers.map((b) =>
    sharp(b)
      .resize(meta.width, meta.height, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
  )
);

let acc = { data: rawLayers[0].data, info: rawLayers[0].info };
for (let i = 1; i < rawLayers.length; i++) {
  const l = rawLayers[i];
  const out = await sharp(acc.data, { raw: acc.info })
    .composite([{ input: l.data, raw: l.info }])
    .raw()
    .toBuffer({ resolveWithObject: true });
  acc = { data: out.data, info: out.info };
  console.log("composited layer", i, JSON.stringify(out.info));
}

const TARGET_W = 2000;
const targetH = Math.round((meta.height / meta.width) * TARGET_W);

const flattened = await sharp(acc.data, { raw: acc.info })
  .resize(TARGET_W, targetH)
  .png()
  .toBuffer();

const webp = await sharp(flattened).webp({ quality: 82 }).toBuffer();
const png8 = await sharp(flattened)
  .png({ palette: true, quality: 80, effort: 8 })
  .toBuffer();

console.log("flattened png (pre-compress):", flattened.length);
console.log("webp:", webp.length);
console.log("png8:", png8.length);

const final = webp.length < png8.length ? webp : png8;
const mime = webp.length < png8.length ? "image/webp" : "image/png";
console.log("using:", mime, final.length);

const b64 = final.toString("base64");
const outSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${TARGET_W}" height="${targetH}" viewBox="0 0 ${TARGET_W} ${targetH}">
  <image href="data:${mime};base64,${b64}" width="${TARGET_W}" height="${targetH}" preserveAspectRatio="none" />
</svg>
`;

writeFileSync(svgPath, outSvg);
console.log("final svg bytes:", Buffer.byteLength(outSvg));
