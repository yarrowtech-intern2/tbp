import type { PostRecord } from './destinations';

const cleanUrl = (value: unknown) => (
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : ''
);

const cleanGallery = (value: unknown): string[] => {
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
};

export const getListingImages = (listing: Pick<PostRecord, 'image_url' | 'cover_image_url' | 'thumbnail_url' | 'gallery_images'>): string[] => {
    const candidates = [
        cleanUrl(listing.image_url),
        ...cleanGallery(listing.gallery_images),
        cleanUrl(listing.cover_image_url),
        cleanUrl(listing.thumbnail_url),
    ].filter(Boolean);

    return Array.from(new Set(candidates));
};

export const getPrimaryListingImage = (
    listing: Pick<PostRecord, 'image_url' | 'cover_image_url' | 'thumbnail_url' | 'gallery_images'>,
    fallback: string,
) => getListingImages(listing)[0] || fallback;
