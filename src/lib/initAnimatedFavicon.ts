import lottie from 'lottie-web';

const FAVICON_ANIMATION_PATH = '/favicon/favicon.json';
const FAVICON_SIZE = 64;
const FRAME_SAMPLE_RATE = 2;
const INIT_FLAG = '__tbpAnimatedFaviconInitialized__';

const getOrCreateFaviconLink = (): HTMLLinkElement => {
  const existing = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (existing) {
    return existing;
  }

  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  document.head.appendChild(link);
  return link;
};

export const initAnimatedFavicon = (): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const globalWindow = window as Window & { [INIT_FLAG]?: boolean };
  if (globalWindow[INIT_FLAG]) {
    return;
  }
  globalWindow[INIT_FLAG] = true;

  const faviconLink = getOrCreateFaviconLink();

  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.position = 'fixed';
  container.style.width = `${FAVICON_SIZE}px`;
  container.style.height = `${FAVICON_SIZE}px`;
  container.style.pointerEvents = 'none';
  container.style.opacity = '0';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  document.body.appendChild(container);

  let sampledFrameCount = 0;
  const animation = lottie.loadAnimation({
    container,
    renderer: 'canvas',
    loop: true,
    autoplay: true,
    path: FAVICON_ANIMATION_PATH,
    rendererSettings: {
      clearCanvas: true,
      preserveAspectRatio: 'xMidYMid meet',
    },
  });

  const updateFaviconFromCanvas = (): void => {
    const canvas = container.querySelector('canvas');
    if (!canvas) {
      return;
    }

    faviconLink.type = 'image/png';
    faviconLink.href = canvas.toDataURL('image/png');
  };

  animation.addEventListener('DOMLoaded', updateFaviconFromCanvas);
  animation.addEventListener('enterFrame', () => {
    sampledFrameCount += 1;
    if (sampledFrameCount % FRAME_SAMPLE_RATE === 0) {
      updateFaviconFromCanvas();
    }
  });

  window.addEventListener(
    'beforeunload',
    () => {
      animation.destroy();
      container.remove();
    },
    { once: true },
  );
};
