export const BRAND_NAME = 'The Better Pass';
export const DEFAULT_SITE_URL = 'https://thebetterpass.com';
export const DEFAULT_IMAGE_PATH = '/images/home4/tbp-map-1920.png';
export const DEFAULT_TITLE = 'The Better Pass | Verified Travel Discovery, Tours, Activities and Local Guides';
export const DEFAULT_DESCRIPTION = 'The Better Pass helps travelers discover verified tours, activities, local guides, destination ideas and provider-backed travel experiences in one booking-ready platform.';
export const ROBOTS_INDEX = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
export const ROBOTS_NOINDEX = 'noindex, nofollow, noarchive';

const PRIVATE_ROUTE_PREFIXES = [
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

const NOINDEX_ROUTE_META: Record<string, Pick<SeoConfig, 'title' | 'description'>> = {
    '/about-final': {
        title: 'About Preview | The Better Pass',
        description: 'Preview version of The Better Pass about page.',
    },
    '/whomadeit': {
        title: 'Credits | The Better Pass',
        description: 'Project credits for The Better Pass.',
    },
};

export type JsonLd = Record<string, unknown> | Record<string, unknown>[];

export type SeoConfig = {
    title: string;
    description: string;
    path?: string;
    image?: string;
    type?: 'website' | 'article' | 'product';
    noindex?: boolean;
    jsonLd?: JsonLd;
};

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');
const ensureHttpProtocol = (value: string): string => {
    if (/^https?:\/\//i.test(value)) return value;
    return `https://${value}`;
};

export const getSiteUrl = (): string => {
    const envUrl = import.meta.env.VITE_PUBLIC_APP_URL as string | undefined;
    const fromEnv = envUrl?.trim();
    if (fromEnv) return trimTrailingSlash(ensureHttpProtocol(fromEnv));
    if (typeof window !== 'undefined' && window.location.origin) return trimTrailingSlash(window.location.origin);
    return DEFAULT_SITE_URL;
};

export const absolutizeUrl = (value: string | undefined, siteUrl: string): string => {
    if (!value) return `${siteUrl}${DEFAULT_IMAGE_PATH}`;
    if (/^https?:\/\//i.test(value)) return value;
    return `${siteUrl}${value.startsWith('/') ? value : `/${value}`}`;
};

export const normalizePath = (value: string | undefined): string => {
    if (!value || value === '/') return '/';
    const withoutHash = value.split('#')[0] || '/';
    const withoutQuery = withoutHash.split('?')[0] || '/';
    return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
};

export const buildCanonical = (path: string | undefined, siteUrl: string): string => {
    const normalizedPath = normalizePath(path);
    return normalizedPath === '/' ? siteUrl : `${siteUrl}${normalizedPath}`;
};

export const buildOrganizationJsonLd = (siteUrl = getSiteUrl()) => ({
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
});

export const buildWebsiteJsonLd = (siteUrl = getSiteUrl()) => ({
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
});

export const buildHomeFaqJsonLd = (siteUrl = getSiteUrl()) => ({
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
});

export const buildBreadcrumbJsonLd = (path: string, title: string, siteUrl = getSiteUrl()) => {
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
            name: title.replace(/\s\|\sThe Better Pass.*$/i, ''),
            item: `${siteUrl}${normalizedPath}`,
        });
    }

    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items,
    };
};

export const buildRouteSeo = (pathname: string): SeoConfig => {
    if (pathname === '/') {
        return {
            title: DEFAULT_TITLE,
            description: DEFAULT_DESCRIPTION,
            path: '/',
            jsonLd: [
                buildOrganizationJsonLd(),
                buildWebsiteJsonLd(),
                buildHomeFaqJsonLd(),
                buildBreadcrumbJsonLd('/', DEFAULT_TITLE),
            ],
        };
    }

    if (pathname === '/about') {
        return {
            title: 'About The Better Pass | Verified Travel Ecosystem for Travelers and Providers',
            description: 'Learn how The Better Pass connects travelers, local partners, verified providers, bookings, promotions and destination discovery in one travel platform.',
            path: '/about',
            type: 'article',
            jsonLd: [
                buildOrganizationJsonLd(),
                buildBreadcrumbJsonLd('/about', 'About The Better Pass'),
            ],
        };
    }

    if (pathname === '/terms') {
        return {
            title: 'Terms and Conditions | The Better Pass',
            description: 'Read the terms for using The Better Pass, including accounts, bookings, payments, provider content, traveler conduct and platform communications.',
            path: '/terms',
            type: 'article',
            jsonLd: buildBreadcrumbJsonLd('/terms', 'Terms and Conditions'),
        };
    }

    if (pathname === '/map') {
        return {
            title: 'Travel Map | Route Planning and Destination Discovery | The Better Pass',
            description: 'Explore destination routes, nearby travel anchors and map-based planning tools for discovering places with The Better Pass.',
            path: '/map',
            jsonLd: buildBreadcrumbJsonLd('/map', 'Travel Map'),
        };
    }

    if (pathname.startsWith('/listings/')) {
        return {
            title: 'Travel Package Details | Tours, Activities and Local Guides | The Better Pass',
            description: 'View package details, traveler reviews, pricing, provider information and booking options on The Better Pass.',
            path: pathname,
            type: 'product',
            jsonLd: buildBreadcrumbJsonLd(pathname, 'Travel Package Details'),
        };
    }

    const noindexRoute = NOINDEX_ROUTE_META[pathname];
    if (noindexRoute) {
        return {
            ...noindexRoute,
            path: pathname,
            noindex: true,
        };
    }

    if (PRIVATE_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
        return {
            title: `${BRAND_NAME} | Account Area`,
            description: 'Secure account area for The Better Pass travelers, providers and administrators.',
            path: pathname,
            noindex: true,
        };
    }

    return {
        title: `${BRAND_NAME} | Travel Platform`,
        description: DEFAULT_DESCRIPTION,
        path: pathname,
        noindex: true,
    };
};

export const buildListingJsonLd = (input: {
    title: string;
    description: string;
    url: string;
    image: string;
    price?: number | null;
    currency?: string;
    location?: string;
    ratingValue?: number | null;
    reviewCount?: number;
}) => {
    const data: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'TouristTrip',
        name: input.title,
        description: input.description,
        url: input.url,
        image: input.image,
        provider: { '@id': `${getSiteUrl()}/#organization` },
    };

    if (input.location) {
        data.touristType = 'Travelers';
        data.itinerary = {
            '@type': 'Place',
            name: input.location,
        };
    }

    if (input.price && input.price > 0) {
        data.offers = {
            '@type': 'Offer',
            price: input.price,
            priceCurrency: input.currency || 'INR',
            availability: 'https://schema.org/InStock',
            url: input.url,
        };
    }

    if (input.ratingValue && input.reviewCount && input.reviewCount > 0) {
        data.aggregateRating = {
            '@type': 'AggregateRating',
            ratingValue: input.ratingValue,
            reviewCount: input.reviewCount,
            bestRating: 5,
            worstRating: 1,
        };
    }

    return [
        buildOrganizationJsonLd(),
        data,
        buildBreadcrumbJsonLd(new URL(input.url).pathname, input.title),
    ];
};
