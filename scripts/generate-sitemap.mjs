import { writeFile } from 'node:fs/promises';

const PUBLIC_STATUSES = ['approved', 'live', 'published'];
const STATIC_ROUTES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/about', changefreq: 'monthly', priority: '0.8' },
  { path: '/map', changefreq: 'weekly', priority: '0.7' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
];

const siteUrl = normalizeSiteUrl(
  process.env.VITE_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || 'https://thebetterpass.com'
);
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const today = new Date().toISOString().slice(0, 10);

function normalizeSiteUrl(value) {
  const normalized = String(value || 'https://thebetterpass.com').trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://${normalized}`;
}

function normalizeListingType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'event') return 'guide';
  if (normalized === 'tour' || normalized === 'activity' || normalized === 'guide') return normalized;
  return null;
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function toDate(value) {
  if (!value) return today;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return today;
  return date.toISOString().slice(0, 10);
}

function buildUrl(path) {
  if (path === '/') return `${siteUrl}/`;
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

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

async function fetchRows(table, params) {
  if (!supabaseUrl || !supabaseAnonKey) return [];

  const url = new URL(`${normalizeSiteUrl(supabaseUrl)}/rest/v1/${table}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      signal: controller.signal,
    });
    const body = await response.text();

    if (!response.ok) {
      throw new Error(`${table} query failed with ${response.status}: ${body.slice(0, 240)}`);
    }

    return body ? JSON.parse(body) : [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPostListings() {
  try {
    return await fetchRows('posts', {
      select: 'id,type,status,updated_at,reviewed_at,created_at',
      status: `in.(${PUBLIC_STATUSES.join(',')})`,
      order: 'updated_at.desc.nullslast',
      limit: '5000',
    });
  } catch {
    try {
      return await fetchRows('posts', {
        select: 'id,type,status,reviewed_at,created_at',
        status: `in.(${PUBLIC_STATUSES.join(',')})`,
        order: 'created_at.desc.nullslast',
        limit: '5000',
      });
    } catch {
      return fetchRows('posts', {
        select: 'id,type,status,created_at',
        status: `in.(${PUBLIC_STATUSES.join(',')})`,
        order: 'created_at.desc.nullslast',
        limit: '5000',
      });
    }
  }
}

async function fetchLegacyListings(table) {
  try {
    return await fetchRows(table, {
      select: 'id,status,updated_at,created_at',
      status: `in.(${PUBLIC_STATUSES.join(',')})`,
      order: 'updated_at.desc.nullslast',
      limit: '5000',
    });
  } catch {
    try {
      return await fetchRows(table, {
        select: 'id,status,created_at',
        status: `in.(${PUBLIC_STATUSES.join(',')})`,
        order: 'created_at.desc.nullslast',
        limit: '5000',
      });
    } catch {
      try {
        return await fetchRows(table, {
          select: 'id,created_at',
          order: 'created_at.desc.nullslast',
          limit: '5000',
        });
      } catch {
        return fetchRows(table, {
          select: 'id',
          limit: '5000',
        });
      }
    }
  }
}

function staticEntries() {
  return STATIC_ROUTES.map((route) => ({
    loc: buildUrl(route.path),
    lastmod: today,
    changefreq: route.changefreq,
    priority: route.priority,
  }));
}

function listingEntry(row, type) {
  if (!row?.id || !type) return null;

  const lastmod = toDate(row.updated_at || row.reviewed_at || row.created_at);

  return {
    loc: buildUrl(`/listings/${type}/${encodeURIComponent(String(row.id))}`),
    lastmod,
    changefreq: 'weekly',
    priority: '0.8',
  };
}

async function dynamicListingEntries() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Sitemap: Supabase env vars missing, writing static routes only.');
    return [];
  }

  try {
    const [posts, tours, activities, events] = await Promise.all([
      fetchPostListings(),
      fetchLegacyListings('tours'),
      fetchLegacyListings('activities'),
      fetchLegacyListings('events'),
    ]);

    return [
      ...posts.map((row) => listingEntry(row, normalizeListingType(row.type))),
      ...tours.map((row) => listingEntry(row, 'tour')),
      ...activities.map((row) => listingEntry(row, 'activity')),
      ...events.map((row) => listingEntry(row, 'guide')),
    ].filter(Boolean);
  } catch (error) {
    console.warn(`Sitemap: could not fetch listings, writing static routes only. ${error.message}`);
    return [];
  }
}

const entriesByLocation = new Map();

for (const entry of [...staticEntries(), ...(await dynamicListingEntries())]) {
  if (!entriesByLocation.has(entry.loc)) {
    entriesByLocation.set(entry.loc, entry);
  }
}

const entries = Array.from(entriesByLocation.values());
await writeFile('public/sitemap.xml', renderSitemap(entries), 'utf8');

console.log(`Sitemap: wrote ${entries.length} URLs to public/sitemap.xml`);
