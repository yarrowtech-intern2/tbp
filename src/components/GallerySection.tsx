import React, { useEffect, useRef, useState } from 'react';
import './GallerySection.css';

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_SPEED  = 0.000062; // rad/ms  (full orbit ≈ 100 s — slow drift)
const SQUISH_R    = 370;      // px — radius of squish influence
const SQUISH_STR  = 0.64;     // max scale reduction for neighbours (aggressive)
const HOVER_SCALE = 2.3;      // hovered image scale multiplier (much bigger)
const PUSH_MAG    = 38;       // max px neighbour push
const PARALLAX_X  = 28;       // max px horizontal parallax
const PARALLAX_Y  = 18;       // max px vertical parallax

/** Ring 0 is the centre; rings 1-4 orbit. Alternating directions. */
const RING_CFG = [
  { count:  1, radius:   0, size: 224, speed: 0.00, dir:  1 },
  { count:  9, radius: 272, size: 155, speed: 1.00, dir:  1 },
  { count: 14, radius: 476, size: 112, speed: 0.72, dir: -1 },
  { count: 19, radius: 670, size:  80, speed: 1.15, dir:  1 },
  { count: 23, radius: 858, size:  60, speed: 0.88, dir: -1 },
] as const;

// ─── Static image data (built once at module load) ────────────────────────────

interface GalItem {
  id:        number;
  src:       string;
  ring:      number;
  baseAngle: number;
  radius:    number;
  size:      number;
  speed:     number;
  dir:       number;
}

const GAL_ITEMS: GalItem[] = [];
let _seed = 0;

RING_CFG.forEach((ring, ringIdx) => {
  for (let i = 0; i < ring.count; i++) {
    _seed++;
    GAL_ITEMS.push({
      id:        _seed - 1,
      src:       `https://picsum.photos/seed/tbpgal${_seed}/400/400`,
      ring:      ringIdx,
      baseAngle: ring.count === 1 ? 0 : (2 * Math.PI * i) / ring.count - Math.PI / 2,
      radius:    ring.radius,
      size:      ring.size,
      speed:     ring.speed,
      dir:       ring.dir,
    });
  }
});

// ─── Spring helper ────────────────────────────────────────────────────────────

function springStep(
  pos: number,
  vel: number,
  target: number,
  stiffness = 0.14,
  damping   = 0.76,
): [number, number] {
  const newVel = (vel + (target - pos) * stiffness) * damping;
  return [pos + newVel, newVel];
}

// ─── Component ────────────────────────────────────────────────────────────────

const GallerySection: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef     = useRef<number>(0);
  const lastTRef   = useRef<number | null>(null);
  const itemEls    = useRef<Map<number, HTMLDivElement>>(new Map());

  // All per-frame state lives in refs (zero re-renders per frame)
  const rotRef    = useRef(0);
  const hovIdRef  = useRef<number | null>(null);
  const hSpring   = useRef<[number, number]>([0, 0]);
  const mxSpring  = useRef<[number, number]>([0, 0]);
  const mySpring  = useRef<[number, number]>([0, 0]);
  const mxTarget  = useRef(0);
  const myTarget  = useRef(0);
  const reducedM  = useRef(false);

  // One re-render per hover change — only for z-index
  const [topId, setTopId] = useState<number | null>(null);

  useEffect(() => {
    reducedM.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const section = sectionRef.current;

    const onMouseMove = (e: MouseEvent) => {
      if (!section) return;
      const r  = section.getBoundingClientRect();
      mxTarget.current = ((e.clientX - r.left) - r.width  / 2) / (r.width  / 2);
      myTarget.current = ((e.clientY - r.top)  - r.height / 2) / (r.height / 2);
    };

    section?.addEventListener('mousemove', onMouseMove);

    const tick = (t: number) => {
      if (lastTRef.current !== null) {
        const dt = Math.min(t - lastTRef.current, 50);

        // ── Rotation (pauses on hover; disabled on reduced-motion) ────────
        if (!reducedM.current && hovIdRef.current === null) {
          rotRef.current += BASE_SPEED * dt;
        }
        const rot = rotRef.current;

        // ── Hover spring (with natural overshoot for "pop" feel) ──────────
        const [hp, hv] = springStep(
          hSpring.current[0], hSpring.current[1],
          hovIdRef.current !== null ? 1 : 0,
        );
        hSpring.current = [hp, hv];
        const hp01 = Math.max(0, hp); // floor at 0; allow small overshoot above 1

        // ── Mouse parallax spring ─────────────────────────────────────────
        const [mx, mvx] = springStep(mxSpring.current[0], mxSpring.current[1], mxTarget.current, 0.055, 0.83);
        const [my, mvy] = springStep(mySpring.current[0], mySpring.current[1], myTarget.current, 0.055, 0.83);
        mxSpring.current = [mx, mvx];
        mySpring.current = [my, mvy];

        if (wrapperRef.current) {
          wrapperRef.current.style.transform = `translate(${(mx * PARALLAX_X).toFixed(2)}px,${(my * PARALLAX_Y).toFixed(2)}px)`;
        }

        // ── Hovered image world-space position ────────────────────────────
        const hovId = hovIdRef.current;
        let hovWx = 0, hovWy = 0;
        if (hovId !== null) {
          const hi  = GAL_ITEMS[hovId];
          const ha  = hi.baseAngle + rot * hi.speed * hi.dir;
          hovWx = Math.cos(ha) * hi.radius;
          hovWy = Math.sin(ha) * hi.radius;
        }

        // ── Per-image transform ───────────────────────────────────────────
        for (const item of GAL_ITEMS) {
          const el = itemEls.current.get(item.id);
          if (!el) continue;

          const angle = item.baseAngle + rot * item.speed * item.dir;
          const wx    = Math.cos(angle) * item.radius;
          const wy    = Math.sin(angle) * item.radius;

          let scale = 1;
          let pushX = 0;
          let pushY = 0;

          if (hp01 > 0.01 && hovId !== null) {
            if (item.id === hovId) {
              // Hovered image expands (with overshoot allowed)
              scale = 1 + (HOVER_SCALE - 1) * hp01;
            } else {
              const ddx  = wx - hovWx;
              const ddy  = wy - hovWy;
              const dist = Math.sqrt(ddx * ddx + ddy * ddy);

              if (dist < SQUISH_R) {
                const norm = Math.max(dist, 1);
                // Influence capped at 1 even with overshoot, for clean squish
                const inf  = (1 - dist / SQUISH_R) * Math.min(hp01, 1);
                const inf2 = inf * inf; // quadratic falloff = more physical feel

                scale = 1 - SQUISH_STR * inf2;
                pushX = (ddx / norm) * PUSH_MAG * inf;
                pushY = (ddy / norm) * PUSH_MAG * inf;
              }
            }
          }

          el.style.transform = `translate(calc(-50% + ${(wx + pushX).toFixed(2)}px),calc(-50% + ${(wy + pushY).toFixed(2)}px)) scale(${scale.toFixed(4)})`;
        }
      }

      lastTRef.current = t;
      rafRef.current   = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      section?.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return (
    <section ref={sectionRef} className="gal-section" aria-label="Photo Gallery">
      <div className="gal-bg-pattern" aria-hidden="true" />

      {/* wrapperRef receives parallax transform from RAF */}
      <div ref={wrapperRef} className="gal-parallax">
        <div className="gal-stage">
          {GAL_ITEMS.map((item) => (
            <div
              key={item.id}
              ref={(el) => {
                if (el) itemEls.current.set(item.id, el);
                else     itemEls.current.delete(item.id);
              }}
              className="gal-item"
              data-ring={item.ring}
              style={{
                width:  item.size,
                height: item.size,
                zIndex: item.id === topId ? 20 : 10 - item.ring * 2,
              }}
              onMouseEnter={() => { hovIdRef.current = item.id; setTopId(item.id); }}
              onMouseLeave={() => { hovIdRef.current = null;    setTopId(null);    }}
            >
              <img
                src={item.src}
                alt=""
                className="gal-img"
                loading="lazy"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default GallerySection;
