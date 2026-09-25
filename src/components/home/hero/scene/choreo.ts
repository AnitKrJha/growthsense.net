/**
 * Frame-by-frame choreography of the hero, independent of React. Given elapsed time and story progress P
 * (0 = the mess, 1 = filed and presented) it produces a pose for every sheet, the stamp, and the scalar
 * effects (ink, morph, curl). Allocation-free per frame.
 *
 * Timeline
 *   intro   The canvas takes over from the poster in the *filed* state, then "rewinds": the slip returns,
 *           the ink fades and the stack bursts into the swirl (HERO.intro).
 *   idle    Papers drift around a loose ellipse with smooth-noise tumble.
 *   gather  P sweeps each sheet (bottom first) from its idle pose into its stack slot (HERO.story.gather).
 *   stamp   Crossing HERO.story.stampAt fires a time-based stamp action, so the drop always feels physical.
 *   morph   The top Form 16 cross-fades into the acknowledgement slip, which then slides forward (present).
 */
import { MathUtils, Quaternion, Vector3, Euler } from 'three';
import { HERO } from '../engine/config';
import { newPose, presentPose, sheetToDesk, stackPose, type Pose } from '../engine/composition';

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const easeInOutCubic = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp01(x)));
const easeInQuad = (x: number) => clamp01(x) ** 2;
const map = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
/** Frame-rate independent exponential damping. */
const damp = (cur: number, target: number, lambda: number, dt: number) => MathUtils.damp(cur, target, lambda, dt);

/** Cheap smooth 1D noise in [-1, 1]. */
const sn = (x: number) => 0.62 * Math.sin(x) + 0.28 * Math.sin(x * 2.13 + 1.7) + 0.1 * Math.sin(x * 4.71 + 0.3);
const hash = (i: number, k: number) => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export interface SheetFrame {
  pose: Pose;
  /** 0 = floating, 1 = stacked (drives curl). */
  settle: number;
}

export interface StampFrame {
  visible: boolean;
  pos: Vector3;
  rotZ: number;
  /** Z scale of the stamp body (squash). */
  squash: number;
}

export class Choreographer {
  readonly count: number;
  readonly sheets: SheetFrame[];
  readonly stamp: StampFrame = { visible: false, pos: new Vector3(), rotZ: 0, squash: 1 };

  /** Effects, all 0..1. */
  ink = 1;
  morph = 1;
  present = 1;
  /** Mean settle across sheets, for the contact shadow and parallax. */
  filed = 1;
  /** Downward "thud" offset for the root at stamp contact (paper units). */
  thud = 0;

  /** Runtime-clamped swirl radius (see HeroScene layout). */
  rx: number = HERO.idle.rx;
  /** Desk-space lift of the swirl in stacked layouts. */
  lift = 0;
  /** Floating sheet scale (set from layout). */
  idleScale: number = HERO.idle.scale;

  private stamped = false;
  private stampClock = -1;
  private introStart = 0;
  private introOn = false;
  private idle: Pose[];
  private stackPoses: Pose[];
  private present0 = presentPose();
  private stampTarget = new Vector3();
  private stampRotZ = 0;
  private qa = new Quaternion();
  private e = new Euler();
  private va = new Vector3();

  constructor(count: number) {
    this.count = count;
    this.sheets = Array.from({ length: count }, () => ({ pose: newPose(), settle: 1 }));
    this.idle = Array.from({ length: count }, () => newPose());
    this.stackPoses = Array.from({ length: count }, (_, i) => stackPose(this.slotOf(i), count));
    // Stamp lands on the impression point of the top sheet, as it lies in the stack.
    const top = this.stackPoses[count - 1];
    const imp = HERO.impression;
    sheetToDesk(top, imp.x, imp.y, 0.004, this.stampTarget);
    this.e.setFromQuaternion(top.q);
    this.stampRotZ = this.e.z + imp.angle;
  }

  /** Sheet index in HERO.papers order (0 = bottom) → stack slot (0 = top). */
  slotOf(i: number) {
    return this.count - 1 - i;
  }

  /** Call once when the canvas becomes live. */
  startIntro(t: number) {
    this.introStart = t;
    this.introOn = true;
  }

  private idlePose(i: number, t: number, out: Pose) {
    const I = HERO.idle;
    const n = this.count;
    const ph = hash(i, 1) * 10;
    const theta = (i / n) * Math.PI * 2 + t * I.spin + hash(i, 2) * 0.6;
    const x = I.center[0] + this.rx * Math.cos(theta) + I.wander * sn(t * 0.21 + ph);
    const y = I.center[1] + I.ry * Math.sin(theta) + I.wander * sn(t * 0.17 + ph + 3.1) + this.lift;
    const z = MathUtils.lerp(I.height[0], I.height[1], hash(i, 3)) + 0.07 * sn(t * 0.33 + ph + 5.2);
    const flips = hash(i, 4) < I.flipShare;
    const rx = I.tiltX + I.tumble[0] * 0.5 * sn(t * 0.23 + ph + 1.3);
    const ry = I.tumble[1] * 0.5 * sn(t * 0.19 + ph + 2.2) + (flips ? t * I.flipRate * Math.PI * 2 * (hash(i, 5) > 0.5 ? 1 : -1) : 0);
    const rz = (hash(i, 6) - 0.5) * 1.6 + I.tumble[2] * 0.5 * sn(t * 0.15 + ph + 4.4);
    out.p.set(x, y, z);
    out.q.setFromEuler(this.e.set(rx, ry, rz, 'ZXY'));
    out.s = this.idleScale;
    return out;
  }

  /**
   * Advance one frame.
   * @param t   seconds since the scene mounted
   * @param dt  frame delta (clamped by caller)
   * @param P   story progress 0..1 (already scrub-smoothed)
   */
  update(t: number, dt: number, P: number) {
    const n = this.count;
    const S = HERO.story;
    const G = S.gather;
    const intro = HERO.intro;
    const introOn = this.introOn;
    const it = introOn ? t - this.introStart - intro.delay : 0;

    /* ── intro "rewind" values (1 = still filed) ── */
    const iPresent = introOn ? 1 - easeInOutCubic(it / (intro.duration * 0.28)) : 1;
    const iMorph = introOn ? 1 - smooth((it - intro.duration * 0.12) / (intro.duration * 0.2)) : 1;
    const iInk = introOn ? 1 - smooth(it / (intro.duration * 0.22)) : 1;

    /* ── stamp trigger (time-based) ── */
    let gatheredMin = 1;
    const gather: number[] = this.gatherScratch ?? (this.gatherScratch = new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      const start = G.start + (G.end - G.each - G.start) * (n === 1 ? 0 : i / (n - 1));
      const g = map(P, start, start + G.each);
      gather[i] = g;
      gatheredMin = Math.min(gatheredMin, g);
    }
    if (!this.stamped && P >= S.stampAt && gatheredMin > 0.97) {
      this.stamped = true;
      this.stampClock = 0;
    } else if (this.stamped && P < S.stampReset) {
      this.stamped = false;
      this.stampClock = -1;
    }
    const D = HERO.stamp.duration;
    if (this.stampClock >= 0) this.stampClock = Math.min(D, this.stampClock + dt);
    const sc = this.stampClock < 0 ? 0 : this.stampClock / D;

    /* ── effects ── */
    const storyInk = this.stamped ? smooth(map(sc, HERO.stamp.ink[0], HERO.stamp.ink[1])) : 0;
    const gateOpen = this.stamped && sc >= S.morphGate;
    const Pm = gateOpen ? P : Math.min(P, S.stampAt);
    const storyMorph = smooth(map(Pm, S.morph[0], S.morph[1]));
    const storyPresent = easeInOutCubic(map(Pm, S.present[0], S.present[1]));
    // Ink appears exactly on contact; fading out (scrolling back) is damped.
    const inkTarget = Math.max(storyInk, iInk);
    this.ink = inkTarget > this.ink ? inkTarget : damp(this.ink, inkTarget, 6, dt);
    this.morph = damp(this.morph, Math.max(storyMorph, iMorph), 9, dt);
    this.present = damp(this.present, Math.max(storyPresent, iPresent), 7, dt);

    /* ── sheets ── */
    let settleSum = 0;
    for (let i = 0; i < n; i++) {
      const slot = this.slotOf(i);
      const iGather = introOn
        ? 1 - easeInOutCubic((it - intro.duration * 0.18 - slot * intro.stagger) / (intro.duration * 0.62))
        : 1;
      const g = Math.max(gather[i], iGather);
      const e = easeInOutCubic(g);
      const idle = this.idlePose(i, t, this.idle[i]);
      const stack = this.stackPoses[i];
      const out = this.sheets[i];
      out.pose.p.lerpVectors(idle.p, stack.p, e);
      out.pose.p.z += HERO.idle.arc * Math.sin(Math.PI * e) * (1 - e * 0.5);
      out.pose.q.slerpQuaternions(idle.q, stack.q, e);
      out.pose.s = MathUtils.lerp(idle.s, 1, e);
      out.settle = e;
      settleSum += e;

      if (slot === 0 && this.present > 0.0005) {
        // Slide the (morphed) top sheet forward to the presented pose, with a small lift on the way.
        const pr = this.present;
        const pp = this.present0;
        this.va.copy(out.pose.p);
        out.pose.p.lerpVectors(this.va, pp.p, pr);
        out.pose.p.z += HERO.slip.arc * Math.sin(Math.PI * pr);
        this.qa.copy(out.pose.q);
        out.pose.q.slerpQuaternions(this.qa, pp.q, pr);
        out.pose.s = MathUtils.lerp(1, pp.s, pr);
      }
    }
    this.filed = settleSum / n;

    /* ── stamp ── */
    this.updateStamp(sc, dt);
  }

  private gatherScratch?: number[];

  private updateStamp(sc: number, dt: number) {
    const st = this.stamp;
    const K = HERO.stamp;
    const ph = K.phases;
    const T = this.stampTarget;
    st.visible = this.stamped && sc > 0 && sc < 1;
    st.rotZ = this.stampRotZ;
    st.squash = 1;
    let ox = 0, oy = 0, oz = 0;
    if (sc < ph.enter) {
      const k = easeOutExpo(sc / ph.enter);
      ox = MathUtils.lerp(K.from[0], 0, k);
      oy = MathUtils.lerp(K.from[1], 0, k);
      oz = MathUtils.lerp(K.from[2], K.hoverZ, k);
    } else if (sc < ph.windup) {
      oz = MathUtils.lerp(K.hoverZ, K.windupZ, smooth(map(sc, ph.enter, ph.windup)));
    } else if (sc < ph.contact) {
      oz = MathUtils.lerp(K.windupZ, 0, easeInQuad(map(sc, ph.windup, ph.contact)));
    } else if (sc < ph.squash) {
      st.squash = MathUtils.lerp(1, K.squash, smooth(map(sc, ph.contact, ph.squash)));
    } else if (sc < ph.settle) {
      const k = map(sc, ph.squash, ph.settle);
      st.squash = MathUtils.lerp(K.squash, 1, easeOutExpo(k));
      oz = K.bounce * Math.sin(Math.PI * k);
    } else if (sc < ph.lift) {
      oz = 0;
    } else {
      const k = smooth(map(sc, ph.lift, 1));
      ox = MathUtils.lerp(0, K.to[0], k);
      oy = MathUtils.lerp(0, K.to[1], k);
      oz = MathUtils.lerp(0, K.to[2], k * k);
    }
    st.pos.set(T.x + ox, T.y + oy, T.z + oz);
    // Thud: a short dip at contact that decays.
    const hit = this.stamped && sc >= ph.contact && sc < ph.settle;
    this.thud = hit ? K.thud * (1 - map(sc, ph.contact, ph.settle)) : damp(this.thud, 0, 20, dt);
  }
}
