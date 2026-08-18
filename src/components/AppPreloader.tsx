import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnimationItem } from 'lottie-web';
import './AppPreloader.css';

const LOADER_ANIMATION_URL = '/loader/loader-animation.json';
const LOADER_DOTLOTTIE_URL = '/loader/loader-animation.lottie';
const CLOUD_TEXTURE_URLS = ['/images/cloud-1.png', '/images/cloud-2.png', '/images/cloud-3.png'];
const MIN_VISIBLE_MS = 550;
const EXIT_MS = 950;
const MESSAGE_INTERVAL_MS = 1900;
// Bumped only if the preload flow changes shape enough that a stale flag
// from an older build could skip a curtain that's now doing something new.
const SESSION_FLAG_KEY = 'bp:hero-preload-ready:v1';

type AppPreloaderProps = {
  children: React.ReactNode;
};

type MessageStage = {
  minProgress: number;
  messages: string[];
};

// Ordered low -> high; pickMessage walks it in reverse to find the highest
// stage the current progress has reached.
const MESSAGE_STAGES: MessageStage[] = [
  { minProgress: 0, messages: ['Setting the scene', 'Warming up your journey', 'Getting everything ready'] },
  { minProgress: 35, messages: ['Loading the world', 'Bringing the scenery to life', 'Placing the last details'] },
  { minProgress: 70, messages: ['Almost there', 'Just a little longer', 'So close now'] },
  { minProgress: 92, messages: ['Please wait a bit', 'Thanks for your patience', 'Wrapping things up'] },
];

const pickMessage = (progress: number, previous: string) => {
  const stage = [...MESSAGE_STAGES].reverse().find((entry) => progress >= entry.minProgress) ?? MESSAGE_STAGES[0];
  const candidates = stage.messages.filter((message) => message !== previous);
  const pool = candidates.length > 0 ? candidates : stage.messages;
  return pool[Math.floor(Math.random() * pool.length)];
};

const wait = (ms: number) => new Promise((resolve) => {
  window.setTimeout(resolve, ms);
});

const preloadImage = (url: string) => new Promise<void>((resolve) => {
  const image = new Image();
  image.onload = () => resolve();
  image.onerror = () => resolve();
  image.decoding = 'async';
  image.src = url;
});

const fetchWarmCache = async (url: string) => {
  try {
    await fetch(url, { cache: 'force-cache' });
  } catch {
    // Non-blocking: the actual component will retry through its own loader.
  }
};

const loadCinematicAssets = async () => {
  await Promise.allSettled([
    import('./cinematic-hero/preloadRoomModelStage').then(({ preloadRoomModelStage }) => preloadRoomModelStage()),
    import('./cinematic-hero/CinematicHero'),
    import('../pages/Home5'),
    fetchWarmCache(LOADER_DOTLOTTIE_URL),
    ...CLOUD_TEXTURE_URLS.map(preloadImage),
  ]);
};

const readSessionFlag = () => {
  try {
    return sessionStorage.getItem(SESSION_FLAG_KEY) === '1';
  } catch {
    return false;
  }
};

const writeSessionFlag = () => {
  try {
    sessionStorage.setItem(SESSION_FLAG_KEY, '1');
  } catch {
    // Private browsing / storage disabled: the curtain will just show again.
  }
};

export const AppPreloader: React.FC<AppPreloaderProps> = ({ children }) => {
  // AppPreloader sits above the Router and only ever mounts once per hard
  // page load, so this path check reflects the entry route for this load —
  // it intentionally does not react to client-side navigation afterward.
  const shouldPreloadCinematic = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname;
    return path === '/' || path === '/home5';
  }, []);

  // The curtain exists to cover the 3D room model + hero imagery loading in,
  // so only the routes that actually need those assets show it, and only
  // once per browser session — a refresh within the same tab already has
  // everything warm in the HTTP cache and doesn't need to wait again.
  const shouldShowOverlay = useMemo(
    () => shouldPreloadCinematic && !readSessionFlag(),
    [shouldPreloadCinematic],
  );

  const [animationData, setAnimationData] = useState<Record<string, unknown> | null>(null);
  const [targetProgress, setTargetProgress] = useState(8);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isMounted, setIsMounted] = useState(shouldShowOverlay);
  const [message, setMessage] = useState(() => pickMessage(0, ''));
  const hasCompletedRef = useRef(false);
  const displayProgressRef = useRef(0);
  const animationContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    displayProgressRef.current = displayProgress;
  }, [displayProgress]);

  useEffect(() => {
    // Overlay skipped (repeat visit this session, or a non-cinematic route):
    // still warm the cinematic chunk/model/textures quietly in the
    // background so the hero section never has to fetch them on scroll-in.
    if (shouldShowOverlay || !shouldPreloadCinematic) return undefined;
    void loadCinematicAssets();
    return undefined;
  }, [shouldShowOverlay, shouldPreloadCinematic]);

  useEffect(() => {
    if (!shouldShowOverlay) return undefined;
    let cancelled = false;

    const run = async () => {
      const started = performance.now();
      setTargetProgress(18);

      const animationPromise = fetch(LOADER_ANIMATION_URL)
        .then((response) => response.json())
        .then((data) => {
          if (!cancelled) {
            setAnimationData(data);
            setTargetProgress(42);
          }
        })
        .catch(() => {
          if (!cancelled) setTargetProgress(42);
        });

      const preloadPromise = loadCinematicAssets();

      await animationPromise;
      if (!cancelled) setTargetProgress(64);

      await preloadPromise;
      const elapsed = performance.now() - started;
      if (elapsed < MIN_VISIBLE_MS) {
        await wait(MIN_VISIBLE_MS - elapsed);
      }

      if (!cancelled) {
        hasCompletedRef.current = true;
        setTargetProgress(100);
        writeSessionFlag();
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [shouldShowOverlay]);

  useEffect(() => {
    if (!isMounted) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted) return undefined;
    const container = animationContainerRef.current;
    if (!container || !animationData) return undefined;

    let animation: AnimationItem | null = null;
    let cancelled = false;

    void import('lottie-web/build/player/lottie_light_canvas')
      .then(({ default: lottie }) => {
        if (cancelled) return;
        animation = lottie.loadAnimation({
          container,
          renderer: 'canvas',
          loop: true,
          autoplay: true,
          animationData,
        });
      })
      .catch(() => {
        // The fallback spinner remains visible if the player cannot load.
      });

    return () => {
      cancelled = true;
      animation?.destroy();
    };
  }, [animationData, isMounted]);

  useEffect(() => {
    if (!isMounted) return undefined;
    let frame = 0;

    const tick = () => {
      setDisplayProgress((current) => {
        const next = current + (targetProgress - current) * 0.13;
        if (hasCompletedRef.current && next >= 98.8) {
          return 100;
        }
        return Math.min(next, hasCompletedRef.current ? 100 : 96);
      });

      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [targetProgress, isMounted]);

  useEffect(() => {
    if (!isMounted) return undefined;

    const interval = window.setInterval(() => {
      setMessage((previous) => pickMessage(displayProgressRef.current, previous));
    }, MESSAGE_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [isMounted]);

  useEffect(() => {
    if (displayProgress < 100 || isReady) return;

    const exitTimer = window.setTimeout(() => setIsReady(true), 160);

    return () => window.clearTimeout(exitTimer);
  }, [displayProgress, isReady]);

  useEffect(() => {
    if (!isReady) return;

    const removeTimer = window.setTimeout(() => setIsMounted(false), EXIT_MS + 180);

    return () => window.clearTimeout(removeTimer);
  }, [isReady]);

  return (
    <>
      {children}
      {isMounted ? (
        <div className={`app-preloader${isReady ? ' is-opening' : ''}`} role="status" aria-live="polite" aria-label="Loading Betterpass">
          <div className="app-preloader-curtain app-preloader-curtain-left" />
          <div className="app-preloader-curtain app-preloader-curtain-right" />
          <div className="app-preloader-content">
            <div ref={animationContainerRef} className="app-preloader-animation" aria-hidden="true">
              {!animationData ? (
                <span className="app-preloader-fallback" />
              ) : null}
            </div>
            <p>Loading Betterpass</p>
            <small key={message} className="app-preloader-message">{message}</small>
          </div>
          <div className="app-preloader-progress" aria-hidden="true">
            {Math.round(displayProgress)}
            <span>%</span>
          </div>
        </div>
      ) : null}
    </>
  );
};
