import { access, mkdir, stat } from 'node:fs/promises';
import { dirname, relative } from 'node:path';
import sharp from 'sharp';

const files = [
  { path: 'public/images/mandarmoni2.jpg', quality: 72, maxWidth: 1600 },
  { path: 'public/images/sikkim2.jpg', quality: 72, maxWidth: 1600 },
  { path: 'public/images/kerala1.jpg', quality: 58, maxWidth: 1600 },
  { path: 'public/images/jagannath-puri-temple.jpg', quality: 58, maxWidth: 1200 },
  { path: 'public/images/home4/beach-1600.jpg', quality: 72, maxWidth: 1600 },
  { path: 'public/images/home4/mopunts-1920.jpg', quality: 72, maxWidth: 1600 },
  { path: 'public/images/activities/paragliding.jpg', quality: 72, maxWidth: 1600 },
  { path: 'public/images/mandarmoni.jpg', quality: 68, maxWidth: 1200 },
  { path: 'public/images/temple2.jpg', quality: 72, maxWidth: 1200 },
  { path: 'public/images/nature2.jpg', quality: 68, maxWidth: 1600 },
  { path: 'public/images/nature1.jpg', quality: 68, maxWidth: 1600 },
  { path: 'public/images/home4/city.jpg', quality: 72, maxWidth: 1200 },
  { path: 'public/images/rajsthan1.jpg', quality: 72, maxWidth: 1600 },
  { path: 'public/images/home4/tbp-map.png', quality: 78 },
  { path: 'public/UI/image.png', quality: 78 },
  { path: 'public/logo/logo.png', quality: 82 },
  { path: 'public/logo/logo-white.png', quality: 82 },
];

const toWebpPath = (file) => file.replace(/\.(jpe?g|png)$/i, '.webp');
const formatBytes = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

for (const { path: file, quality, maxWidth } of files) {
  await access(file);

  const output = toWebpPath(file);
  await mkdir(dirname(output), { recursive: true });

  const pipeline = sharp(file);
  if (maxWidth) {
    pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }

  await pipeline
    .webp({ quality, effort: 5 })
    .toFile(output);

  const [inputStat, outputStat] = await Promise.all([stat(file), stat(output)]);
  const saved = inputStat.size - outputStat.size;
  const pct = inputStat.size > 0 ? (saved / inputStat.size) * 100 : 0;

  console.log(
    `${relative(process.cwd(), file)} -> ${relative(process.cwd(), output)} ` +
      `(${formatBytes(inputStat.size)} to ${formatBytes(outputStat.size)}, ${pct.toFixed(1)}% saved)`
  );
}
