import { useCallback, useLayoutEffect, useRef } from 'react';

/** Returns a callback whose identity never changes but which always runs the latest version. */
export const useStableCallback = <Args extends unknown[], Result>(callback: (...args: Args) => Result) => {
    const latest = useRef(callback);
    useLayoutEffect(() => {
        latest.current = callback;
    });
    return useCallback((...args: Args) => latest.current(...args), []);
};
