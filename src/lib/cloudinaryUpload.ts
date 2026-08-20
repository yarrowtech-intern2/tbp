const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() || '';
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() || '';
const CLOUDINARY_UPLOAD_FOLDER = import.meta.env.VITE_CLOUDINARY_UPLOAD_FOLDER?.trim() || '';
const CLOUDINARY_MAX_IMAGE_WIDTH = 1600;
const CLOUDINARY_WEBP_QUALITY = 0.78;

type CloudinaryUploadResponse = {
    secure_url?: string;
    url?: string;
    error?: {
        message?: string;
    };
};

type CloudinaryImageUploadOptions = {
    folder?: string;
    fileNamePrefix?: string;
    tags?: string[];
};

type CloudinaryVideoUploadOptions = CloudinaryImageUploadOptions;

const getImageElement = (file: File): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
        URL.revokeObjectURL(imageUrl);
        resolve(image);
    };
    image.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        reject(new Error('Could not read the selected image.'));
    };
    image.src = imageUrl;
});

const getBaseFileName = (fileName: string) => {
    const withoutExtension = fileName.replace(/\.[^/.]+$/, '');
    const normalized = withoutExtension
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || 'image';
};

export const getCloudinarySetupError = () => {
    if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET) return '';
    return 'Cloudinary is not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to your environment.';
};

export const compressImageToWebp = async (file: File): Promise<File> => {
    const image = await getImageElement(file);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) {
        throw new Error('Could not read the selected image dimensions.');
    }

    const scale = Math.min(1, CLOUDINARY_MAX_IMAGE_WIDTH / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Image compression is not supported in this browser.');
    }

    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
            if (result) {
                resolve(result);
            } else {
                reject(new Error('Could not compress the selected image.'));
            }
        }, 'image/webp', CLOUDINARY_WEBP_QUALITY);
    });

    return new File([blob], `${getBaseFileName(file.name)}.webp`, {
        type: 'image/webp',
        lastModified: Date.now(),
    });
};

export const uploadCloudinaryImage = async (
    file: File,
    options: CloudinaryImageUploadOptions = {},
): Promise<string> => {
    const setupError = getCloudinarySetupError();
    if (setupError) throw new Error(setupError);

    const compressedFile = await compressImageToWebp(file);
    const payload = new FormData();
    const folder = [CLOUDINARY_UPLOAD_FOLDER, options.folder].filter(Boolean).join('/');
    payload.append('file', compressedFile);
    payload.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    if (folder) payload.append('folder', folder);
    if (options.fileNamePrefix) {
        payload.append('public_id', `${options.fileNamePrefix}-${Date.now()}`);
    }
    if (options.tags?.length) {
        payload.append('tags', options.tags.join(','));
    }

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: payload,
    });
    const data = await response.json().catch(() => null) as CloudinaryUploadResponse | null;
    if (!response.ok) {
        throw new Error(data?.error?.message || 'Cloudinary upload failed. Check your cloud name and unsigned upload preset.');
    }

    const uploadedUrl = data?.secure_url || data?.url || '';
    if (!uploadedUrl) {
        throw new Error('Cloudinary upload completed but did not return an image URL.');
    }

    return uploadedUrl;
};

export const uploadCloudinaryVideo = async (
    file: File,
    options: CloudinaryVideoUploadOptions = {},
): Promise<string> => {
    const setupError = getCloudinarySetupError();
    if (setupError) throw new Error(setupError);

    const payload = new FormData();
    const folder = [CLOUDINARY_UPLOAD_FOLDER, options.folder].filter(Boolean).join('/');
    payload.append('file', file);
    payload.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    if (folder) payload.append('folder', folder);
    if (options.fileNamePrefix) {
        payload.append('public_id', `${options.fileNamePrefix}-${Date.now()}`);
    }
    if (options.tags?.length) {
        payload.append('tags', options.tags.join(','));
    }

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, {
        method: 'POST',
        body: payload,
    });
    const data = await response.json().catch(() => null) as CloudinaryUploadResponse | null;
    if (!response.ok) {
        throw new Error(data?.error?.message || 'Cloudinary video upload failed. Check your unsigned upload preset.');
    }

    const uploadedUrl = data?.secure_url || data?.url || '';
    if (!uploadedUrl) {
        throw new Error('Cloudinary upload completed but did not return a video URL.');
    }

    return uploadedUrl;
};
