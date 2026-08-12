import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
    BRAND_NAME,
    ROBOTS_INDEX,
    ROBOTS_NOINDEX,
    absolutizeUrl,
    buildCanonical,
    buildRouteSeo,
    getSiteUrl,
    type JsonLd,
    type SeoConfig,
} from '../lib/seo';

const upsertMetaByName = (name: string, content: string): void => {
    let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (!element) {
        element = document.createElement('meta');
        element.setAttribute('name', name);
        document.head.appendChild(element);
    }
    element.setAttribute('content', content);
};

const upsertMetaByProperty = (property: string, content: string): void => {
    let element = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
    if (!element) {
        element = document.createElement('meta');
        element.setAttribute('property', property);
        document.head.appendChild(element);
    }
    element.setAttribute('content', content);
};

const upsertLink = (rel: string, href: string): void => {
    let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!element) {
        element = document.createElement('link');
        element.setAttribute('rel', rel);
        document.head.appendChild(element);
    }
    element.setAttribute('href', href);
};

const upsertJsonLd = (jsonLd: JsonLd | undefined): void => {
    document.head.querySelectorAll('script[data-seo-jsonld="true"]').forEach((node) => node.remove());
    if (!jsonLd) return;

    const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
    items.forEach((item) => {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.dataset.seoJsonld = 'true';
        script.textContent = JSON.stringify(item);
        document.head.appendChild(script);
    });
};

export const SEOHead: React.FC<SeoConfig> = ({
    title,
    description,
    path,
    image,
    type = 'website',
    noindex = false,
    jsonLd,
}) => {
    useEffect(() => {
        const siteUrl = getSiteUrl();
        const canonical = buildCanonical(path, siteUrl);
        const absoluteImage = absolutizeUrl(image, siteUrl);
        const robots = noindex ? ROBOTS_NOINDEX : ROBOTS_INDEX;

        document.title = title;
        upsertMetaByName('description', description);
        upsertMetaByName('robots', robots);
        upsertMetaByName('googlebot', robots);
        upsertMetaByName('bingbot', robots);
        upsertMetaByName('author', BRAND_NAME);
        upsertMetaByName('application-name', BRAND_NAME);
        upsertMetaByName('apple-mobile-web-app-title', BRAND_NAME);
        upsertMetaByName('theme-color', '#0b1320');
        upsertMetaByName('twitter:card', 'summary_large_image');
        upsertMetaByName('twitter:title', title);
        upsertMetaByName('twitter:description', description);
        upsertMetaByName('twitter:image', absoluteImage);
        upsertMetaByName('twitter:image:alt', `${BRAND_NAME} travel discovery platform`);
        upsertMetaByProperty('og:site_name', BRAND_NAME);
        upsertMetaByProperty('og:type', type);
        upsertMetaByProperty('og:title', title);
        upsertMetaByProperty('og:description', description);
        upsertMetaByProperty('og:url', canonical);
        upsertMetaByProperty('og:image', absoluteImage);
        upsertMetaByProperty('og:image:alt', `${BRAND_NAME} travel discovery platform`);
        upsertMetaByProperty('og:image:width', '1200');
        upsertMetaByProperty('og:image:height', '630');
        upsertMetaByProperty('og:locale', 'en_IN');
        upsertLink('canonical', canonical);
        upsertJsonLd(jsonLd);
    }, [description, image, jsonLd, noindex, path, title, type]);

    return null;
};

export const AppSEO: React.FC = () => {
    const location = useLocation();
    const seo = useMemo(() => buildRouteSeo(location.pathname), [location.pathname]);
    return <SEOHead {...seo} />;
};
