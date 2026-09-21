import type { MarketPriceInsight } from './marketPricing';
import type { ListingType } from './platform';

type OllamaTagsResponse = {
    models?: Array<{ name?: string; model?: string }>;
};

type OllamaGenerateResponse = {
    response?: string;
};

export type OllamaPricingInput = {
    listingType: ListingType;
    title?: string | null;
    location?: string | null;
    category?: string | null;
    description?: string | null;
    insight: MarketPriceInsight;
};

const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const OLLAMA_TIMEOUT_MS = 7000;
const OLLAMA_FALLBACK_MODELS = ['llama3.1', 'llama3', 'mistral', 'gemma2', 'gemma'];

const fetchWithTimeout = async (url: string, options: RequestInit = {}) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
        });
    } finally {
        window.clearTimeout(timeout);
    }
};

const getInstalledOllamaModel = async (): Promise<string> => {
    try {
        const response = await fetchWithTimeout(`${OLLAMA_BASE_URL}/api/tags`);
        if (!response.ok) return OLLAMA_FALLBACK_MODELS[0];
        const payload = await response.json() as OllamaTagsResponse;
        const model = payload.models?.find((item) => item.name || item.model);
        return model?.name || model?.model || OLLAMA_FALLBACK_MODELS[0];
    } catch {
        return OLLAMA_FALLBACK_MODELS[0];
    }
};

const buildPrompt = (input: OllamaPricingInput): string => {
    const { insight } = input;
    const examples = insight.similarTrips.map((trip) => (
        `${trip.title} in ${trip.location}: Rs ${trip.providerPrice}`
    )).join('; ');

    return [
        'You are a pricing assistant for verified travel marketplace vendors.',
        'Write one concise vendor-facing pricing note in plain English.',
        'Use INR amounts exactly as provided. Do not invent external sources.',
        'Keep it under 55 words and include one practical improvement tip.',
        '',
        `Listing type: ${input.listingType}`,
        `Title: ${input.title || 'Untitled'}`,
        `Location: ${input.location || 'Not provided'}`,
        `Category: ${input.category || 'Not provided'}`,
        `Status: ${insight.statusLabel}`,
        `Current vendor price: Rs ${insight.currentProviderPrice}`,
        `Current tourist price: Rs ${insight.currentTouristPrice}`,
        `Market average vendor price: Rs ${insight.marketAverageProviderPrice}`,
        `Suggested vendor price: Rs ${insight.suggestedProviderPrice}`,
        `Difference: ${insight.differencePercent}%`,
        `Comparables: ${examples || 'global benchmark ranges only'}`,
    ].join('\n');
};

export const generateOllamaPricingNote = async (input: OllamaPricingInput): Promise<string | null> => {
    const model = await getInstalledOllamaModel();
    const response = await fetchWithTimeout(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            prompt: buildPrompt(input),
            stream: false,
            options: {
                temperature: 0.2,
                num_predict: 90,
            },
        }),
    });

    if (!response.ok) return null;
    const payload = await response.json() as OllamaGenerateResponse;
    const note = payload.response?.trim();
    return note || null;
};
