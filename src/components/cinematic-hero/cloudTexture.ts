// Procedurally generates a soft, fluffy cloud-puff sprite as a data URL.
// drei's <Clouds> defaults to fetching a texture from a remote CDN — this
// avoids that network dependency entirely (self-contained, resolves
// instantly, no third-party fetch on the critical loading path) while still
// giving each puff a natural, non-circular silhouette via a handful of
// overlapping soft radial gradients instead of one plain circle.

const SIZE = 256;

let cachedDataUrl: string | null = null;

const BLOBS = [
  { x: 0.5, y: 0.5, r: 0.42, a: 1 },
  { x: 0.32, y: 0.55, r: 0.28, a: 0.9 },
  { x: 0.68, y: 0.52, r: 0.3, a: 0.9 },
  { x: 0.45, y: 0.34, r: 0.26, a: 0.85 },
  { x: 0.58, y: 0.68, r: 0.24, a: 0.8 },
  { x: 0.36, y: 0.7, r: 0.2, a: 0.75 },
] as const;

export const getCloudTextureDataUrl = (): string => {
  if (cachedDataUrl) return cachedDataUrl;

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.globalCompositeOperation = 'lighter';

  BLOBS.forEach(({ x, y, r, a }) => {
    const cx = x * SIZE;
    const cy = y * SIZE;
    const radius = r * SIZE;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${a})`);
    gradient.addColorStop(0.6, `rgba(255,255,255,${a * 0.55})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  cachedDataUrl = canvas.toDataURL('image/png');
  return cachedDataUrl;
};
