import { useLayoutEffect, type RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

type Home4HeroMotionRefs = {
  sectionRef: RefObject<HTMLElement | null>;
  introRef: RefObject<HTMLParagraphElement | null>;
  titleRef: RefObject<HTMLHeadingElement | null>;
  globeRef: RefObject<HTMLDivElement | null>;
  scrollCueRef: RefObject<HTMLAnchorElement | null>;
  showcaseRef: RefObject<HTMLElement | null>;
  titleWordRefs: RefObject<Array<HTMLSpanElement | null>>;
};

let scrollTriggerRegistered = false;

const registerScrollTrigger = () => {
  if (scrollTriggerRegistered || typeof window === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);
  scrollTriggerRegistered = true;
};

export const useHome4HeroMotion = ({
  sectionRef,
  introRef,
  titleRef,
  globeRef,
  scrollCueRef,
  showcaseRef,
  titleWordRefs,
}: Home4HeroMotionRefs) => {
  useLayoutEffect(() => {
    registerScrollTrigger();

    const section = sectionRef.current;
    const intro = introRef.current;
    const title = titleRef.current;
    const globe = globeRef.current;
    const scrollCue = scrollCueRef.current;
    const showcase = showcaseRef.current;
    const titleWords = titleWordRefs.current.filter(Boolean) as HTMLSpanElement[];

    if (!section || !intro || !title || !globe || !scrollCue || !showcase || !titleWords.length) {
      return;
    }

    const context = gsap.context(() => {
      const media = gsap.matchMedia();

      media.add(
        {
          desktop: '(min-width: 1024px)',
        },
        ({ conditions }) => {
          const { desktop } = conditions as {
            desktop?: boolean;
          };

          const copyLift = desktop ? -192 : -112;
          const titleLift = desktop ? -224 : -144;
          const globeLift = desktop ? -240 : -156;
          const globeScale = desktop ? 1.12 : 1.07;
          const showcaseOffset = desktop ? 88 : 56;

          gsap.timeline({
            defaults: { ease: 'expo.out' },
          })
            .fromTo(intro, { autoAlpha: 0, yPercent: 108 }, { autoAlpha: 1, yPercent: 0, duration: 0.9 }, 0.1)
            .fromTo(
              titleWords,
              { autoAlpha: 0, yPercent: 112 },
              {
                autoAlpha: 1,
                yPercent: 0,
                duration: 1.06,
                ease: 'power3.out',
                stagger: 0.08,
              },
              0.28
            )
            .fromTo(globe, { autoAlpha: 0, yPercent: 10, scale: 0.94 }, { autoAlpha: 1, yPercent: 0, scale: 1, duration: 1.4 }, 0.12)
            .fromTo(scrollCue, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.72 }, 0.9);

          gsap.to(globe, {
            yPercent: desktop ? 2.8 : 1.4,
            duration: desktop ? 5.8 : 6.8,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
          });

          gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: section,
              start: 'top top',
              end: '85% top',
              scrub: true,
              invalidateOnRefresh: true,
            },
          })
            .fromTo(intro, { y: 0, autoAlpha: 1, scale: 1 }, { y: copyLift, autoAlpha: 0, scale: 0.96 }, 0)
            .fromTo(title, { y: 0, autoAlpha: 1, scale: 1 }, { y: titleLift, autoAlpha: 0, scale: 0.88 }, 0)
            .fromTo(globe, { y: 0, autoAlpha: 1, scale: 1 }, { y: globeLift, scale: globeScale, autoAlpha: 0 }, 0)
            .fromTo(scrollCue, { y: 0, autoAlpha: 1 }, { y: 24, autoAlpha: 0 }, 0);

          gsap.fromTo(
            showcase,
            { y: showcaseOffset, autoAlpha: 0.38 },
            {
              y: 0,
              autoAlpha: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: section,
                start: '40% bottom',
                end: 'bottom top',
                scrub: true,
                invalidateOnRefresh: true,
              },
            }
          );
        }
      );

      return () => media.revert();
    }, section);

    return () => context.revert();
  }, [globeRef, introRef, scrollCueRef, sectionRef, showcaseRef, titleRef, titleWordRefs]);
};
