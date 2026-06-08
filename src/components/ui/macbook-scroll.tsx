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

const clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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
  showGradient?: boolean;
  title?: React.ReactNode;
  badge?: React.ReactNode;
};

export const MacbookScroll: React.FC<MacbookScrollProps> = ({
  src = 'https://res.cloudinary.com/dc3qprub3/image/upload/v1780906443/Screenshot_2026-06-08_134329_hfhfau.png',
  showGradient = false,
  title,
  badge,
}) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const updateViewportMode = () => {
      setIsMobile(window.innerWidth < 768);
    };

    updateViewportMode();
    window.addEventListener('resize', updateViewportMode);

    return () => {
      window.removeEventListener('resize', updateViewportMode);
    };
  }, []);

  useEffect(() => {
    let frame = 0;

    const updateProgress = () => {
      frame = 0;
      const node = sectionRef.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const scrollableDistance = Math.max(rect.height - viewportHeight, 1);
      const nextProgress = clampValue((-rect.top) / scrollableDistance, 0, 1);

      setProgress((current) => (Math.abs(current - nextProgress) > 0.001 ? nextProgress : current));
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
  }, []);

  const lidProgress = clampValue(progress / 0.34, 0, 1);
  const dissolveProgress = clampValue((progress - 0.7) / 0.22, 0, 1);
  const lidRotate = `${-24 + (24 * lidProgress)}deg`;
  const scaleX = isMobile ? 0.98 + (0.03 * lidProgress) : 1.04 + (0.22 * lidProgress);
  const scaleY = isMobile ? 0.88 + (0.12 * lidProgress) : 0.72 + (0.48 * lidProgress);
  const lidOffset = `${160 * progress}px`;
  const deviceOffset = `${-32 + (20 * progress)}px`;
  const textOffset = `${96 * clampValue(progress / 0.24, 0, 1)}px`;
  const textOpacity = 1 - clampValue(progress / 0.2, 0, 1);
  const screenScale = 1 + (0.26 * dissolveProgress);
  const screenLift = `${-42 * dissolveProgress}px`;
  const chassisOpacity = 1 - dissolveProgress;
  const bezelOpacity = 1 - dissolveProgress;
  const screenRadius = `${20 - (8 * dissolveProgress)}px`;

  return (
    <section
      ref={sectionRef}
      className="macbook-scroll-section"
      style={{
        ['--macbook-lid-rotate' as string]: lidRotate,
        ['--macbook-scale-x' as string]: String(scaleX),
        ['--macbook-scale-y' as string]: String(scaleY),
        ['--macbook-lid-offset' as string]: lidOffset,
        ['--macbook-device-offset' as string]: deviceOffset,
        ['--macbook-text-offset' as string]: textOffset,
        ['--macbook-text-opacity' as string]: String(textOpacity),
        ['--macbook-screen-scale' as string]: String(screenScale),
        ['--macbook-screen-lift' as string]: screenLift,
        ['--macbook-chassis-opacity' as string]: String(chassisOpacity),
        ['--macbook-bezel-opacity' as string]: String(bezelOpacity),
        ['--macbook-screen-radius' as string]: screenRadius,
      }}
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
                <img src={src} alt="Betterpass platform preview" loading="lazy" decoding="async" className="macbook-scroll-hero-img" />
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
