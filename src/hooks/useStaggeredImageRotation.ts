import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';

const getResponsiveColumnCount = () => {
    if (typeof window === 'undefined') return 4;
    const width = window.innerWidth;
    if (width >= 1180) return 4;
    if (width >= 860) return 3;
    if (width >= 640) return 2;
    return 1;
};

export const useStaggeredImageRotation = ({
    imageCount,
    cardIndex,
    paused,
    stepDelayMs = 420,
    cyclePauseMs = 3200,
}: {
    imageCount: number;
    cardIndex: number;
    paused: boolean;
    stepDelayMs?: number;
    cyclePauseMs?: number;
}) => {
    const [activeImageIndex, setActiveImageIndexState] = useState(0);
    const [previousImageIndex, setPreviousImageIndex] = useState(0);
    const [transitionKey, setTransitionKey] = useState(0);
    const [columnCount, setColumnCount] = useState(getResponsiveColumnCount);
    const activeImageIndexRef = useRef(0);

    useEffect(() => {
        const handleResize = () => setColumnCount(getResponsiveColumnCount());
        window.addEventListener('resize', handleResize, { passive: true });
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        activeImageIndexRef.current = activeImageIndex;
    }, [activeImageIndex]);

    useEffect(() => {
        setActiveImageIndexState(0);
        setPreviousImageIndex(0);
        activeImageIndexRef.current = 0;
        setTransitionKey((current) => current + 1);
    }, [imageCount]);

    const setActiveImageIndex = useCallback((nextValue: SetStateAction<number>) => {
        if (imageCount <= 0) return;
        const current = activeImageIndexRef.current;
        const rawNext = typeof nextValue === 'function'
            ? (nextValue as (value: number) => number)(current)
            : nextValue;
        const next = ((rawNext % imageCount) + imageCount) % imageCount;
        setPreviousImageIndex(current);
        activeImageIndexRef.current = next;
        setActiveImageIndexState(next);
        setTransitionKey((current) => current + 1);
    }, [imageCount]);

    useEffect(() => {
        if (paused || imageCount <= 0) return undefined;

        const rowPosition = ((cardIndex % columnCount) + columnCount) % columnCount;
        const cycleMs = cyclePauseMs + columnCount * stepDelayMs;
        let intervalId: number | undefined;

        const advance = () => {
            const current = activeImageIndexRef.current;
            const next = imageCount > 1 ? (current + 1) % imageCount : current;
            setPreviousImageIndex(current);
            activeImageIndexRef.current = next;
            setActiveImageIndexState(next);
            setTransitionKey((current) => current + 1);
        };

        const timeoutId = window.setTimeout(() => {
            advance();
            intervalId = window.setInterval(advance, cycleMs);
        }, 700 + rowPosition * stepDelayMs);

        return () => {
            window.clearTimeout(timeoutId);
            if (intervalId) window.clearInterval(intervalId);
        };
    }, [cardIndex, columnCount, cyclePauseMs, imageCount, paused, stepDelayMs]);

    return { activeImageIndex, previousImageIndex, setActiveImageIndex, transitionKey };
};
