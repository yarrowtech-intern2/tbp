import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  CHAPTERS,
  CINEMATIC_SCROLL_VH,
  REDUCED_MOTION_SCROLL_VH,
  createCinematicProxies,
  EASE,
  type CinematicProxies,
} from '../components/cinematic-hero/timelineConfig';

gsap.registerPlugin(ScrollTrigger);

const BOOKING_STEP_COUNT = 6; // 7 steps, indices 0-6

const buildFullTimeline = (proxies: CinematicProxies): gsap.core.Timeline => {
  const tl = gsap.timeline({ defaults: { ease: 'none' } });

  // Scene 1 — clouds part, traveler revealed, gentle push-in.
  tl.fromTo(
    proxies.clouds,
    { spread: 0 },
    { spread: 1, duration: CHAPTERS.clouds.end - CHAPTERS.clouds.start, ease: EASE.gentle },
    CHAPTERS.clouds.start,
  )
    .fromTo(
      proxies.traveler,
      { opacity: 0 },
      { opacity: 1, duration: CHAPTERS.clouds.end - CHAPTERS.clouds.start, ease: EASE.gentle },
      CHAPTERS.clouds.start,
    )
    .fromTo(
      proxies.camera,
      { z: 8, y: 1.6, fov: 50 },
      { z: 5, y: 1.6, fov: 48, duration: CHAPTERS.clouds.end - CHAPTERS.clouds.start },
      CHAPTERS.clouds.start,
    );

  // Scene 2 — traveler pulls out the phone, camera pushes closer.
  tl.to(
    proxies.traveler,
    { armRaise: 1, duration: CHAPTERS.phoneOut.end - CHAPTERS.phoneOut.start },
    CHAPTERS.phoneOut.start,
  )
    .fromTo(
      proxies.phone,
      { opacity: 0, scale: 0.85 },
      { opacity: 1, scale: 1, duration: CHAPTERS.phoneOut.end - CHAPTERS.phoneOut.start },
      CHAPTERS.phoneOut.start,
    )
    .to(
      proxies.camera,
      { z: 3.4, y: 1.55, fov: 42, duration: CHAPTERS.phoneOut.end - CHAPTERS.phoneOut.start },
      CHAPTERS.phoneOut.start,
    );

  // Scene 3 — Better Pass booking flow (DOM overlay steps through proxies.chapter.stepIndex).
  tl.to(
    proxies.chapter,
    {
      stepIndex: BOOKING_STEP_COUNT,
      duration: CHAPTERS.booking.end - CHAPTERS.booking.start,
      ease: `steps(${BOOKING_STEP_COUNT})`,
    },
    CHAPTERS.booking.start,
  );

  // Scene 4 — pack the travel bag; camera reframes lower and wider.
  tl.to(
    proxies.phone,
    { opacity: 0, duration: CHAPTERS.pack.end - CHAPTERS.pack.start },
    CHAPTERS.pack.start,
  )
    .fromTo(
      proxies.bag,
      { opacity: 0, openAmount: 0 },
      { opacity: 1, openAmount: 1, duration: (CHAPTERS.pack.end - CHAPTERS.pack.start) * 0.7 },
      CHAPTERS.pack.start,
    )
    .to(
      proxies.bag,
      { openAmount: 0.15, duration: (CHAPTERS.pack.end - CHAPTERS.pack.start) * 0.3 },
      CHAPTERS.pack.start + (CHAPTERS.pack.end - CHAPTERS.pack.start) * 0.7,
    )
    .to(
      proxies.traveler,
      { bagGrab: 1, duration: CHAPTERS.pack.end - CHAPTERS.pack.start },
      CHAPTERS.pack.start,
    )
    .to(
      proxies.camera,
      { z: 5.5, y: 1.15, fov: 56, duration: CHAPTERS.pack.end - CHAPTERS.pack.start },
      CHAPTERS.pack.start,
    );

  // Scene 5 — walk to the bus, board, door closes.
  tl.to(
    proxies.traveler,
    { walk: 1, duration: CHAPTERS.board.end - CHAPTERS.board.start, ease: EASE.standard },
    CHAPTERS.board.start,
  )
    .to(
      proxies.bus,
      { doorOpen: 1, duration: (CHAPTERS.board.end - CHAPTERS.board.start) * 0.4 },
      CHAPTERS.board.start + (CHAPTERS.board.end - CHAPTERS.board.start) * 0.2,
    )
    .to(
      proxies.traveler,
      { visible: 0, duration: (CHAPTERS.board.end - CHAPTERS.board.start) * 0.25 },
      CHAPTERS.board.start + (CHAPTERS.board.end - CHAPTERS.board.start) * 0.72,
    )
    .to(
      proxies.bus,
      { doorOpen: 0, duration: (CHAPTERS.board.end - CHAPTERS.board.start) * 0.25 },
      CHAPTERS.board.start + (CHAPTERS.board.end - CHAPTERS.board.start) * 0.75,
    )
    .to(
      proxies.camera,
      { z: 4, y: 1.5, fov: 50, duration: CHAPTERS.board.end - CHAPTERS.board.start },
      CHAPTERS.board.start,
    );

  // Scene 6 — the big one: camera rises and orbits into an aerial drone shot.
  const aerialMid = CHAPTERS.aerial.start + (CHAPTERS.aerial.end - CHAPTERS.aerial.start) * 0.5;
  tl.to(
    proxies.camera,
    {
      x: 9,
      y: 18,
      z: -2,
      lookY: 0.5,
      fov: 56,
      duration: (CHAPTERS.aerial.end - CHAPTERS.aerial.start) * 0.5,
      ease: EASE.standard,
    },
    CHAPTERS.aerial.start,
  )
    .to(
      proxies.camera,
      {
        x: 16,
        y: 40,
        z: -9,
        lookX: 0,
        lookY: 0,
        lookZ: -4,
        fov: 62,
        duration: (CHAPTERS.aerial.end - CHAPTERS.aerial.start) * 0.5,
        ease: EASE.standard,
      },
      aerialMid,
    )
    .to(
      proxies.bus,
      { rotY: 0.6, duration: CHAPTERS.aerial.end - CHAPTERS.aerial.start, ease: EASE.standard },
      CHAPTERS.aerial.start,
    );

  // Scene 7 — the journey: road/vegetation recycle underneath, environment shifts coastal.
  tl.to(
    proxies.bus,
    { speed: 1, duration: (CHAPTERS.road.end - CHAPTERS.road.start) * 0.15 },
    CHAPTERS.road.start,
  )
    .to(
      proxies.bus,
      { travel: 1, duration: CHAPTERS.road.end - CHAPTERS.road.start, ease: EASE.gentle },
      CHAPTERS.road.start,
    )
    .to(
      proxies.environment,
      { mix: 1, duration: CHAPTERS.road.end - CHAPTERS.road.start },
      CHAPTERS.road.start,
    )
    .to(
      proxies.camera,
      { fov: 58, duration: CHAPTERS.road.end - CHAPTERS.road.start },
      CHAPTERS.road.start,
    );

  // Scene 8 — arrive at the beach: fast -> normal -> slow -> stop; ocean reveals and keeps living.
  tl.to(
    proxies.bus,
    { speed: 0, travel: 1.12, duration: CHAPTERS.arrive.end - CHAPTERS.arrive.start, ease: EASE.arrive },
    CHAPTERS.arrive.start,
  )
    .fromTo(
      proxies.ocean,
      { reveal: 0 },
      { reveal: 1, duration: CHAPTERS.arrive.end - CHAPTERS.arrive.start },
      CHAPTERS.arrive.start,
    )
    .to(
      proxies.camera,
      {
        x: 10,
        y: 24,
        z: -3,
        fov: 50,
        duration: CHAPTERS.arrive.end - CHAPTERS.arrive.start,
        ease: EASE.arrive,
      },
      CHAPTERS.arrive.start,
    );

  // Scene 9 — subtle atmospheric settle before the pin releases into the existing hero.
  tl.to(
    proxies.camera,
    { y: 22, duration: CHAPTERS.release.end - CHAPTERS.release.start },
    CHAPTERS.release.start,
  );

  return tl;
};

const buildReducedMotionTimeline = (proxies: CinematicProxies): gsap.core.Timeline => {
  const tl = gsap.timeline({ defaults: { ease: 'none' } });

  tl.fromTo(proxies.clouds, { spread: 0 }, { spread: 1, duration: 12 }, 0)
    .fromTo(proxies.traveler, { opacity: 0 }, { opacity: 1, duration: 12 }, 0)
    .fromTo(proxies.phone, { opacity: 0 }, { opacity: 1, duration: 13 }, 12)
    .to(
      proxies.chapter,
      { stepIndex: BOOKING_STEP_COUNT, duration: 13, ease: `steps(${BOOKING_STEP_COUNT})` },
      25,
    )
    .to(proxies.phone, { opacity: 0, duration: 10 }, 38)
    .fromTo(proxies.bag, { opacity: 0 }, { opacity: 1, duration: 12 }, 38)
    .to(proxies.traveler, { walk: 1, visible: 0, duration: 12 }, 50)
    .to(proxies.bus, { travel: 1, duration: 23 }, 62)
    .to(proxies.environment, { mix: 1, duration: 23 }, 62)
    .fromTo(proxies.ocean, { reveal: 0 }, { reveal: 1, duration: 12 }, 85)
    .to(proxies.camera, { z: 5, duration: 15 }, 85);

  return tl;
};

export interface UseCinematicTimelineArgs {
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  pinRef: React.RefObject<HTMLDivElement | null>;
  prefersReducedMotion: boolean;
  onStepChange: (step: number) => void;
  onTick?: (proxies: CinematicProxies) => void;
}

export interface UseCinematicTimelineResult {
  proxies: CinematicProxies;
  scrollDistanceVh: number;
  requestRefresh: () => void;
}

export function useCinematicTimeline({
  wrapperRef,
  pinRef,
  prefersReducedMotion,
  onStepChange,
  onTick,
}: UseCinematicTimelineArgs): UseCinematicTimelineResult {
  const [proxies] = useState<CinematicProxies>(createCinematicProxies);
  const lastStepRef = useRef(0);
  const scrollDistanceVh = prefersReducedMotion ? REDUCED_MOTION_SCROLL_VH : CINEMATIC_SCROLL_VH;

  // Kept in refs (not effect deps) so inline/unmemoized callbacks from the
  // caller don't tear down and rebuild the ScrollTrigger on every render.
  // Assigned in an effect (not during render) so refs stay write-after-commit only.
  const onStepChangeRef = useRef(onStepChange);
  const onTickRef = useRef(onTick);
  useEffect(() => {
    onStepChangeRef.current = onStepChange;
    onTickRef.current = onTick;
  });

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const pin = pinRef.current;
    if (!wrapper || !pin) return undefined;

    lastStepRef.current = 0;

    const ctx = gsap.context(() => {
      const tl = prefersReducedMotion ? buildReducedMotionTimeline(proxies) : buildFullTimeline(proxies);

      ScrollTrigger.create({
        trigger: wrapper,
        pin,
        start: 'top top',
        end: `+=${scrollDistanceVh}%`,
        scrub: 1,
        animation: tl,
        invalidateOnRefresh: true,
        onUpdate: () => {
          const step = Math.round(proxies.chapter.stepIndex);
          if (step !== lastStepRef.current) {
            lastStepRef.current = step;
            onStepChangeRef.current(step);
          }
          onTickRef.current?.(proxies);
        },
      });
    }, wrapper);

    return () => ctx.revert();
  }, [wrapperRef, pinRef, prefersReducedMotion, scrollDistanceVh, proxies]);

  const requestRefresh = () => {
    requestAnimationFrame(() => ScrollTrigger.refresh());
  };

  return { proxies, scrollDistanceVh, requestRefresh };
}
