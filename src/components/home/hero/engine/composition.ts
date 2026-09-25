/**
 * Pure pose maths shared by the live scene (client) and the static poster (build time, in Hero.astro).
 * Keeping both on the same numbers is what makes hydration feel seamless.
 */
import { Euler, Quaternion, Vector3 } from 'three';
import { HERO } from './config';

export interface Pose {
  p: Vector3;
  q: Quaternion;
  s: number;
}

export const newPose = (): Pose => ({ p: new Vector3(), q: new Quaternion(), s: 1 });

const deskQ = new Quaternion().setFromEuler(new Euler(HERO.desk.tilt, 0, 0));
const _e = new Euler();
const _v = new Vector3();

/** Final pose of stack slot `slot` (0 = top) in a stack of `count` sheets, desk space. */
export function stackPose(slot: number, count: number, out: Pose = newPose()): Pose {
  const slots = HERO.stack.slots;
  const [rz, dx, dy] = slots[Math.min(slot, slots.length - 1)];
  const z = (count - 1 - slot) * HERO.paper.stackGap;
  out.p.set(HERO.stack.center[0] + dx, HERO.stack.center[1] + dy, z);
  out.q.setFromEuler(_e.set(0, 0, rz));
  out.s = 1;
  return out;
}

/** Where the acknowledgement slip rests once presented, desk space. */
export function presentPose(out: Pose = newPose()): Pose {
  const { position, rotation, scale } = HERO.slip;
  out.p.set(position[0], position[1], position[2]);
  out.q.setFromEuler(_e.set(rotation[0], rotation[1], rotation[2], 'XYZ'));
  out.s = scale;
  return out;
}

/** Desk space → root space (no perspective). */
export function deskToRoot(v: Vector3, out = new Vector3()): Vector3 {
  return out.copy(v).applyQuaternion(deskQ);
}

/** Root space → 2D with the nominal perspective (x right, y up). */
export function project(v: Vector3, k = HERO.frame.nominalPerspective): [number, number] {
  const f = 1 / (1 - k * v.z);
  return [v.x * f, v.y * f];
}

/** Sheet-local point (paper units, y up) → desk space for a given pose. */
export function sheetToDesk(pose: Pose, x: number, y: number, z = 0, out = new Vector3()): Vector3 {
  return out.set(x * pose.s, y * pose.s, z).applyQuaternion(pose.q).add(pose.p);
}

/** Direction toward the key light in desk space (used to fake shadows in the poster). */
const L = HERO.lights.key.position;
/** Project a desk-space point along the key light onto the desk plane (z = 0). */
export function shadowOnDesk(v: Vector3, out = new Vector3()): Vector3 {
  const t = v.z / L[2];
  return out.set(v.x - L[0] * t, v.y - L[1] * t, 0);
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/** Projected bounds (root units) of the filed composition, before centring. */
export function compositionBounds(): Bounds {
  const W = HERO.paper.w / 2;
  const H = HERO.paper.h / 2;
  const n = HERO.stack.posterSheets;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const add = (pose: Pose) => {
    for (const [x, y] of [[-W, -H], [W, -H], [W, H], [-W, H]] as const) {
      const [px, py] = project(deskToRoot(sheetToDesk(pose, x, y, 0, _v), _v));
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
  };
  const pose = newPose();
  for (let slot = 1; slot < n; slot++) add(stackPose(slot, n, pose));
  add(presentPose(pose));
  // A little breathing room for shadows and the fan of extra desktop sheets.
  const pad = 0.04;
  minX -= pad; maxX += pad; minY -= pad; maxY += pad;
  return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
}

export const BOUNDS = compositionBounds();
