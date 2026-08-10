import React, { useEffect, useRef, useState } from 'react';
import './macbook-scroll.css';

const KEY_ROWS = [
  ['esc', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', 'o'],
  ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'del'],
  ['tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
  ['caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', '\'', 'ret', 'ret2'],
  ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'shift2', 'up', 'shift3'],
  ['fn', 'ctrl', 'opt', 'cmd', 'space', 'cmd2', 'opt2', 'left', 'down', 'right', 'blank1'],
] as const;

type MacbookCssVars = React.CSSProperties & Record<`--${string}`, string>;

const clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getMacbookVars = (progress: number, isMobile: boolean): MacbookCssVars => {
  const lidProgress = clampValue(progress / 0.34, 0, 1);
  const dissolveProgress = clampValue((progress - 0.7) / 0.22, 0, 1);

  return {
    '--macbook-lid-rotate': `${-9 + (9 * lidProgress)}deg`,
    '--macbook-scale-x': String(isMobile ? 0.98 + (0.02 * lidProgress) : 1 + (0.08 * lidProgress)),
    '--macbook-scale-y': String(isMobile ? 0.96 + (0.04 * lidProgress) : 0.94 + (0.08 * lidProgress)),
    '--macbook-lid-offset': `${160 * progress}px`,
    '--macbook-device-offset': `${-32 + (20 * progress)}px`,
    '--macbook-text-offset': `${96 * clampValue(progress / 0.24, 0, 1)}px`,
    '--macbook-text-opacity': String(1 - clampValue(progress / 0.2, 0, 1)),
    '--macbook-screen-scale': String(1 + (0.08 * dissolveProgress)),
    '--macbook-screen-lift': `${-42 * dissolveProgress}px`,
    '--macbook-chassis-opacity': String(1 - dissolveProgress),
    '--macbook-bezel-opacity': String(1 - dissolveProgress),
    '--macbook-screen-radius': `${20 - (8 * dissolveProgress)}px`,
  };
};

const applyMacbookVars = (node: HTMLElement, progress: number, isMobile: boolean) => {
  const vars = getMacbookVars(progress, isMobile);
  Object.entries(vars).forEach(([property, value]) => {
    node.style.setProperty(property, value);
  });
};

const getKeyClassName = (value: string) => {
  if (value === 'space') return 'macbook-scroll-key is-space';
  if (value === 'up' || value === 'left' || value === 'down' || value === 'right') {
    return 'macbook-scroll-key is-arrow';
  }
  return 'macbook-scroll-key';
};

const renderKeyLabel = (value: string) => {
  if (value === 'up') return '^';
  if (value === 'left') return '<';
  if (value === 'down') return 'v';
  if (value === 'right') return '>';
  if (value === 'space') return '';
  if (value === 'ret') return 'return';
  if (value === 'ret2') return 'return';
  if (value === 'del') return 'delete';
  if (value === 'shift2' || value === 'shift3') return 'shift';
  if (value === 'cmd2') return 'cmd';
  if (value === 'opt2') return 'opt';
  if (value.startsWith('blank')) return '';
  return value;
};

type MacbookScrollProps = {
  src?: string;
  srcSet?: string;
  sizes?: string;
  showGradient?: boolean;
  title?: React.ReactNode;
  badge?: React.ReactNode;
};

export const MacbookScroll: React.FC<MacbookScrollProps> = ({
  src = 'https://res.cloudinary.com/dc3qprub3/image/upload/v1780906443/Screenshot_2026-06-08_134329_hfhfau.png',
  srcSet,
  sizes = '(max-width: 768px) 88vw, 36rem',
  showGradient = false,
  title,
  badge,
}) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const progressRef = useRef(0);
  const isMobileRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    const updateViewportMode = () => {
      const nextIsMobile = window.innerWidth < 768;
      isMobileRef.current = nextIsMobile;
      setIsMobile(nextIsMobile);
      if (sectionRef.current) {
        applyMacbookVars(sectionRef.current, progressRef.current, nextIsMobile);
      }
    };

    updateViewportMode();
    window.addEventListener('resize', updateViewportMode);

    return () => {
      window.removeEventListener('resize', updateViewportMode);
    };
  }, []);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setIsNearViewport(entry.isIntersecting);
      },
      { rootMargin: '28% 0px', threshold: 0.01 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isNearViewport) return undefined;

    let frame = 0;

    const updateProgress = () => {
      frame = 0;
      const node = sectionRef.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const scrollableDistance = Math.max(rect.height - viewportHeight, 1);
      const nextProgress = clampValue((-rect.top) / scrollableDistance, 0, 1);

      if (Math.abs(progressRef.current - nextProgress) <= 0.001) return;

      progressRef.current = nextProgress;
      applyMacbookVars(node, nextProgress, isMobileRef.current);
    };

    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isNearViewport]);

  return (
    <section
      ref={sectionRef}
      className="macbook-scroll-section"
      style={getMacbookVars(0, isMobile)}
    >
      <div className="macbook-scroll-sticky">
        <div className="macbook-scroll-shell">
          <h2 className="macbook-scroll-title">
            {title || (
              <>
                This Macbook is built with Tailwindcss.
                <br />
                No kidding.
              </>
            )}
          </h2>

          <div className="macbook-scroll-device-wrap">
            <div className="macbook-scroll-floor" aria-hidden="true" />

            <div className="macbook-scroll-device">
              <div className="macbook-scroll-image-wrap">
                <img
                  src={src}
                  srcSet={srcSet}
                  sizes={sizes}
                  alt="Betterpass platform preview"
                  loading="eager"
                  decoding="sync"
                  fetchPriority="high"
                  className="macbook-scroll-hero-img"
                />
              </div>

              <div className="macbook-scroll-base" aria-hidden="true">
                <div className="macbook-scroll-hinge" />

                <div className="macbook-scroll-deck">
                  <div className="macbook-scroll-speaker" />

                  <div className="macbook-scroll-keyboard">
                    {KEY_ROWS.map((row, rowIndex) => (
                      <div key={`row-${rowIndex}`} className="macbook-scroll-key-row">
                        {row.map((key, keyIndex) => (
                          <span key={`${rowIndex}-${key}-${keyIndex}`} className={getKeyClassName(key)}>
                            {renderKeyLabel(key)}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="macbook-scroll-speaker" />
                </div>

                <div className="macbook-scroll-trackpad" />
                <div className="macbook-scroll-notch" />

                {badge ? <div className="macbook-scroll-badge">{badge}</div> : null}
                {showGradient ? <div className="macbook-scroll-gradient" /> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
