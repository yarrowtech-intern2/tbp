export const BRAND_NAME = 'The Better Pass';
export const DEFAULT_SITE_URL = 'https://thebetterpass.com';
export const DEFAULT_IMAGE_PATH = '/images/home4/tbp-map-1920.png';
export const DEFAULT_TITLE = 'The Better Pass | Verified Travel Discovery, Tours, Activities and Local Guides';
export const DEFAULT_DESCRIPTION = 'The Better Pass helps travelers discover verified tours, activities, local guides, destination ideas and provider-backed travel experiences in one booking-ready platform.';
export const ROBOTS_INDEX = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
export const ROBOTS_NOINDEX = 'noindex, nofollow, noarchive';
export const PUBLIC_STATUSES = ['approved', 'live', 'published'];

export const STATIC_ROUTES = [
  {
    path: '/',
    changefreq: 'daily',
    priority: '1.0',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    jsonLd: (siteUrl) => [
      buildOrganizationJsonLd(siteUrl),
      buildWebsiteJsonLd(siteUrl),
      buildHomeFaqJsonLd(siteUrl),
      buildBreadcrumbJsonLd('/', DEFAULT_TITLE, siteUrl),
    ],
  },
  {
    path: '/about',
    changefreq: 'monthly',
    priority: '0.8',
    type: 'article',
    title: 'About The Better Pass | Verified Travel Ecosystem for Travelers and Providers',
    description: 'Learn how The Better Pass connects travelers, local partners, verified providers, bookings, promotions and destination discovery in one travel platform.',
    jsonLd: (siteUrl) => [
      buildOrganizationJsonLd(siteUrl),
      buildBreadcrumbJsonLd('/about', 'About The Better Pass', siteUrl),
    ],
  },
  {
    path: '/map',
    changefreq: 'weekly',
    priority: '0.7',
    title: 'Travel Map | Route Planning and Destination Discovery | The Better Pass',
    description: 'Explore destination routes, nearby travel anchors and map-based planning tools for discovering places with The Better Pass.',
    jsonLd: (siteUrl) => buildBreadcrumbJsonLd('/map', 'Travel Map', siteUrl),
  },
  {
    path: '/terms',
    changefreq: 'yearly',
    priority: '0.3',
    type: 'article',
    title: 'Terms and Conditions | The Better Pass',
    description: 'Read the terms for using The Better Pass, including accounts, bookings, payments, provider content, traveler conduct and platform communications.',
    jsonLd: (siteUrl) => buildBreadcrumbJsonLd('/terms', 'Terms and Conditions', siteUrl),
  },
];

export const PRIVATE_ROUTE_PREFIXES = [
  '/auth',
  '/dashboard',
  '/profile',
  '/users',
  '/messages',
  '/admin',
  '/provider',
  '/notifications',
  '/explore',
  '/destination',
];

export const NOINDEX_ROUTES = {
  '/about-final': {
    title: 'About Preview | The Better Pass',
    description: 'Preview version of The Better Pass about page.',
  },
  '/whomadeit': {
    title: 'Credits | The Better Pass',
    description: 'Project credits for The Better Pass.',
  },
};

export const STATIC_NOINDEX_PATHS = [
  '/auth',
  '/dashboard',
  '/profile',
  '/messages',
  '/admin',
  '/provider/studio',
  '/provider/terms',
  '/notifications',
  '/explore',
  '/about-final',
  '/whomadeit',
];

export function normalizeSiteUrl(value) {
  const normalized = String(value || DEFAULT_SITE_URL).trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://${normalized}`;
}

export function getSiteUrl() {
  return normalizeSiteUrl(process.env.VITE_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || DEFAULT_SITE_URL);
}

export function normalizePath(value) {
  if (!value || value === '/') return '/';
  const withoutHash = String(value).split('#')[0] || '/';
  const withoutQuery = withoutHash.split('?')[0] || '/';
  return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
}

export function buildUrl(path, siteUrl = getSiteUrl()) {
  const normalizedPath = normalizePath(path);
  if (normalizedPath === '/') return `${siteUrl}/`;
  return `${siteUrl}${normalizedPath}`;
}

export function buildCanonical(path, siteUrl = getSiteUrl()) {
  const normalizedPath = normalizePath(path);
  return normalizedPath === '/' ? siteUrl : `${siteUrl}${normalizedPath}`;
}

export function absolutizeUrl(value, siteUrl = getSiteUrl()) {
  if (!value) return `${siteUrl}${DEFAULT_IMAGE_PATH}`;
  if (/^https?:\/\//i.test(value)) return value;
  return `${siteUrl}${value.startsWith('/') ? value : `/${value}`}`;
}

export function normalizeListingType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'event') return 'guide';
  if (normalized === 'tour' || normalized === 'activity' || normalized === 'guide') return normalized;
  return null;
}

export function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function htmlEscape(value) {
  return xmlEscape(value);
}

export function toDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function buildOrganizationJsonLd(siteUrl = getSiteUrl()) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TravelAgency',
    '@id': `${siteUrl}/#organization`,
    name: BRAND_NAME,
    alternateName: 'Better Pass',
    url: siteUrl,
    logo: `${siteUrl}/favicon/favicon-512.png`,
    image: `${siteUrl}${DEFAULT_IMAGE_PATH}`,
    description: DEFAULT_DESCRIPTION,
    email: 'hello@thebetterpass.com',
    areaServed: ['India', 'Asia'],
    knowsAbout: [
      'travel planning',
      'tour booking',
      'local guides',
      'activities',
      'destination discovery',
      'verified travel providers',
    ],
    contactPoint: [{
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'hello@thebetterpass.com',
      areaServed: 'IN',
      availableLanguage: ['English', 'Hindi'],
    }],
  };
}

export function buildWebsiteJsonLd(siteUrl = getSiteUrl()) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    name: BRAND_NAME,
    alternateName: 'Better Pass',
    url: siteUrl,
    publisher: { '@id': `${siteUrl}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/explore?query={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildHomeFaqJsonLd(siteUrl = getSiteUrl()) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${siteUrl}/#faq`,
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is The Better Pass?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The Better Pass is a travel discovery and booking platform for verified tours, activities, local guides, destination services and provider-managed travel experiences.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can providers publish travel listings?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Verified providers can publish tours, activities and guide-led experiences, manage bookings, receive traveler messages and use dashboard tools for operations.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can travelers book packages through The Better Pass?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Travelers can discover listings, save favorites, book packages, track payments and manage booking status from their account dashboard.',
        },
      },
    ],
  };
}

export function buildBreadcrumbJsonLd(path, title, siteUrl = getSiteUrl()) {
  const normalizedPath = normalizePath(path);
  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: BRAND_NAME,
      item: siteUrl,
    },
  ];

  if (normalizedPath !== '/') {
    items.push({
      '@type': 'ListItem',
      position: 2,
      name: String(title).replace(/\s\|\sThe Better Pass.*$/i, ''),
      item: `${siteUrl}${normalizedPath}`,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

export function buildListingJsonLd(input, siteUrl = getSiteUrl()) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: input.title,
    description: input.description,
    url: input.url,
    image: input.image,
    provider: { '@id': `${siteUrl}/#organization` },
  };

  if (input.location) {
    data.touristType = 'Travelers';
    data.itinerary = {
      '@type': 'Place',
      name: input.location,
    };
  }

  if (input.price && Number(input.price) > 0) {
    data.offers = {
      '@type': 'Offer',
      price: Number(input.price),
      priceCurrency: input.currency || 'INR',
      availability: 'https://schema.org/InStock',
      url: input.url,
    };
  }

  if (input.ratingValue && input.reviewCount && Number(input.reviewCount) > 0) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: input.ratingValue,
      reviewCount: input.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return [
    buildOrganizationJsonLd(siteUrl),
    data,
    buildBreadcrumbJsonLd(new URL(input.url).pathname, input.title, siteUrl),
  ];
}

export function buildRouteSeo(path, siteUrl = getSiteUrl()) {
  const normalizedPath = normalizePath(path);
  const staticRoute = STATIC_ROUTES.find((route) => route.path === normalizedPath);
  if (staticRoute) {
    return {
      title: staticRoute.title,
      description: staticRoute.description,
      path: staticRoute.path,
      type: staticRoute.type || 'website',
      image: DEFAULT_IMAGE_PATH,
      noindex: false,
      jsonLd: staticRoute.jsonLd(siteUrl),
    };
  }

  if (/^\/listings\/[^/]+\/[^/]+/.test(normalizedPath)) {
    return {
      title: 'Travel Package Details | Tours, Activities and Local Guides | The Better Pass',
      description: 'View package details, traveler reviews, pricing, provider information and booking options on The Better Pass.',
      path: normalizedPath,
      type: 'product',
      image: DEFAULT_IMAGE_PATH,
      noindex: false,
      jsonLd: buildBreadcrumbJsonLd(normalizedPath, 'Travel Package Details', siteUrl),
    };
  }

  const noindexRoute = NOINDEX_ROUTES[normalizedPath];
  if (noindexRoute) {
    return {
      ...noindexRoute,
      path: normalizedPath,
      type: 'website',
      image: DEFAULT_IMAGE_PATH,
      noindex: true,
    };
  }

  if (PRIVATE_ROUTE_PREFIXES.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`))) {
    return {
      title: `${BRAND_NAME} | Account Area`,
      description: 'Secure account area for The Better Pass travelers, providers and administrators.',
      path: normalizedPath,
      type: 'website',
      image: DEFAULT_IMAGE_PATH,
      noindex: true,
    };
  }

  return {
    title: `${BRAND_NAME} | Travel Platform`,
    description: DEFAULT_DESCRIPTION,
    path: normalizedPath,
    type: 'website',
    image: DEFAULT_IMAGE_PATH,
    noindex: true,
  };
}

export function renderSeoTags(seo, siteUrl = getSiteUrl()) {
  const canonical = buildCanonical(seo.path, siteUrl);
  const image = absolutizeUrl(seo.image || DEFAULT_IMAGE_PATH, siteUrl);
  const robots = seo.noindex ? ROBOTS_NOINDEX : ROBOTS_INDEX;
  const type = seo.type || 'website';
  const jsonLdItems = seo.jsonLd ? (Array.isArray(seo.jsonLd) ? seo.jsonLd : [seo.jsonLd]) : [];
  const jsonLdTags = jsonLdItems
    .map((item) => `    <script type="application/ld+json">${JSON.stringify(item)}</script>`)
    .join('\n');

  return [
    `    <title>${htmlEscape(seo.title)}</title>`,
    `    <meta name="description" content="${htmlEscape(seo.description)}" />`,
    `    <meta name="robots" content="${htmlEscape(robots)}" />`,
    `    <meta name="googlebot" content="${htmlEscape(robots)}" />`,
    `    <meta name="bingbot" content="${htmlEscape(robots)}" />`,
    `    <meta name="author" content="${htmlEscape(BRAND_NAME)}" />`,
    `    <meta name="application-name" content="${htmlEscape(BRAND_NAME)}" />`,
    `    <meta name="apple-mobile-web-app-title" content="${htmlEscape(BRAND_NAME)}" />`,
    `    <meta name="theme-color" content="#0b1320" />`,
    `    <link rel="canonical" href="${htmlEscape(canonical)}" />`,
    `    <meta property="og:site_name" content="${htmlEscape(BRAND_NAME)}" />`,
    `    <meta property="og:type" content="${htmlEscape(type)}" />`,
    '    <meta property="og:locale" content="en_IN" />',
    `    <meta property="og:title" content="${htmlEscape(seo.title)}" />`,
    `    <meta property="og:description" content="${htmlEscape(seo.description)}" />`,
    `    <meta property="og:url" content="${htmlEscape(canonical)}" />`,
    `    <meta property="og:image" content="${htmlEscape(image)}" />`,
    `    <meta property="og:image:alt" content="${htmlEscape(`${BRAND_NAME} travel discovery platform`)}" />`,
    '    <meta property="og:image:width" content="1200" />',
    '    <meta property="og:image:height" content="630" />',
    '    <meta name="twitter:card" content="summary_large_image" />',
    `    <meta name="twitter:title" content="${htmlEscape(seo.title)}" />`,
    `    <meta name="twitter:description" content="${htmlEscape(seo.description)}" />`,
    `    <meta name="twitter:image" content="${htmlEscape(image)}" />`,
    `    <meta name="twitter:image:alt" content="${htmlEscape(`${BRAND_NAME} travel discovery platform`)}" />`,
    jsonLdTags,
  ].filter(Boolean).join('\n');
}

export function injectSeoIntoHtml(html, seo, siteUrl = getSiteUrl()) {
  const managedMetaNames = [
    'description',
    'robots',
    'googlebot',
    'bingbot',
    'author',
    'application-name',
    'apple-mobile-web-app-title',
    'theme-color',
    'twitter:card',
    'twitter:title',
    'twitter:description',
    'twitter:image',
    'twitter:image:alt',
  ];
  const managedProperties = [
    'og:site_name',
    'og:type',
    'og:locale',
    'og:title',
    'og:description',
    'og:url',
    'og:image',
    'og:image:alt',
    'og:image:width',
    'og:image:height',
  ];

  let nextHtml = html
    .replace(/<title>[\s\S]*?<\/title>\s*/gi, '')
    .replace(/<link\s+[^>]*rel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, '');

  for (const name of managedMetaNames) {
    nextHtml = nextHtml.replace(new RegExp(`<meta\\s+[^>]*name=["']${escapeRegExp(name)}["'][^>]*>\\s*`, 'gi'), '');
  }
  for (const property of managedProperties) {
    nextHtml = nextHtml.replace(new RegExp(`<meta\\s+[^>]*property=["']${escapeRegExp(property)}["'][^>]*>\\s*`, 'gi'), '');
  }

  return nextHtml.replace('</head>', `${renderSeoTags(seo, siteUrl)}\n  </head>`);
}

export function buildListingSeo(row, type, siteUrl = getSiteUrl()) {
  const listingType = normalizeListingType(type || row?.type) || 'activity';
  const displayType = listingType === 'guide' ? 'event' : listingType;
  const title = cleanString(row?.title) || cleanString(row?.name) || `${capitalize(displayType)} Package`;
  const sourceDescription = cleanString(row?.description);
  const location = cleanString(row?.location);
  const descriptionBase = sourceDescription
    ? truncate(stripHtml(sourceDescription), 155)
    : `Book ${title} with verified provider details, traveler reviews and secure checkout on The Better Pass.`;
  const description = `${descriptionBase}${location ? ` Location: ${location}.` : ''}`.trim();
  const image = absolutizeUrl(getPrimaryListingImage(row), siteUrl);
  const path = `/listings/${listingType}/${encodeURIComponent(String(row.id))}`;
  const url = buildUrl(path, siteUrl);

  return {
    title: `${title} | ${capitalize(displayType)} Package | The Better Pass`,
    description,
    path,
    type: 'product',
    image,
    noindex: false,
    jsonLd: buildListingJsonLd({
      title,
      description,
      url,
      image,
      price: row?.price,
      currency: 'INR',
      location,
    }, siteUrl),
  };
}

export async function fetchDynamicListingsForSeo(siteUrl = getSiteUrl()) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('SEO: Supabase env vars missing, using static routes only.');
    return [];
  }

  const [posts, tours, activities, events] = await Promise.all([
    safeFetchListings('posts', () => fetchPostListings(supabaseUrl, supabaseAnonKey)),
    safeFetchListings('tours', () => fetchLegacyListings('tours', supabaseUrl, supabaseAnonKey)),
    safeFetchListings('activities', () => fetchLegacyListings('activities', supabaseUrl, supabaseAnonKey)),
    safeFetchListings('events', () => fetchLegacyListings('events', supabaseUrl, supabaseAnonKey)),
  ]);

  return [
    ...posts.map((row) => listingEntry(row, normalizeListingType(row.type), siteUrl)),
    ...tours.map((row) => listingEntry(row, 'tour', siteUrl)),
    ...activities.map((row) => listingEntry(row, 'activity', siteUrl)),
    ...events.map((row) => listingEntry(row, 'guide', siteUrl)),
  ].filter(Boolean);
}

async function safeFetchListings(label, fetcher) {
  try {
    return await fetcher();
  } catch (error) {
    console.warn(`SEO: could not fetch ${label} listings. ${error.message}`);
    return [];
  }
}

function listingEntry(row, type, siteUrl) {
  if (!row?.id || !type) return null;
  const seo = buildListingSeo(row, type, siteUrl);
  return {
    loc: buildUrl(seo.path, siteUrl),
    path: seo.path,
    lastmod: toDate(row.updated_at || row.reviewed_at || row.created_at),
    changefreq: 'weekly',
    priority: '0.8',
    seo,
  };
}

async function fetchRows(table, params, supabaseUrl, supabaseAnonKey) {
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

async function fetchPostListings(supabaseUrl, supabaseAnonKey) {
  const select = 'id,type,status,updated_at,reviewed_at,created_at,title,name,description,location,image_url,cover_image_url,thumbnail_url,gallery_images,price';
  try {
    return await fetchRows('posts', {
      select,
      status: `in.(${PUBLIC_STATUSES.join(',')})`,
      order: 'updated_at.desc.nullslast',
      limit: '5000',
    }, supabaseUrl, supabaseAnonKey);
  } catch {
    return fetchRows('posts', {
      select: 'id,type,status,created_at,title,name,description,location,image_url,cover_image_url,thumbnail_url,gallery_images,price',
      status: `in.(${PUBLIC_STATUSES.join(',')})`,
      order: 'created_at.desc.nullslast',
      limit: '5000',
    }, supabaseUrl, supabaseAnonKey);
  }
}

async function fetchLegacyListings(table, supabaseUrl, supabaseAnonKey) {
  const select = 'id,status,updated_at,created_at,title,name,description,location,image_url,cover_image_url,thumbnail_url,gallery_images,price';
  try {
    return await fetchRows(table, {
      select,
      status: `in.(${PUBLIC_STATUSES.join(',')})`,
      order: 'updated_at.desc.nullslast',
      limit: '5000',
    }, supabaseUrl, supabaseAnonKey);
  } catch {
    try {
      return await fetchRows(table, {
        select: 'id,status,created_at,title,name,description,location,image_url,price',
        status: `in.(${PUBLIC_STATUSES.join(',')})`,
        order: 'created_at.desc.nullslast',
        limit: '5000',
      }, supabaseUrl, supabaseAnonKey);
    } catch {
      return fetchRows(table, {
        select: 'id,created_at,title,name,description,location,image_url,price',
        order: 'created_at.desc.nullslast',
        limit: '5000',
      }, supabaseUrl, supabaseAnonKey);
    }
  }
}

function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function stripHtml(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
}

function capitalize(value) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function cleanUrl(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
}

function cleanGallery(value) {
  if (Array.isArray(value)) {
    return value.map(cleanUrl).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(cleanUrl).filter(Boolean);
      }
    } catch {
      return [trimmed];
    }
    return [trimmed];
  }

  return [];
}

function getPrimaryListingImage(row) {
  const candidates = [
    cleanUrl(row?.image_url),
    ...cleanGallery(row?.gallery_images),
    cleanUrl(row?.cover_image_url),
    cleanUrl(row?.thumbnail_url),
  ].filter(Boolean);
  return Array.from(new Set(candidates))[0] || DEFAULT_IMAGE_PATH;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
