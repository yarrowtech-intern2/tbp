import { Capacitor } from '@capacitor/core';

export const NATIVE_APP_SCHEME = 'com.tbp.app';
export const NATIVE_AUTH_HOST = 'auth';
export const NATIVE_AUTH_CALLBACK_PATH = '/callback';
export const DEFAULT_NATIVE_AUTH_REDIRECT_PATH = '/explore';
const APP_LINK_HOSTS = new Set(['thebetterpass.com', 'www.thebetterpass.com']);

export const isNativeApp = () => Capacitor.isNativePlatform() || Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios';

export const getNativeOAuthRedirectUrl = (nextPath = DEFAULT_NATIVE_AUTH_REDIRECT_PATH) => {
    const params = new URLSearchParams({ next: nextPath });
    return `${NATIVE_APP_SCHEME}://${NATIVE_AUTH_HOST}${NATIVE_AUTH_CALLBACK_PATH}?${params.toString()}`;
};

export const isNativeAuthCallbackUrl = (rawUrl: string) => {
    try {
        const url = new URL(rawUrl);
        return url.protocol === `${NATIVE_APP_SCHEME}:`
            && url.host === NATIVE_AUTH_HOST
            && url.pathname === NATIVE_AUTH_CALLBACK_PATH;
    } catch {
        return false;
    }
};

export const sanitizeNativeNavigationPath = (value: string | null | undefined) => {
    if (!value || !value.startsWith('/') || value.startsWith('//')) return DEFAULT_NATIVE_AUTH_REDIRECT_PATH;
    return value;
};

export const getNativeAppLinkPath = (rawUrl: string) => {
    try {
        const url = new URL(rawUrl);
        if (url.protocol !== 'https:' || !APP_LINK_HOSTS.has(url.host)) return null;
        if (!url.pathname.startsWith('/blogs')) return null;
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return null;
    }
};
