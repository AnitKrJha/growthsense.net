/**
 * GrowthSense hero ("Send us the mess"): every tunable number lives here.
 *
 * ─── COORDINATE SPACES ──────────────────────────────────────────────────────────────────────────────
 *  px     CSS pixels of the canvas element (`.hero__canvas`).
 *  world  three.js units. The camera sits at (0, 0, camera.z) looking down -Z, never rotates.
 *         On the plane z = 0:   visibleH = 2 · camera.z · tan(fov / 2)      (fov 30°, z 10 → 5.359)
 *                               wpp      = visibleH / canvasHeightPx        (world units per CSS px)
 *  root   A group placed at the centre of the `[data-hero-anchor]` box (projected onto z = 0) and scaled by
 *         `s` world units per paper unit. One sheet is 1 root unit tall (A4: 0.707 × 1).
 *            sPx = min(anchorW / bbox.w, anchorH / bbox.h) · frame.fill
 *            s   = sPx · wpp
 *         `bbox` is the projected bounding box of the final "filed" composition (composition.ts). The poster
 *         SVG uses the same bbox as its viewBox with `meet`, so the poster and the live stack share framing.
 *  desk   Child of root, rotated by desk.tilt about X, so we look at the desk from a seated angle.
 *         Papers, stamp, lights and the shadow catcher live here; +Z is "up, off the desk".
 *         A desk point (x, y, z) lands in root at  y_r = y·cos(t) − z·sin(t),  z_r = y·sin(t) + z·cos(t).
 *         With t = −0.62: cos 0.814, sin −0.581 → height lifts things up the screen (+0.581 per unit).
 *
 * ─── FRAMING CHECKS (measured by projecting 120 s of idle swirl, sheet corners included) ──────────────────
 *  1440 × 900  canvas 1440 × 840, anchor ≈ 499 × 470 → sPx 370. Idle papers span x 684–1479, y 151–794
 *              (a brief ≈40px bleed off the right edge at the extremes; copy column ends ≈ 700px and is masked).
 *  1024 × 768  canvas 1024 × 708, sPx 292. Idle x 484–1102, y 143–646.
 *  768 × 1024  stacked. canvas ≈ 768 × 1100, sPx 323. Idle x 65–673, y 531–1037 (below and behind the copy, dimmed).
 *  360 × 740   stacked. canvas ≈ 360 × 860, sPx 233. Idle x −17–359, y 420–783.
 *  Main levers: idle.rx / ry / scale / height (size of the mess), frame.fill (size of the filed stack),
 *  and the .hero__anchor box in Hero.astro (where the stack sits).
 */

export type DocKind =
  | 'form16'
  | 'ais'
  | 'gstr3b'
  | 'invoice'
  | 'challan280'
  | 'echallan'
  | 'rent'
  | 'bank'
  | 'form16a';

export const HERO = {
  /** Same breakpoint as Hero.astro's two-column layout. Pinning only happens at or above it. */
  desktopQuery: '(min-width: 60rem)',

  camera: { fov: 30, z: 10, near: 0.1, far: 80 },
  /** Device-pixel-ratio clamp. `coarse` = touch-first devices. */
  dpr: { fine: [1, 1.75] as [number, number], coarse: [1, 1.25] as [number, number] },

  frame: {
    /** Multiplier on the fitted scale (1 = the filed composition exactly fills the anchor box). */
    fill: 1,
    /** Nominal s / camera.z used to approximate perspective for the bbox and the poster. */
    nominalPerspective: 0.2,
  },

  /** Sheets, bottom of the final stack first. The last one becomes the acknowledgement. */
  papers: {
    desktop: ['bank', 'echallan', 'rent', 'form16a', 'bank', 'invoice', 'ais', 'challan280', 'echallan', 'invoice', 'gstr3b', 'form16'] as DocKind[],
    mobile: ['bank', 'invoice', 'challan280', 'ais', 'gstr3b', 'form16'] as DocKind[],
  },

  paper: {
    w: 0.707,
    h: 1,
    segments: [10, 14] as [number, number],
    /** Cylindrical bend across the width while floating / when stacked (paper units of lift at the edges). */
    curlIdle: 0.055,
    curlStacked: 0.004,
    /** Lifted top-right corner while floating. */
    cornerIdle: 0.05,
    /** Travelling flutter wave amplitude while floating. */
    flutterIdle: 0.016,
    roughness: 0.9,
    /** Gap between stacked sheets (paper units). */
    stackGap: 0.0055,
  },

  texture: {
    /** Backing-store height in device px (≈2× the largest on-screen size of a sheet). */
    pxH: { desktop: 1024, mobile: 720 },
    anisotropy: 8,
  },

  desk: {
    /** Radians about X. Negative tilts the far edge of the desk away from the camera. */
    tilt: -0.62,
    /** Shadow catcher size (paper units) and strength. */
    size: 7,
    shadowOpacity: 0.34,
    /** Soft contact shadow under the stack (baked radial texture). */
    contactOpacity: 0.55,
  },

  /** Final stack: slots from the top (slot 0 = the sheet that becomes the acknowledgement). */
  stack: {
    center: [0.05, 0.03] as [number, number],
    /** [rotationZ, dx, dy] per slot. Deterministic so the poster matches exactly. */
    slots: [
      [-0.035, 0, 0],
      [0.055, 0.02, 0.012],
      [-0.095, -0.025, -0.01],
      [0.12, 0.035, 0.02],
      [-0.135, -0.03, 0.015],
      [0.08, 0.045, -0.018],
      [-0.055, -0.04, 0.025],
      [0.155, 0.02, -0.01],
      [-0.165, -0.012, 0.03],
      [0.025, 0.05, 0],
      [-0.115, 0, -0.025],
      [0.135, -0.035, 0.01],
    ] as [number, number, number][],
    /** How many slots the static poster draws (slot 0 is drawn as the presented slip). */
    posterSheets: 7,
    posterKinds: ['gstr3b', 'invoice', 'ais', 'bank', 'challan280', 'echallan'] as DocKind[],
  },

  /** Where the acknowledgement slip ends up (desk space): forward, down-left, tilted up to face us. */
  slip: {
    position: [-0.3, -0.5, 0.42] as [number, number, number],
    rotation: [0.5, -0.06, -0.07] as [number, number, number],
    scale: 0.9,
    arc: 0.18,
  },

  /** Stamp impression on the top sheet, in sheet space (paper units, y up). */
  impression: { x: 0.1, y: -0.22, angle: -0.16, w: 0.46, h: 0.2, opacity: 0.9 },

  idle: {
    /** Swirl centre (desk x, y) and radii. rx is clamped at runtime to the room available. */
    center: [-0.2, -0.48] as [number, number],
    rx: 0.5,
    rxMin: 0.34,
    ry: 0.34,
    /** Sheets float a little smaller than they file (they grow as they land). Stacked = single-column layouts. */
    scale: 0.66,
    scaleStacked: 0.6,
    /** Height above the desk, spread across sheets. */
    height: [0.12, 0.42] as [number, number],
    /** Desk-space lift of the whole swirl in the stacked (mobile/tablet) layout. */
    liftStacked: 0.3,
    /** Radians per second around the swirl. */
    spin: 0.05,
    /** Extra positional wander (paper units). */
    wander: 0.05,
    /** Base tilt toward the camera (radians about X, desk space). */
    tiltX: 0.32,
    /** Tumble amplitudes (radians) for X / Y / Z, driven by smooth noise. */
    tumble: [0.5, 0.6, 0.4] as [number, number, number],
    /** Fraction of sheets that slowly flip all the way over, and how fast (rev/s). */
    flipShare: 0.25,
    flipRate: 0.05,
    /** Arc height when flying between idle and stack. */
    arc: 0.28,
  },

  /** First reveal: the sheets burst out of the poster's stack into the swirl. */
  intro: { delay: 0.55, duration: 1.9, stagger: 0.055 },

  story: {
    /** Pinned scroll distance on desktop (vh). The hero stays sticky for exactly this much scroll. */
    pinVh: 110,
    /** GSAP scrub smoothing in seconds. */
    scrub: 0.7,
    /** Scroll progress windows (0–1 over the pin). */
    gather: { start: 0.04, end: 0.48, each: 0.22 },
    stampAt: 0.5,
    /** Scrolling back above this lifts the stamp and wipes the ink. */
    stampReset: 0.44,
    /** Morph (Form 16 → Acknowledgement) and present (slide forward) windows. */
    morph: [0.58, 0.74] as [number, number],
    present: [0.72, 0.95] as [number, number],
    /** Morph waits until the stamp clock passes this (stamp is lifting away). */
    morphGate: 0.78,
    /** Skip the pin on short screens where the copy would not fit under the header. */
    minPinHeight: 640,
  },

  /** Mobile / non-pinned: an auto-played settle → stamp → acknowledgement sequence. */
  auto: {
    /** Plays when this fraction of the hero has scrolled past the top… */
    scrollFraction: 0.35,
    /** …or this long after the canvas became live, whichever comes first. */
    delayMs: 5200,
    duration: 3.8,
  },

  /** Time-based stamp action (seconds), so the drop always feels physical whatever the scroll speed. */
  stamp: {
    duration: 1.35,
    /** Phase ends as fractions of `duration`. */
    phases: { enter: 0.3, windup: 0.42, contact: 0.5, squash: 0.56, settle: 0.66, lift: 0.74 },
    /** Enters from / exits to these offsets (desk space, relative to the impression point). */
    from: [0.55, 0.5, 2.4] as [number, number, number],
    to: [0.45, 0.65, 2.8] as [number, number, number],
    hoverZ: 0.6,
    windupZ: 0.72,
    squash: 0.86,
    bounce: 0.025,
    /** Ink spreads over this stamp-clock window. */
    ink: [0.5, 0.64] as [number, number],
    /** Tiny root "thud" at contact (paper units). */
    thud: 0.006,
  },

  parallax: { rotY: 0.07, rotX: 0.04, damping: 2.6, filedFactor: 0.5 },

  lights: {
    hemi: { intensity: 1.25 },
    key: { intensity: 2.2, position: [-1.6, 2.4, 4.2] as [number, number, number], radius: 5, bias: -0.0004 },
    rim: { intensity: 0.55, position: [2.6, -1.4, 1.3] as [number, number, number] },
    shadowMap: { desktop: 1024, mobile: 512 },
    /** Orthographic shadow frustum half-size (paper units). */
    shadowExtent: 2.4,
  },
} as const;

export type HeroConfig = typeof HERO;
