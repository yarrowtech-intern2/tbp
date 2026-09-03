import { writeFile } from 'node:fs/promises';
import {
  STATIC_ROUTES,
  buildUrl,
  fetchDynamicBlogsForSeo,
  fetchDynamicListingsForSeo,
  getSiteUrl,
  toDate,
  xmlEscape,
} from './seo-shared.mjs';

const siteUrl = getSiteUrl();
const today = new Date().toISOString().slice(0, 10);

function renderSitemap(entries) {
  const urls = entries
    .map((entry) => [
      '  <url>',
      `    <loc>${xmlEscape(entry.loc)}</loc>`,
      `    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>`,
      `    <changefreq>${xmlEscape(entry.changefreq)}</changefreq>`,
      `    <priority>${xmlEscape(entry.priority)}</priority>`,
      '  </url>',
    ].join('\n'))
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n');
}

function staticEntries() {
  return STATIC_ROUTES.map((route) => ({
    loc: buildUrl(route.path, siteUrl),
    lastmod: today,
    changefreq: route.changefreq,
    priority: route.priority,
  }));
}

const entriesByLocation = new Map();

for (const entry of [...staticEntries(), ...(await fetchDynamicListingsForSeo(siteUrl)), ...(await fetchDynamicBlogsForSeo(siteUrl))]) {
  if (!entriesByLocation.has(entry.loc)) {
    entriesByLocation.set(entry.loc, {
      loc: entry.loc,
      lastmod: entry.lastmod ? toDate(entry.lastmod) : today,
      changefreq: entry.changefreq,
      priority: entry.priority,
    });
  }
}

const entries = Array.from(entriesByLocation.values());
await writeFile('public/sitemap.xml', renderSitemap(entries), 'utf8');

console.log(`Sitemap: wrote ${entries.length} URLs to public/sitemap.xml`);
