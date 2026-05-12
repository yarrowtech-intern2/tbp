export type PromotionPlanKey = 'week' | 'month' | 'half_year';

export interface PromotionPlanDefinition {
    key: PromotionPlanKey;
    label: string;
    durationDays: number;
    amount: number;
}

export const PROMOTION_PLAN_MAP: Record<PromotionPlanKey, PromotionPlanDefinition> = {
    week: {
        key: 'week',
        label: '1 Week',
        durationDays: 7,
        amount: 299,
    },
    month: {
        key: 'month',
        label: '1 Month',
        durationDays: 30,
        amount: 1199,
    },
    half_year: {
        key: 'half_year',
        label: '6 Months',
        durationDays: 180,
        amount: 6999,
    },
};

export const PROMOTION_PLAN_LIST = Object.values(PROMOTION_PLAN_MAP);

export const getPromotionPlan = (key: PromotionPlanKey): PromotionPlanDefinition => PROMOTION_PLAN_MAP[key];

export const isPromotionWindowActive = (
    startsAt?: string | null,
    endsAt?: string | null,
    referenceTime = Date.now(),
): boolean => {
    if (!startsAt || !endsAt) return false;
    const start = new Date(startsAt).getTime();
    const end = new Date(endsAt).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) return false;
    return start <= referenceTime && end >= referenceTime;
};

export const getPromotionWindow = (
    planKey: PromotionPlanKey,
    startDate = new Date(),
): { startsAt: string; endsAt: string; durationDays: number } => {
    const startsAt = new Date(startDate);
    const endsAt = new Date(startDate);

    if (planKey === 'week') {
        endsAt.setUTCDate(endsAt.getUTCDate() + 7);
    } else if (planKey === 'month') {
        endsAt.setUTCMonth(endsAt.getUTCMonth() + 1);
    } else {
        endsAt.setUTCMonth(endsAt.getUTCMonth() + 6);
    }

    const durationDays = Math.max(
        1,
        Math.round((endsAt.getTime() - startsAt.getTime()) / 86400000),
    );

    return {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        durationDays,
    };
};
