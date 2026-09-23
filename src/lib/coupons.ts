const COUPON_STORAGE_KEY = 'tbp:coupon-claim:v1';

export const FIRST_BOOKING_COUPON_CODE = 'FIRST20';
export const FIRST_BOOKING_COUPON_PERCENT = 20;
export const COUPON_STORAGE_EVENT = 'tbp:coupon-claim-changed';

export interface StoredCouponClaim {
    code: string;
    captured_at: string;
    source_path?: string | null;
}

export interface CouponPreview {
    code: string;
    discount_percent: number;
    original_total: number;
    discount_amount: number;
    final_total: number;
}

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const normalizeCouponCode = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    return normalized || null;
};

export const isSupportedCouponCode = (value: unknown): value is typeof FIRST_BOOKING_COUPON_CODE => (
    normalizeCouponCode(value) === FIRST_BOOKING_COUPON_CODE
);

const emitCouponStorageEvent = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event(COUPON_STORAGE_EVENT));
};

export const saveCouponClaim = (code: string, sourcePath?: string | null): StoredCouponClaim | null => {
    const normalized = normalizeCouponCode(code);
    if (!normalized || normalized !== FIRST_BOOKING_COUPON_CODE || !canUseStorage()) return null;

    const claim: StoredCouponClaim = {
        code: normalized,
        captured_at: new Date().toISOString(),
        source_path: sourcePath || null,
    };

    try {
        window.localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(claim));
        emitCouponStorageEvent();
        return claim;
    } catch {
        return null;
    }
};

export const getStoredCouponClaim = (): StoredCouponClaim | null => {
    if (!canUseStorage()) return null;
    try {
        const raw = window.localStorage.getItem(COUPON_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<StoredCouponClaim> | null;
        if (!parsed || parsed.code !== FIRST_BOOKING_COUPON_CODE) return null;
        return {
            code: parsed.code,
            captured_at: typeof parsed.captured_at === 'string' ? parsed.captured_at : new Date().toISOString(),
            source_path: typeof parsed.source_path === 'string' ? parsed.source_path : null,
        };
    } catch {
        return null;
    }
};

export const clearStoredCouponClaim = () => {
    if (!canUseStorage()) return;
    try {
        window.localStorage.removeItem(COUPON_STORAGE_KEY);
        emitCouponStorageEvent();
    } catch {
        // Ignore storage errors.
    }
};

export const getStoredCouponCode = (): string | null => getStoredCouponClaim()?.code || null;

export const captureCouponFromUrl = (search: string, sourcePath?: string | null): StoredCouponClaim | null => {
    const params = new URLSearchParams(search);
    const candidates = [
        params.get('coupon'),
        params.get('coupon_code'),
        params.get('code'),
        params.get('promo'),
        params.get('promo_code'),
    ];
    const code = candidates.find((value) => isSupportedCouponCode(value));
    return code ? saveCouponClaim(code, sourcePath) : null;
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

export const buildFirstBookingCouponPreview = (total: number): CouponPreview | null => {
    if (!Number.isFinite(total) || total <= 0) return null;
    const originalTotal = roundMoney(total);
    const discountAmount = roundMoney(originalTotal * (FIRST_BOOKING_COUPON_PERCENT / 100));
    return {
        code: FIRST_BOOKING_COUPON_CODE,
        discount_percent: FIRST_BOOKING_COUPON_PERCENT,
        original_total: originalTotal,
        discount_amount: Math.min(originalTotal, discountAmount),
        final_total: roundMoney(Math.max(0, originalTotal - discountAmount)),
    };
};
