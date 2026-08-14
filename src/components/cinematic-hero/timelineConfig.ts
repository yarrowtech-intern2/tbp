// Single source of truth for the cinematic hero's scroll timeline: chapter
// percentages, the shared animatable value tree ("proxies") GSAP mutates
// outside the R3F Canvas, and the booking-flow copy shown on the phone.

export const CINEMATIC_SCROLL_VH = 750;
export const REDUCED_MOTION_SCROLL_VH = 200;

export interface Chapter {
  start: number;
  end: number;
}

export const CHAPTERS = {
  clouds: { start: 0, end: 12 },
  phoneOut: { start: 12, end: 25 },
  booking: { start: 25, end: 38 },
  pack: { start: 38, end: 50 },
  board: { start: 50, end: 62 },
  aerial: { start: 62, end: 73 },
  road: { start: 73, end: 88 },
  arrive: { start: 88, end: 96 },
  release: { start: 96, end: 100 },
} as const satisfies Record<string, Chapter>;

export type ChapterName = keyof typeof CHAPTERS;

export const BOOKING_STEPS = [
  'logo',
  'search',
  'destination',
  'tripCard',
  'select',
  'booking',
  'confirmed',
] as const;

export type BookingStep = (typeof BOOKING_STEPS)[number];

export interface CameraProxy {
  x: number;
  y: number;
  z: number;
  lookX: number;
  lookY: number;
  lookZ: number;
  fov: number;
}

export interface CloudsProxy {
  spread: number;
}

export interface TravelerProxy {
  opacity: number;
  armRaise: number;
  bagGrab: number;
  walk: number;
  visible: number;
}

export interface PhoneProxy {
  opacity: number;
  scale: number;
}

export interface BagProxy {
  opacity: number;
  openAmount: number;
}

export interface BusProxy {
  rotY: number;
  doorOpen: number;
  travel: number;
  speed: number;
}

export interface EnvironmentProxy {
  mix: number;
}

export interface OceanProxy {
  reveal: number;
}

export interface ChapterProxy {
  progress: number;
  stepIndex: number;
}

export interface CinematicProxies {
  camera: CameraProxy;
  clouds: CloudsProxy;
  traveler: TravelerProxy;
  phone: PhoneProxy;
  bag: BagProxy;
  bus: BusProxy;
  environment: EnvironmentProxy;
  ocean: OceanProxy;
  chapter: ChapterProxy;
}

export const createCinematicProxies = (): CinematicProxies => ({
  camera: { x: 0, y: 1.6, z: 8, lookX: 0, lookY: 1.5, lookZ: 0, fov: 50 },
  clouds: { spread: 0 },
  traveler: { opacity: 0, armRaise: 0, bagGrab: 0, walk: 0, visible: 1 },
  phone: { opacity: 0, scale: 0.85 },
  bag: { opacity: 0, openAmount: 0 },
  bus: { rotY: 0, doorOpen: 0, travel: 0, speed: 0 },
  environment: { mix: 0 },
  ocean: { reveal: 0 },
  chapter: { progress: 0, stepIndex: 0 },
});

export const EASE = {
  standard: 'power2.inOut',
  gentle: 'power1.inOut',
  arrive: 'power2.out',
} as const;
