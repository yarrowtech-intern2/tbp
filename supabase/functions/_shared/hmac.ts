const encoder = new TextEncoder();

export const toHex = (buffer: ArrayBuffer): string => (
    Array.from(new Uint8Array(buffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
);

export const hmacSha256Hex = async (secret: string, payload: string): Promise<string> => {
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        {
            name: 'HMAC',
            hash: 'SHA-256',
        },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return toHex(signature);
};
