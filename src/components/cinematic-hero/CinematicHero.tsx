import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ProgressIndicator } from './ProgressIndicator';
import { RoomModelStage, type CameraProgress } from './RoomModelStage';
import { StoryText } from './StoryText';
import './cinematic-hero.css';

gsap.registerPlugin(ScrollTrigger);

const MOUNTAIN_IMAGE_URL = 'https://res.cloudinary.com/dc3qprub3/image/upload/v1787040026/mountain_m366zv.webp';
const SKY_IMAGE_URL = 'https://res.cloudinary.com/dc3qprub3/image/upload/v1787040025/sky_zit5o4.webp';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const getPrefersReducedMotion = () => (
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
);

const usePrefersReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getPrefersReducedMotion);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(query.matches);

    updatePreference();
    query.addEventListener('change', updatePreference);

    return () => {
      query.removeEventListener('change', updatePreference);
    };
  }, []);

  return prefersReducedMotion;
};

type CinematicHeroProps = {
  // The real next section (#home5-hero). Pinned in sync with the room stage,
  // beneath it, so it's visible through the window/glass as the camera
  // dollies in — rather than a fake backdrop, what's "beyond the window" is
  // the actual next section of the page.
  nextSectionRef?: React.RefObject<HTMLElement | null>;
};

export const CinematicHero: React.FC<CinematicHeroProps> = ({ nextSectionRef }) => {
  const wrapperRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  // Mutable (non-React-state) progress proxy: GSAP scrubs `.t` from 0 to 1
  // and the R3F camera reads it every frame to dolly between the cam-start
  // / cam-end markers authored in the model itself.
  const cameraProgressRef = useRef<CameraProgress>({ t: 0 });
  const prefersReducedMotion = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const stage = stageRef.current;

    if (!wrapper || !stage || prefersReducedMotion) return undefined;

    const cameraProgress = cameraProgressRef.current;
    const selector = gsap.utils.selector(wrapper);
    const progressFill = selector('.rtw-progress-fill');
    const openingCopy = selector('.rtw-opening-copy');
    const roomCopy = selector('.rtw-room-copy');
    const destinationSky = selector('.rtw-destination-sky');
    const destinationMountain = selector('.rtw-destination-mountain');
    const destinationTitle = selector('.rtw-destination-title');

    const context = gsap.context(() => {
      gsap.set(selector('.rtw-opening-copy .rtw-line-inner'), { yPercent: 112 });
      gsap.set(roomCopy, { autoAlpha: 0 });
      gsap.set(openingCopy, { autoAlpha: 1 });
      gsap.set(progressFill, { scaleX: 0, transformOrigin: '0% 50%' });
      gsap.set(selector('.rtw-light-bloom'), { autoAlpha: 0, scale: 0.75 });
      gsap.set(selector('.rtw-vignette'), { opacity: 1 });
      gsap.set(destinationSky, { autoAlpha: 0, yPercent: 0, scale: 1.06 });
      gsap.set(destinationMountain, { autoAlpha: 0, yPercent: 8, scale: 1.035 });
      gsap.set(destinationTitle, { autoAlpha: 0, yPercent: 8, scale: 0.99 });
      gsap.set(cameraProgress, { t: 0 });

      const media = gsap.matchMedia();

      media.add(
        {
          isMobile: '(max-width: 768px)',
          isTablet: '(min-width: 769px) and (max-width: 1100px)',
          isDesktop: '(min-width: 1101px)',
        },
        (mediaContext) => {
          const isMobile = Boolean(mediaContext.conditions?.isMobile);
          const isTablet = Boolean(mediaContext.conditions?.isTablet);
          // Section now ends right after the window/clouds dissolve (~61
          // timeline units, down from ~101 when it played through a
          // separate destination/CTA scene) — scroll distance is scaled
          // down to match so the pacing still feels the same.
          const scrollScreens = isMobile ? 3.25 : isTablet ? 3.55 : 3.85;
          const portalScale = isMobile ? 3.05 : isTablet ? 3.75 : 4.55;

          const timeline = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: wrapper,
              start: 'top top',
              end: () => `+=${Math.round(window.innerHeight * scrollScreens)}`,
              scrub: 1.08,
              pin: stage,
              anticipatePin: 1,
              invalidateOnRefresh: true,
              onUpdate: (self) => {
                gsap.set(progressFill, { scaleX: self.progress });
              },
            },
          });

          // Hold the real next section fixed over the same scroll range as
          // the room stage above, but underneath it (z-index) — visible
          // through the window as the room's canvas fades/clears, then
          // released back to normal flow the instant the room's own pin
          // ends. Note this is deliberately NOT GSAP's `pin` option: `pin`
          // anchors the pinned element at *its own* natural document
          // offset, not the trigger's — since nextSectionEl sits far below
          // wrapper, that left it fixed thousands of pixels off-screen.
          // Setting `inset: 0` directly guarantees it actually overlaps the
          // viewport (and the room) instead.
          const nextSectionEl = nextSectionRef?.current;
          const nextSectionPin = nextSectionEl
            ? ScrollTrigger.create({
              trigger: wrapper,
              start: 'top top',
              end: () => `+=${Math.round(window.innerHeight * scrollScreens)}`,
              invalidateOnRefresh: true,
              onToggle: (self) => {
                if (self.isActive) {
                  nextSectionEl.style.position = 'fixed';
                  nextSectionEl.style.inset = '0';
                } else {
                  nextSectionEl.style.position = '';
                  nextSectionEl.style.inset = '';
                }
              },
            })
            : null;

          timeline
            .to(
              selector('.rtw-opening-copy .rtw-line-inner'),
              {
                yPercent: 0,
                duration: 9,
                stagger: 1.05,
                ease: 'power3.out',
              },
              0,
            )
            .to(
              cameraProgress,
              {
                t: 1,
                duration: 37,
                ease: 'power1.inOut',
              },
              10,
            )
            .to(
              selector('.rtw-model-glow'),
              {
                autoAlpha: 0.82,
                scale: isMobile ? 1.08 : 1.18,
                duration: 18,
                ease: 'power1.inOut',
              },
              10,
            )
            .to(
              openingCopy,
              {
                autoAlpha: 0,
                yPercent: -7,
                duration: 8,
                ease: 'power2.out',
              },
              11,
            )
            .fromTo(
              roomCopy,
              { autoAlpha: 0, y: 24, clipPath: 'inset(0 0 100% 0)' },
              {
                autoAlpha: 1,
                y: 0,
                clipPath: 'inset(0 0 0% 0)',
                duration: 10,
                ease: 'power2.out',
              },
              14,
            )
            .to(
              roomCopy,
              {
                autoAlpha: 0,
                y: -18,
                duration: 7,
                ease: 'power2.in',
              },
              31,
            )
            .to(
              selector('.rtw-world'),
              {
                filter: 'brightness(1.08) saturate(1.16) contrast(1.02)',
                duration: 22,
                ease: 'power1.inOut',
              },
              29,
            )
            .to(
              selector('.rtw-vignette'),
              {
                opacity: 0.2,
                duration: 22,
                ease: 'power1.out',
              },
              29,
            )
            .to(
              destinationSky,
              {
                autoAlpha: 1,
                yPercent: -2,
                scale: 1.015,
                duration: 12,
                ease: 'power1.out',
              },
              18,
            )
            .to(
              destinationSky,
              {
                yPercent: -4,
                scale: 1,
                duration: 25,
                ease: 'power1.inOut',
              },
              30,
            )
            .to(
              destinationMountain,
              {
                autoAlpha: 1,
                yPercent: 1,
                scale: 1.01,
                duration: 13,
                ease: 'power2.out',
              },
              26,
            )
            .to(
              destinationMountain,
              {
                yPercent: -2.5,
                scale: 1,
                duration: 23,
                ease: 'power1.inOut',
              },
              34,
            )
            .to(
              destinationTitle,
              {
                autoAlpha: 1,
                yPercent: 0,
                scale: 1,
                duration: 8,
                ease: 'power2.out',
              },
              36,
            )
            .to(
              destinationTitle,
              {
                yPercent: -3,
                scale: 1.012,
                duration: 20,
                ease: 'power1.inOut',
              },
              41,
            )
            .to(
              selector('.rtw-light-bloom'),
              {
                autoAlpha: 0.78,
                scale: isMobile ? 1.6 : 2.15,
                duration: 11,
                ease: 'power2.out',
              },
              35,
            )
            .to(
              // The camera passes beyond the window here — the room
              // dissolves away and the pin releases, handing off to the
              // real next section (#home5-hero) scrolling up underneath.
              selector('.rtw-room-scene'),
              {
                scale: portalScale,
                autoAlpha: 0,
                filter: 'brightness(1.28) blur(1.4px)',
                duration: 12,
                ease: 'power2.in',
              },
              46,
            )
            .to(
              selector('.rtw-light-bloom'),
              {
                autoAlpha: 0.12,
                scale: isMobile ? 2 : 2.8,
                duration: 14,
                ease: 'power2.inOut',
              },
              47,
            );

          return () => {
            timeline.kill();
            nextSectionPin?.kill();
            if (nextSectionEl) {
              nextSectionEl.style.position = '';
              nextSectionEl.style.inset = '';
            }
          };
        },
      );

      return () => {
        media.revert();
      };
    }, wrapper);

    return () => {
      context.revert();
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || prefersReducedMotion) return undefined;

    const refresh = () => ScrollTrigger.refresh();
    const timeoutId = window.setTimeout(refresh, 120);
    const pendingImages = Array.from(wrapper.querySelectorAll('img')).filter((image) => !image.complete);

    pendingImages.forEach((image) => {
      image.addEventListener('load', refresh, { once: true });
    });

    return () => {
      window.clearTimeout(timeoutId);
      pendingImages.forEach((image) => {
        image.removeEventListener('load', refresh);
      });
    };
  }, [prefersReducedMotion]);

  const skipIntro = () => {
    document.getElementById('home5-hero')?.scrollIntoView({ block: 'start' });
  };

  return (
    <section
      id="room-to-world-hero"
      ref={wrapperRef}
      className={`rtw-cinematic-hero${prefersReducedMotion ? ' is-reduced' : ''}`}
      aria-labelledby="room-to-world-title"
    >
      <button type="button" className="rtw-skip-link" onClick={skipIntro}>
        Skip cinematic intro
      </button>

      <div ref={stageRef} className="rtw-stage">
        <div className="rtw-world" aria-hidden="true">
          <img
            className="rtw-destination-layer rtw-destination-sky"
            src={SKY_IMAGE_URL}
            alt=""
            fetchPriority="high"
            decoding="async"
          />
          <div className="rtw-destination-title">
            <span>The New Generation of</span>
            <strong>TRAVELLING</strong>
          </div>
          <img
            className="rtw-destination-layer rtw-destination-mountain"
            src={MOUNTAIN_IMAGE_URL}
            alt=""
            fetchPriority="high"
            decoding="async"
          />
          <div className="rtw-sun-haze" />
        </div>

        <div className="rtw-room-scene" aria-hidden="true">
          <div className="rtw-model-glow" />
          <div className="rtw-model-stage">
            <RoomModelStage progressRef={cameraProgressRef} />
          </div>
        </div>

        <div className="rtw-light-bloom" aria-hidden="true" />
        <div className="rtw-film-grain" aria-hidden="true" />
        <div className="rtw-vignette" aria-hidden="true" />

        <StoryText
          id="room-to-world-title"
          as="h1"
          className="rtw-opening-copy"
          lines={['THE WORLD IS CLOSER', 'THAN YOU THINK.']}
        />

        <StoryText
          className="rtw-room-copy"
          lines={['Somewhere out there,', 'your next story is waiting.']}
          tone="support"
        />

        <ProgressIndicator />
      </div>
    </section>
  );
};
