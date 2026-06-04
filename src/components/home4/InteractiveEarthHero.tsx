import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, Plane, X } from 'lucide-react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import earthDayUrl from '../../assets/admin-map/earth-day.jpg';
import earthTopologyUrl from '../../assets/admin-map/earth-topology.png';

type TourPin = {
  id: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  image: string;
  headline: string;
  description: string;
  duration: string;
  tours: string;
  price: string;
  tags: string[];
};

type TourArc = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
};

type InteractiveEarthHeroProps = {
  isScrollLocked?: boolean;
  onDiscover: () => void;
};

const GLOBE_CAMERA_MIN_DISTANCE = 160;
const GLOBE_CAMERA_MAX_DISTANCE = 280;
const GLOBE_ROTATION_SPEED = 0.56;

const TOUR_PINS: TourPin[] = [
  {
    id: 'london',
    city: 'London',
    country: 'United Kingdom',
    lat: 51.5072,
    lng: -0.1276,
    image: '/images/home4/city-1600.jpg',
    headline: 'Royal routes and design-led city stays',
    description: 'Private landmark walks, West End evenings, market trails, and boutique stays across classic London neighborhoods.',
    duration: '4D / 3N',
    tours: '7 tours',
    price: 'from Rs. 82k',
    tags: ['Landmarks', 'Theatre', 'Markets'],
  },
  {
    id: 'paris',
    city: 'Paris',
    country: 'France',
    lat: 48.8566,
    lng: 2.3522,
    image: '/images/home4/city-1600.jpg',
    headline: 'Seine nights and museum mornings',
    description: 'Private museum entries, left-bank food walks, river cruises, and boutique stays near the old quarters.',
    duration: '4D / 3N',
    tours: '8 tours',
    price: 'from Rs. 89k',
    tags: ['Art routes', 'River cruise', 'Food walks'],
  },
  {
    id: 'dubai',
    city: 'Dubai',
    country: 'UAE',
    lat: 25.2048,
    lng: 55.2708,
    image: '/images/home4/city.jpg',
    headline: 'Skyline stays, desert drives, and marina nights',
    description: 'Luxury transfers, desert dining, architectural viewpoints, and curated waterfront experiences.',
    duration: '4D / 3N',
    tours: '8 tours',
    price: 'from Rs. 64k',
    tags: ['Desert', 'Skyline', 'Marina'],
  },
  {
    id: 'kolkata',
    city: 'Kolkata',
    country: 'India',
    lat: 22.5726,
    lng: 88.3639,
    image: '/images/kolkata1.jpg',
    headline: 'Colonial lanes, culture, and slow food',
    description: 'Heritage walks, tram routes, riverfront evenings, and curated Bengali dining with local storytellers.',
    duration: '3D / 2N',
    tours: '6 tours',
    price: 'from Rs. 18k',
    tags: ['Heritage walk', 'Food trail', 'Riverfront'],
  },
  {
    id: 'bangkok',
    city: 'Bangkok',
    country: 'Thailand',
    lat: 13.7563,
    lng: 100.5018,
    image: '/images/home4/temple-1600.jpg',
    headline: 'Temple mornings and river-market evenings',
    description: 'Long-tail river routes, food counters, old-city temples, and design-forward hotel stays.',
    duration: '4D / 3N',
    tours: '8 tours',
    price: 'from Rs. 52k',
    tags: ['Temples', 'Street food', 'River'],
  },
  {
    id: 'singapore',
    city: 'Singapore',
    country: 'Singapore',
    lat: 1.3521,
    lng: 103.8198,
    image: '/images/home4/city-1600.jpg',
    headline: 'Garden city design and night food trails',
    description: 'Marina viewpoints, garden routes, hawker-led dining, and efficient premium transfers.',
    duration: '3D / 2N',
    tours: '6 tours',
    price: 'from Rs. 58k',
    tags: ['Gardens', 'Food trail', 'Marina'],
  },
  {
    id: 'mumbai',
    city: 'Mumbai',
    country: 'India',
    lat: 19.076,
    lng: 72.8777,
    image: '/images/home4/city.jpg',
    headline: 'Harbour light and cinematic city walks',
    description: 'Art deco districts, coastal drives, studio stories, and late-night food trails across the city.',
    duration: '3D / 2N',
    tours: '7 tours',
    price: 'from Rs. 24k',
    tags: ['Coastal drive', 'Street food', 'Art deco'],
  },
  {
    id: 'tokyo',
    city: 'Tokyo',
    country: 'Japan',
    lat: 35.6762,
    lng: 139.6503,
    image: '/images/home4/temple-1600.jpg',
    headline: 'Neon districts and quiet temple routes',
    description: 'Design-led hotel stays, seasonal food counters, shrine mornings, and guided neighborhood deep dives.',
    duration: '5D / 4N',
    tours: '9 tours',
    price: 'from Rs. 1.18L',
    tags: ['Shrine routes', 'Night city', 'Sushi counters'],
  },
  {
    id: 'new-york',
    city: 'New York',
    country: 'USA',
    lat: 40.7128,
    lng: -74.006,
    image: '/images/home4/city.jpg',
    headline: 'Museum days and skyline nights',
    description: 'Neighborhood walks, rooftop views, gallery entries, and tailored borough-by-borough itineraries.',
    duration: '5D / 4N',
    tours: '10 tours',
    price: 'from Rs. 1.35L',
    tags: ['Skyline', 'Museums', 'Neighborhoods'],
  },
];

const findPin = (id: string) => TOUR_PINS.find((pin) => pin.id === id);
const makeArc = (startId: string, endId: string): TourArc | null => {
  const start = findPin(startId);
  const end = findPin(endId);
  if (!start || !end) return null;

  return {
    startLat: start.lat,
    startLng: start.lng,
    endLat: end.lat,
    endLng: end.lng,
  };
};

const ROUTE_ARCS: TourArc[] = [
  ...TOUR_PINS.filter((pin) => pin.id !== 'kolkata').map((pin) => ({
    startLat: 22.5726,
    startLng: 88.3639,
    endLat: pin.lat,
    endLng: pin.lng,
  })),
  makeArc('london', 'paris'),
  makeArc('paris', 'dubai'),
  makeArc('dubai', 'mumbai'),
  makeArc('mumbai', 'singapore'),
  makeArc('singapore', 'tokyo'),
  makeArc('tokyo', 'new-york'),
  makeArc('new-york', 'london'),
  makeArc('bangkok', 'singapore'),
  makeArc('new-york', 'paris'),
  makeArc('new-york', 'dubai'),
  makeArc('london', 'dubai'),
  makeArc('london', 'mumbai'),
  makeArc('paris', 'mumbai'),
  makeArc('dubai', 'bangkok'),
  makeArc('dubai', 'singapore'),
  makeArc('kolkata', 'singapore'),
  makeArc('kolkata', 'bangkok'),
  makeArc('mumbai', 'bangkok'),
  makeArc('mumbai', 'tokyo'),
  makeArc('singapore', 'new-york'),
  makeArc('tokyo', 'london'),
].filter((arc): arc is TourArc => Boolean(arc));

const asTourPin = (value: object) => value as TourPin;

type GlobeControls = {
  enablePan: boolean;
  enableZoom: boolean;
  enableRotate: boolean;
  autoRotate: boolean;
  autoRotateSpeed: number;
  enableDamping: boolean;
  dampingFactor: number;
  minDistance: number;
  maxDistance: number;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
  update?: () => void;
};

type GlobeCamera = {
  position?: {
    length?: () => number;
    setLength?: (length: number) => unknown;
  };
};

const tuneGlobeControls = (controls: GlobeControls, selectedPin: TourPin | null) => {
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.enableRotate = true;
  controls.autoRotate = !selectedPin;
  controls.autoRotateSpeed = GLOBE_ROTATION_SPEED;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = GLOBE_CAMERA_MIN_DISTANCE;
  controls.maxDistance = GLOBE_CAMERA_MAX_DISTANCE;
};

export const InteractiveEarthHero: React.FC<InteractiveEarthHeroProps> = ({ isScrollLocked = false, onDiscover }) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const controlsCleanupRef = useRef<(() => void) | null>(null);
  const interactiveRef = useRef(false);
  const introProgressRef = useRef(0);
  const touchYRef = useRef<number | null>(null);
  const [size, setSize] = useState({ width: 1200, height: 760 });
  const [selectedPin, setSelectedPin] = useState<TourPin | null>(null);
  const [isInteractive, setIsInteractive] = useState(false);

  const clampGlobeCamera = useCallback(() => {
    const globe = globeRef.current as (GlobeMethods & { camera?: () => GlobeCamera }) | undefined;
    const camera = globe?.camera?.();
    const position = camera?.position;
    const distance = position?.length?.();

    if (typeof distance !== 'number' || !Number.isFinite(distance)) return;

    const clampedDistance = Math.min(GLOBE_CAMERA_MAX_DISTANCE, Math.max(GLOBE_CAMERA_MIN_DISTANCE, distance));
    if (Math.abs(clampedDistance - distance) < 0.1) return;

    position?.setLength?.(clampedDistance);
    (globe?.controls() as GlobeControls | undefined)?.update?.();
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateSize = () => {
      const rect = stage.getBoundingClientRect();
      setSize({
        width: Math.max(360, Math.round(rect.width)),
        height: Math.max(480, Math.round(rect.height)),
      });
    };

    const frame = window.requestAnimationFrame(updateSize);
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => () => {
    controlsCleanupRef.current?.();
    controlsCleanupRef.current = null;
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let frame = 0;

    const setProgressVars = () => {
      frame = 0;
      const viewportHeight = Math.max(1, window.innerHeight);
      const scrollable = Math.max(1, section.offsetHeight - viewportHeight);
      const scrollProgress = Math.min(1, Math.max(0, -section.getBoundingClientRect().top / scrollable));
      const progress = isScrollLocked ? introProgressRef.current : scrollProgress;
      const eased = 1 - Math.pow(1 - progress, 3);
      const copyOpacity = Math.max(0, 1 - progress * 1.9);
      const markerOpacity = Math.max(0, Math.min(1, (progress - 0.64) / 0.18));
      const discoverOpacity = Math.max(0, Math.min(1, (progress - 0.72) / 0.16));
      const panelOpacity = Math.max(0, Math.min(1, (progress - 0.76) / 0.14));

      section.style.setProperty('--earth-progress', progress.toFixed(4));
      const isMobileViewport = window.innerWidth <= 640;
      const initialScale = isMobileViewport ? 0.98 : 1.34;
      const finalScale = isMobileViewport ? 0.64 : 0.72;
      const initialY = isMobileViewport ? 34 : 57;
      const yTravel = isMobileViewport ? 38 : 70;
      section.style.setProperty('--earth-stage-scale', (initialScale - eased * (initialScale - finalScale)).toFixed(4));
      section.style.setProperty('--earth-stage-y', `${(initialY - eased * yTravel).toFixed(2)}svh`);
      section.style.setProperty('--earth-copy-opacity', copyOpacity.toFixed(4));
      section.style.setProperty('--earth-copy-y', `${(-progress * 34).toFixed(2)}px`);
      section.style.setProperty('--earth-marker-opacity', markerOpacity.toFixed(4));
      section.style.setProperty('--earth-discover-opacity', discoverOpacity.toFixed(4));
      section.style.setProperty('--earth-panel-opacity', panelOpacity.toFixed(4));

      const nextInteractive = progress > 0.68;
      if (interactiveRef.current !== nextInteractive) {
        interactiveRef.current = nextInteractive;
        setIsInteractive(nextInteractive);
      }
    };

    const requestProgressUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(setProgressVars);
    };

    const setIntroProgress = (value: number) => {
      introProgressRef.current = Math.min(1, Math.max(0, value));
      requestProgressUpdate();
    };

    const handleWheel = (event: WheelEvent) => {
      if (!isScrollLocked) return;
      event.preventDefault();
      setIntroProgress(introProgressRef.current + event.deltaY / 1200);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (!isScrollLocked) return;
      touchYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!isScrollLocked || touchYRef.current === null) return;
      const nextY = event.touches[0]?.clientY;
      if (typeof nextY !== 'number') return;
      event.preventDefault();
      setIntroProgress(introProgressRef.current + (touchYRef.current - nextY) / 900);
      touchYRef.current = nextY;
    };

    if (!isScrollLocked) {
      introProgressRef.current = 1;
    } else {
      introProgressRef.current = 0;
    }

    frame = window.requestAnimationFrame(setProgressVars);
    window.addEventListener('scroll', requestProgressUpdate, { passive: true });
    window.addEventListener('resize', requestProgressUpdate);
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', requestProgressUpdate);
      window.removeEventListener('resize', requestProgressUpdate);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isScrollLocked]);

  const focusPin = useCallback((pin: TourPin) => {
    setSelectedPin(pin);
    globeRef.current?.pointOfView({ lat: pin.lat, lng: pin.lng, altitude: 1.28 }, 900);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedPin(null);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const controls = globeRef.current?.controls() as GlobeControls | undefined;
    if (!controls) return;

    tuneGlobeControls(controls, selectedPin);
    clampGlobeCamera();
  }, [clampGlobeCamera, selectedPin]);

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const controls = globe.controls() as GlobeControls;
    tuneGlobeControls(controls, null);
    controlsCleanupRef.current?.();
    controls.addEventListener?.('change', clampGlobeCamera);
    controlsCleanupRef.current = () => controls.removeEventListener?.('change', clampGlobeCamera);
    globe.pointOfView({ lat: 8, lng: -32, altitude: 1.8 }, 0);
    window.requestAnimationFrame(clampGlobeCamera);

    const tuneRenderQuality = () => {
      const renderer = globe.renderer() as {
        setPixelRatio?: (ratio: number) => void;
        capabilities?: { getMaxAnisotropy?: () => number };
      };
      renderer.setPixelRatio?.(Math.min(window.devicePixelRatio || 1, 2));

      const maxAnisotropy = Math.min(8, renderer.capabilities?.getMaxAnisotropy?.() ?? 4);
      const scene = globe.scene() as {
        traverse?: (visitor: (object: { material?: unknown }) => void) => void;
      };

      scene.traverse?.((object) => {
        const rawMaterials = Array.isArray(object.material) ? object.material : [object.material];
        rawMaterials.forEach((material) => {
          const typedMaterial = material as {
            map?: { anisotropy?: number; needsUpdate?: boolean };
            shininess?: number;
            needsUpdate?: boolean;
          } | undefined;

          if (!typedMaterial) return;
          if (typedMaterial.map) {
            typedMaterial.map.anisotropy = maxAnisotropy;
            typedMaterial.map.needsUpdate = true;
          }
          if (typeof typedMaterial.shininess === 'number') typedMaterial.shininess = 12;
          typedMaterial.needsUpdate = true;
        });
      });
    };

    tuneRenderQuality();
    window.setTimeout(tuneRenderQuality, 700);
  }, [clampGlobeCamera]);

  const createHtmlPin = useCallback((item: object) => {
    const pin = asTourPin(item);
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = `h4-earth-marker${selectedPin?.id === pin.id ? ' is-active' : ''}`;
    marker.setAttribute('aria-label', `View tours in ${pin.city}`);
    marker.innerHTML = `<span class="h4-earth-marker-dot"></span><span class="h4-earth-marker-label">${pin.city}</span>`;
    marker.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      focusPin(pin);
    });
    return marker;
  }, [focusPin, selectedPin?.id]);

  const selectedMeta = useMemo(() => selectedPin ? `${selectedPin.tours} / ${selectedPin.duration}` : '', [selectedPin]);
  const isCompactGlobe = size.width <= 700;
  const globeOffsetX = size.width > 700 ? -Math.round(size.width * 0.125) : 0;

  return (
    <section
      id="h4-earth-hero"
      ref={sectionRef}
      className={`h4-earth-hero${isInteractive ? ' is-interactive' : ''}${isScrollLocked ? ' is-scroll-locked' : ''}`}
      aria-labelledby="h4-earth-title"
    >
      <div className="h4-earth-sticky">
        <div className="h4-earth-space" aria-hidden="true" />
        <div className="h4-earth-brand-ghost" aria-hidden="true">The Better Pass</div>

        <div
          className="h4-earth-stage"
          ref={stageRef}
          style={{ '--earth-globe-offset-x': `${globeOffsetX}px` } as React.CSSProperties}
        >
          <div className="h4-earth-glow h4-earth-glow-a" aria-hidden="true" />
          <div className="h4-earth-glow h4-earth-glow-b" aria-hidden="true" />
          <Globe
            ref={globeRef}
            width={size.width}
            height={size.height}
            globeOffset={[globeOffsetX, 0]}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl={earthDayUrl}
            bumpImageUrl={earthTopologyUrl}
            globeCurvatureResolution={3}
            showAtmosphere={!isCompactGlobe}
            atmosphereColor="#b8d7ff"
            atmosphereAltitude={0.28}
            enablePointerInteraction={isInteractive}
            pointsData={isInteractive ? TOUR_PINS : []}
            pointLat="lat"
            pointLng="lng"
            pointAltitude={0.018}
            pointRadius={(item: object) => selectedPin?.id === asTourPin(item).id ? 0.32 : 0.22}
            pointColor={(item: object) => selectedPin?.id === asTourPin(item).id ? '#ff8b3d' : '#f8f4df'}
            pointsTransitionDuration={500}
            ringsData={isInteractive ? TOUR_PINS : []}
            ringLat="lat"
            ringLng="lng"
            ringColor={(item: object) => selectedPin?.id === asTourPin(item).id ? 'rgba(255,139,61,0.82)' : 'rgba(255,255,255,0.32)'}
            ringMaxRadius={(item: object) => selectedPin?.id === asTourPin(item).id ? 4.2 : 2.4}
            ringPropagationSpeed={0.8}
            ringRepeatPeriod={1700}
            arcsData={isInteractive ? ROUTE_ARCS : []}
            arcStartLat="startLat"
            arcStartLng="startLng"
            arcEndLat="endLat"
            arcEndLng="endLng"
            arcColor={() => ['rgba(255,119,32,0.0)', 'rgba(255,119,32,0.95)', 'rgba(255,190,104,0.1)']}
            arcStroke={0.72}
            arcDashLength={0.32}
            arcDashGap={0.92}
            arcDashAnimateTime={2300}
            htmlElementsData={isInteractive ? TOUR_PINS : []}
            htmlLat="lat"
            htmlLng="lng"
            htmlAltitude={0.06}
            htmlElement={createHtmlPin}
            htmlTransitionDuration={450}
            onPointClick={(item: object) => focusPin(asTourPin(item))}
            onLabelClick={(item: object) => focusPin(asTourPin(item))}
            onGlobeReady={handleGlobeReady}
          />
        </div>

        <div className="h4-earth-copy">
          <p className="h4-earth-kicker">Discover the world beyond</p>
          <h1 id="h4-earth-title" className="h4-earth-title">HORIZON</h1>
        </div>

        {selectedPin && (
          <aside className="h4-earth-tour-panel" aria-live="polite">
            <button type="button" className="h4-earth-panel-close" aria-label="Close city details" onClick={() => setSelectedPin(null)}>
              <X size={16} />
            </button>
            <img src={selectedPin.image} alt={`${selectedPin.city} tour preview`} className="h4-earth-panel-image" />
            <div className="h4-earth-panel-body">
              <span className="h4-earth-panel-location">{selectedPin.city}, {selectedPin.country}</span>
              <h2>{selectedPin.headline}</h2>
              <p>{selectedPin.description}</p>
              <div className="h4-earth-panel-meta">
                <span>{selectedMeta}</span>
                <span>{selectedPin.price}</span>
              </div>
              <div className="h4-earth-panel-tags">
                {selectedPin.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            </div>
          </aside>
        )}

        <button type="button" className="h4-earth-discover" onClick={onDiscover}>
          <span>Discover</span>
          <ArrowDown size={18} />
        </button>

        {selectedPin && (
          <div className="h4-earth-route-chip">
            <Plane size={15} />
            <span>{selectedPin.city}</span>
          </div>
        )}
      </div>
    </section>
  );
};
