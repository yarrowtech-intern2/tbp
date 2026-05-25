const DICEBEAR_BASE_URL = 'https://api.dicebear.com/9.x/notionists-neutral/svg';
const DEFAULT_AVATAR_SEED = 'tbp-member';

const cleanText = (value?: string | null) => value?.trim() || '';

export const getAvatarSeed = (...values: Array<string | null | undefined>) => (
    values.map(cleanText).find(Boolean) || DEFAULT_AVATAR_SEED
);

export const getDiceBearAvatarUrl = (...seedValues: Array<string | null | undefined>) => {
    const params = new URLSearchParams({
        seed: getAvatarSeed(...seedValues),
        backgroundColor: 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf',
        radius: '50',
    });

    return `${DICEBEAR_BASE_URL}?${params.toString()}`;
};

export const getProfileAvatarUrl = (
    uploadedUrl?: string | null,
    ...seedValues: Array<string | null | undefined>
) => cleanText(uploadedUrl) || getDiceBearAvatarUrl(...seedValues);
