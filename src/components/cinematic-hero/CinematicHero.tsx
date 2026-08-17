import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CloudLayers } from './CloudLayers';
import { ProgressIndicator } from './ProgressIndicator';
import { RoomModelStage, type CameraProgress } from './RoomModelStage';
import { StoryText } from './StoryText';
import './cinematic-hero.css';

gsap.registerPlugin(ScrollTrigger);

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

export const CinematicHero = () => {
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
    const cloudCopy = selector('.rtw-cloud-copy');
    const destinationCopy = selector('.rtw-destination-copy');
    const finalCta = selector('.rtw-final-cta');

    const context = gsap.context(() => {
      gsap.set(selector('.rtw-opening-copy .rtw-line-inner'), { yPercent: 112 });
      gsap.set(selector('.rtw-destination-copy .rtw-line-inner'), { yPercent: 112 });
      gsap.set([roomCopy, cloudCopy, destinationCopy, finalCta], { autoAlpha: 0 });
      gsap.set(openingCopy, { autoAlpha: 1 });
      gsap.set(progressFill, { scaleX: 0, transformOrigin: '0% 50%' });
      gsap.set(selector('.rtw-cloud-stage'), { autoAlpha: 0 });
      gsap.set(selector('.rtw-destination'), { autoAlpha: 0 });
      gsap.set(selector('.rtw-light-bloom'), { autoAlpha: 0, scale: 0.75 });
      gsap.set(selector('.rtw-release-wash'), { autoAlpha: 0 });
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
          const scrollScreens = isMobile ? 5.35 : isTablet ? 5.85 : 6.35;
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
                filter: 'brightness(1.16) saturate(1.08) contrast(1.04)',
                duration: 22,
                ease: 'power1.inOut',
              },
              29,
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
              selector('.rtw-cloud-stage'),
              {
                autoAlpha: 1,
                duration: 8,
                ease: 'power2.out',
              },
              41,
            )
            .to(
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
            )
            .fromTo(
              selector('.rtw-cloud-background'),
              { yPercent: 10, scale: 0.95, autoAlpha: 0 },
              { yPercent: -4, scale: 1.1, autoAlpha: 0.82, duration: 24, ease: 'power1.out' },
              44,
            )
            .fromTo(
              selector('.rtw-cloud-middle'),
              { xPercent: -8, yPercent: 20, scale: 1.04, autoAlpha: 0 },
              { xPercent: 4, yPercent: -12, scale: isMobile ? 1.28 : 1.45, autoAlpha: 0.9, duration: 24, ease: 'power1.out' },
              47,
            )
            .fromTo(
              selector('.rtw-cloud-foreground'),
              { xPercent: 7, yPercent: 32, scale: 1.22, autoAlpha: 0 },
              { xPercent: -6, yPercent: -16, scale: isMobile ? 1.55 : 1.95, autoAlpha: 0.92, duration: 23, ease: 'power1.out' },
              49,
            )
            .fromTo(
              cloudCopy,
              { autoAlpha: 0, y: 24, clipPath: 'inset(0 0 100% 0)' },
              {
                autoAlpha: 1,
                y: 0,
                clipPath: 'inset(0 0 0% 0)',
                duration: 9,
                ease: 'power2.out',
              },
              52,
            )
            .fromTo(
              selector('.rtw-destination'),
              { autoAlpha: 0, yPercent: 10, scale: 1.12 },
              {
                autoAlpha: 1,
                yPercent: 0,
                scale: 1.02,
                duration: 24,
                ease: 'power1.out',
              },
              63,
            )
            .to(
              selector('.rtw-cloud-left'),
              {
                xPercent: isMobile ? -22 : -42,
                yPercent: -22,
                scale: isMobile ? 1.35 : 1.55,
                autoAlpha: 0.38,
                duration: 22,
                ease: 'power1.inOut',
              },
              65,
            )
            .to(
              selector('.rtw-cloud-right'),
              {
                xPercent: isMobile ? 24 : 46,
                yPercent: -20,
                scale: isMobile ? 1.34 : 1.55,
                autoAlpha: 0.4,
                duration: 22,
                ease: 'power1.inOut',
              },
              65,
            )
            .to(
              selector('.rtw-cloud-foreground'),
              {
                yPercent: isMobile ? -28 : -42,
                scale: isMobile ? 1.8 : 2.35,
                autoAlpha: 0.16,
                duration: 22,
                ease: 'power1.inOut',
              },
              65,
            )
            .to(
              cloudCopy,
              {
                autoAlpha: 0,
                y: -20,
                duration: 7,
                ease: 'power2.in',
              },
              66,
            )
            .to(
              selector('.rtw-destination-mountain'),
              {
                yPercent: isMobile ? -2 : -4,
                scale: isMobile ? 1.05 : 1.08,
                duration: 34,
                ease: 'power1.out',
              },
              66,
            )
            .to(
              selector('.rtw-destination-copy .rtw-line-inner'),
              {
                yPercent: 0,
                duration: 8,
                stagger: 0.85,
                ease: 'power3.out',
              },
              73,
            )
            .fromTo(
              destinationCopy,
              { autoAlpha: 0, y: 22 },
              { autoAlpha: 1, y: 0, duration: 9, ease: 'power2.out' },
              73,
            )
            .fromTo(
              finalCta,
              { autoAlpha: 0, y: 24, clipPath: 'inset(0 0 100% 0)' },
              {
                autoAlpha: 1,
                y: 0,
                clipPath: 'inset(0 0 0% 0)',
                duration: 10,
                ease: 'power2.out',
              },
              85,
            )
            .to(
              selector('.rtw-release-wash'),
              {
                autoAlpha: 0.48,
                duration: 10,
                ease: 'power1.inOut',
              },
              91,
            );

          return () => {
            timeline.kill();
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
          <div className="rtw-sky-gradient" />
          <div className="rtw-sun-haze" />
          <div className="rtw-destination">
            <div className="rtw-destination-sky" />
            <picture className="rtw-destination-mountain">
              <source media="(max-width: 768px)" srcSet="/cinematic-hero/destination-mountain-mobile.webp" />
              <img src="/cinematic-hero/destination-mountain.webp" alt="" loading="eager" decoding="async" />
            </picture>
            <div className="rtw-destination-foreground" />
          </div>
          <CloudLayers />
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
        <div className="rtw-release-wash" aria-hidden="true" />

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

        <StoryText
          className="rtw-cloud-copy"
          lines={['THE JOURNEY BEGINS HERE.']}
        />

        <div className="rtw-destination-copy">
          <StoryText
            lines={['YOUR NEXT STORY', 'IS WAITING.']}
          />
          <p>Where will you go next?</p>
        </div>

        <div className="rtw-final-cta">
          <p>Where will you go next?</p>
          <Link to="/login" className="rtw-cta-link" aria-label="Explore destinations">
            <span>Explore destinations</span>
            <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
          </Link>
        </div>

        <ProgressIndicator />
      </div>
    </section>
  );
};
