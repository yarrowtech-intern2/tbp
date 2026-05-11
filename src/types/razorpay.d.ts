export interface RazorpayPaymentSuccessResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
}

export interface RazorpayPaymentFailedResponse {
    error?: {
        code?: string;
        description?: string;
        reason?: string;
        source?: string;
        step?: string;
        metadata?: {
            order_id?: string;
            payment_id?: string;
        };
    };
}

export interface RazorpayCheckoutOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description?: string;
    order_id: string;
    prefill?: {
        name?: string;
        email?: string;
        contact?: string;
    };
    notes?: Record<string, string>;
    theme?: {
        color?: string;
    };
    modal?: {
        ondismiss?: () => void;
    };
    handler: (response: RazorpayPaymentSuccessResponse) => void;
}

export interface RazorpayNativeCheckoutOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description?: string;
    order_id: string;
    prefill?: {
        name?: string;
        email?: string;
        contact?: string;
    };
    notes?: Record<string, string>;
    theme?: {
        color?: string;
    };
}

export interface RazorpayInstance {
    open(): void;
    on(
        event: 'payment.failed',
        handler: (response: RazorpayPaymentFailedResponse) => void
    ): void;
}

export interface RazorpayConstructor {
    new (options: RazorpayCheckoutOptions): RazorpayInstance;
}

export interface RazorpayNativeCheckout {
    open(
        options: RazorpayNativeCheckoutOptions,
        successCallback: (response: RazorpayPaymentSuccessResponse) => void,
        errorCallback: (response: RazorpayPaymentFailedResponse | { description?: string; reason?: string; code?: string }) => void
    ): void;
}

declare global {
    interface Window {
        Razorpay?: RazorpayConstructor;
        RazorpayCheckout?: RazorpayNativeCheckout;
        cordova?: {
            plugins?: {
                RazorpayCheckout?: RazorpayNativeCheckout;
            };
        };
    }
}
