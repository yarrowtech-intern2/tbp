export const PLATFORM_FEE_RATE = 0.15;

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const normalizePeople = (value: number): number => {
    if (!Number.isFinite(value) || value <= 0) return 1;
    return Math.max(1, Math.floor(value));
};

const normalizeAmount = (value: number): number => {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return roundMoney(value);
};

export interface PricingBreakdown {
    provider_unit_price: number;
    tourist_unit_price: number;
    number_of_people: number;
    provider_subtotal: number;
    platform_fee_rate: number;
    platform_fee_amount: number;
    total_price: number;
    provider_payout_amount: number;
}

export const calculatePricingFromProviderUnit = (
    providerUnitPrice: number,
    peopleCount = 1,
    feeRate = PLATFORM_FEE_RATE
): PricingBreakdown => {
    const providerUnit = normalizeAmount(providerUnitPrice);
    const people = normalizePeople(peopleCount);
    const rate = Number.isFinite(feeRate) && feeRate >= 0 ? feeRate : PLATFORM_FEE_RATE;
    const touristUnit = roundMoney(providerUnit * (1 + rate));
    const providerSubtotal = roundMoney(providerUnit * people);
    const totalPrice = roundMoney(touristUnit * people);
    const platformFeeAmount = roundMoney(totalPrice - providerSubtotal);

    return {
        provider_unit_price: providerUnit,
        tourist_unit_price: touristUnit,
        number_of_people: people,
        provider_subtotal: providerSubtotal,
        platform_fee_rate: rate,
        platform_fee_amount: platformFeeAmount,
        total_price: totalPrice,
        provider_payout_amount: providerSubtotal,
    };
};

export const deriveBookingAmounts = (args: {
    unitPrice: number;
    totalPrice: number;
    numberOfPeople: number;
    platformFeeRate?: number | null;
    platformFeeAmount?: number | null;
    providerPayoutAmount?: number | null;
}) => {
    const people = normalizePeople(args.numberOfPeople);
    const unit = normalizeAmount(args.unitPrice);
    const total = normalizeAmount(args.totalPrice);
    const providerSubtotal = unit > 0 ? roundMoney(unit * people) : 0;
    const fallbackRate = Number.isFinite(args.platformFeeRate) && (args.platformFeeRate as number) >= 0
        ? (args.platformFeeRate as number)
        : PLATFORM_FEE_RATE;
    const fallbackFromUnit = calculatePricingFromProviderUnit(unit, people, fallbackRate);
    const effectiveTotal = total > 0 ? total : fallbackFromUnit.total_price;

    const providerPayout = normalizeAmount(args.providerPayoutAmount ?? 0) || providerSubtotal || fallbackFromUnit.provider_payout_amount;
    const platformFee = normalizeAmount(args.platformFeeAmount ?? 0) || roundMoney(Math.max(0, effectiveTotal - providerPayout));
    const effectiveRate = providerPayout > 0
        ? platformFee / providerPayout
        : fallbackFromUnit.platform_fee_rate;
    const touristUnit = people > 0 ? roundMoney(effectiveTotal / people) : fallbackFromUnit.tourist_unit_price;

    return {
        provider_unit_price: unit || fallbackFromUnit.provider_unit_price,
        tourist_unit_price: touristUnit,
        number_of_people: people,
        provider_subtotal: providerPayout,
        platform_fee_rate: effectiveRate,
        platform_fee_amount: platformFee,
        total_price: effectiveTotal,
        provider_payout_amount: providerPayout,
    };
};
