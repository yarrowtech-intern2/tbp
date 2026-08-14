import { useEffect, useState } from 'react';

export type DeviceQualityTier = 'high' | 'low';

const computeTier = (): DeviceQualityTier => {
  if (typeof window === 'undefined') return 'high';

  const isNarrow = window.matchMedia('(max-width: 900px)').matches;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const lowCores = typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number'
    ? navigator.hardwareConcurrency <= 4
    : false;

  return isNarrow || (isCoarsePointer && lowCores) ? 'low' : 'high';
};

export function useDeviceQuality(): DeviceQualityTier {
  const [tier, setTier] = useState<DeviceQualityTier>(() => computeTier());

  useEffect(() => {
    const update = () => setTier(computeTier());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return tier;
}
