import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  STATIC_NOINDEX_PATHS,
  STATIC_ROUTES,
  buildRouteSeo,
  fetchDynamicBlogsForSeo,
  fetchDynamicListingsForSeo,
  getSiteUrl,
  injectSeoIntoHtml,
} from './seo-shared.mjs';

const distDir = 'dist';
const siteUrl = getSiteUrl();
const sourceHtml = await readFile(join(distDir, 'index.html'), 'utf8');
const routes = [
  ...STATIC_ROUTES.map((route) => ({
    path: route.path,
    seo: buildRouteSeo(route.path, siteUrl),
  })),
  ...STATIC_NOINDEX_PATHS.map((path) => ({
    path,
    seo: buildRouteSeo(path, siteUrl),
  })),
  ...(await fetchDynamicListingsForSeo(siteUrl)).map((entry) => ({
    path: entry.path,
    seo: entry.seo,
  })),
  ...(await fetchDynamicBlogsForSeo(siteUrl)).map((entry) => ({
    path: entry.path,
    seo: entry.seo,
  })),
];

const seen = new Set();
let written = 0;

for (const route of routes) {
  if (!route.path || seen.has(route.path)) continue;
  seen.add(route.path);

  const target = htmlPathForRoute(route.path);
  const html = injectSeoIntoHtml(sourceHtml, route.seo, siteUrl);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html, 'utf8');
  written += 1;
}

console.log(`Static SEO: wrote ${written} prerendered HTML files to ${distDir}`);

function htmlPathForRoute(path) {
  if (path === '/') return join(distDir, 'index.html');
  return join(distDir, path.replace(/^\/+/, ''), 'index.html');
}
