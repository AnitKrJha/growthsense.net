/**
 * The live hero scene (client only, code-split). See engine/config.ts for every tunable and the framing maths.
 *
 *   HeroScene   <Canvas> + visibility-driven frameloop
 *   World       textures, meshes, layout sync, pointer/touch/scroll lean, and the per-frame apply step
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CanvasTexture,
  Group,
  MathUtils,
  Mesh,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
  type DirectionalLight,
  type MeshBasicMaterial,
  type Object3D,
  type ShaderMaterial,
  type Texture,
} from 'three';
import { HERO, type DocKind } from '../engine/config';
import { BOUNDS } from '../engine/composition';
import { docLayout, impressionLayout, IMPRESSION_H, IMPRESSION_W } from '../docs/layouts';
import { loadDocFonts, renderBack, renderDoc, renderInkNoise, renderPrims } from '../docs/canvas';
import { createInkMaterial, createPaperMaterial, type PaperMaterial } from './materials';
import { Choreographer } from './choreo';


export interface HeroHost {
  section: HTMLElement;
  track: HTMLElement;
  stage: HTMLElement;
  anchor: HTMLElement;
  copy: HTMLElement;
}


export default function HeroScene({ host }: { host: HeroHost }) {
  const coarse = useMemo(() => matchMedia('(pointer: coarse)').matches, []);
  const [active, setActive] = useState(true);

  useEffect(() => {
    let onScreen = true;
    const sync = () => setActive(onScreen && document.visibilityState === 'visible');
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      sync();
    });
    io.observe(host.section);
    document.addEventListener('visibilitychange', sync);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [host]);

  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={coarse ? HERO.dpr.coarse : HERO.dpr.fine}
      shadows="percentage"
      flat
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: HERO.camera.fov, position: [0, 0, HERO.camera.z], near: HERO.camera.near, far: HERO.camera.far }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <World host={host} />
    </Canvas>
  );
}

interface Assets {
  kinds: DocKind[];
  maps: Map<DocKind, Texture>;
  back: Texture;
  ack: Texture;
  impression: Texture;
  noise: Texture;
  contact: Texture;
  all: Texture[];
}

function useAssets(mobile: boolean) {
  const gl = useThree((s) => s.gl);
  const [assets, setAssets] = useState<Assets | null>(null);
  useEffect(() => {
    let cancelled = false;
    let built: Assets | null = null;
    (async () => {
      await loadDocFonts();
      if (cancelled) return;
      const pxH = mobile ? HERO.texture.pxH.mobile : HERO.texture.pxH.desktop;
      const aniso = Math.min(HERO.texture.anisotropy, gl.capabilities.getMaxAnisotropy());
      const all: Texture[] = [];
      const tex = (c: HTMLCanvasElement, srgb = true) => {
        const t = new CanvasTexture(c);
        if (srgb) t.colorSpace = SRGBColorSpace;
        t.anisotropy = aniso;
        all.push(t);
        return t;
      };
      const kinds = [...(mobile ? HERO.papers.mobile : HERO.papers.desktop)];
      const maps = new Map<DocKind, Texture>();
      kinds.forEach((k, i) => {
        if (!maps.has(k)) maps.set(k, tex(renderDoc(docLayout(k), pxH, i + 3)));
      });
      const contactCanvas = document.createElement('canvas');
      contactCanvas.width = contactCanvas.height = 128;
      const cctx = contactCanvas.getContext('2d')!;
      const g = cctx.createRadialGradient(64, 64, 4, 64, 64, 64);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.45)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      cctx.fillStyle = g;
      cctx.fillRect(0, 0, 128, 128);
      built = {
        kinds,
        maps,
        back: tex(renderBack(pxH)),
        ack: tex(renderDoc(docLayout('ack'), pxH, 1)),
        impression: tex(renderPrims(impressionLayout(), IMPRESSION_W, IMPRESSION_H, 512)),
        noise: tex(renderInkNoise(256), false),
        contact: tex(contactCanvas),
        all,
      };
      setAssets(built);
    })();
    return () => {
      cancelled = true;
      built?.all.forEach((t) => t.dispose());
    };
  }, [gl, mobile]);
  return assets;
}

function World({ host }: { host: HeroHost }) {
  const mobile = useMemo(() => !matchMedia(HERO.desktopQuery).matches, []);
  const assets = useAssets(mobile);
  const count = (mobile ? HERO.papers.mobile : HERO.papers.desktop).length;
  const choreo = useMemo(() => new Choreographer(count), [count]);
  /** The filing story is retired: P stays 0 (free-floating swirl). */
  const story = useRef({ P: 0 });
  const scroll = useRef({ target: 0, value: 0 });
  const layout = useRef({ pos: new Vector3(), s: 1 });
  const pointer = useRef({ x: 0, y: 0, sx: 0, sy: 0 });
  const live = useRef({ frames: 0, started: false, lastP: -1 });

  const root = useRef<Group>(null);
  const sheetRefs = useRef<(Group | null)[]>([]);
  const baseRefs = useRef<(Mesh | null)[]>([]);
  const ackRef = useRef<Mesh>(null);
  const inkRef = useRef<Mesh>(null);
  const stampRef = useRef<Group>(null);
  const stampBodyRef = useRef<Group>(null);
  const keyRef = useRef<DirectionalLight>(null);
  const targetRef = useRef<Object3D>(null);
  const contactRef = useRef<Mesh>(null);

  const geometry = useMemo(() => new PlaneGeometry(HERO.paper.w, HERO.paper.h, ...HERO.paper.segments), []);
  const inkGeometry = useMemo(() => new PlaneGeometry(HERO.impression.w, HERO.impression.h), []);
  useEffect(() => () => {
    geometry.dispose();
    inkGeometry.dispose();
  }, [geometry, inkGeometry]);

  const materials = useMemo(() => {
    if (!assets) return null;
    const sheets = assets.kinds.map((k, i) => createPaperMaterial(assets.maps.get(k)!, assets.back, i * 1.7));
    const ack = createPaperMaterial(assets.ack, assets.back, 0);
    ack.transparent = true;
    ack.opacity = 0;
    const ink = createInkMaterial(assets.impression, assets.noise);
    return { sheets, ack, ink };
  }, [assets]);
  useEffect(() => () => {
    materials?.sheets.forEach((m) => m.dispose());
    materials?.ack.dispose();
    materials?.ink.dispose();
  }, [materials]);

  /* ── layout: fit the filed composition to the [data-hero-anchor] box ── */
  useEffect(() => {
    const visibleH = 2 * HERO.camera.z * Math.tan(MathUtils.degToRad(HERO.camera.fov / 2));
    const measure = () => {
      const cr = host.stage.getBoundingClientRect();
      const ar = host.anchor.getBoundingClientRect();
      if (!cr.height || !ar.width) return;
      const wpp = visibleH / cr.height;
      const B = BOUNDS;
      const sPx = Math.min(ar.width / B.w, ar.height / B.h) * HERO.frame.fill;
      const s = sPx * wpp;
      const ax = ar.left + ar.width / 2 - cr.left;
      const ay = ar.top + ar.height / 2 - cr.top;
      layout.current.pos.set((ax - cr.width / 2) * wpp - B.cx * s, (cr.height / 2 - ay) * wpp - B.cy * s, 0);
      layout.current.s = s;
      const stacked = !matchMedia(HERO.desktopQuery).matches;
      // Swirl centre in canvas px; the swirl may use the room to its right (desktop) or both sides (stacked).
      const sx = ax + (HERO.idle.center[0] - B.cx) * sPx;
      const room = stacked ? Math.min(sx, cr.width - sx) : cr.width - sx;
      choreo.idleScale = stacked ? HERO.idle.scaleStacked : HERO.idle.scale;
      choreo.rx = MathUtils.clamp(room / sPx - (HERO.paper.w / 2) * choreo.idleScale * 1.3 - HERO.idle.wander, HERO.idle.rxMin, HERO.idle.rx);
      choreo.lift = stacked ? HERO.idle.liftStacked : 0;
      const cp = host.copy.getBoundingClientRect();
      host.stage.style.setProperty('--hero-mask-x', `${Math.round(cp.right - cr.left)}px`);
      host.stage.style.setProperty('--hero-mask-y', `${Math.round(ar.top - cr.top)}px`);
      const key = keyRef.current;
      if (key) {
        const e = HERO.lights.shadowExtent * s;
        const cam = key.shadow.camera;
        cam.left = cam.bottom = -e;
        cam.right = cam.top = e;
        cam.near = 0.05 * s;
        cam.far = 14 * s;
        cam.updateProjectionMatrix();
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host.stage);
    ro.observe(host.anchor);
    return () => ro.disconnect();
  }, [host, choreo, assets]);

  /* ── interaction: the papers lean toward a mouse pointer, or a finger dragging/scrolling over the hero ── */
  useEffect(() => {
    const aim = (x: number, y: number) => {
      pointer.current.x = MathUtils.clamp((x / innerWidth) * 2 - 1, -1, 1);
      pointer.current.y = MathUtils.clamp((y / innerHeight) * 2 - 1, -1, 1);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') aim(e.clientX, e.clientY);
    };
    // Touch: follow the finger while it is on the hero (fires during scroll too; passive, never blocks scrolling).
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) aim(t.clientX, t.clientY);
    };
    const onTouchEnd = () => {
      pointer.current.x = 0;
      pointer.current.y = 0;
    };
    addEventListener('pointermove', onMove, { passive: true });
    host.section.addEventListener('touchstart', onTouch, { passive: true });
    host.section.addEventListener('touchmove', onTouch, { passive: true });
    host.section.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      removeEventListener('pointermove', onMove);
      host.section.removeEventListener('touchstart', onTouch);
      host.section.removeEventListener('touchmove', onTouch);
      host.section.removeEventListener('touchend', onTouchEnd);
    };
  }, [host]);

  /* ── scroll: no story, just a gentle turn of the swirl as the hero scrolls away (0 → 1 over its height) ── */
  useEffect(() => {
    const onScroll = () => {
      const r = host.section.getBoundingClientRect();
      scroll.current.target = MathUtils.clamp(-r.top / Math.max(r.height, 1), 0, 1);
    };
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, [host]);

  /* ── the key light aims at the desk origin (its target must live in the scene graph) ── */
  useEffect(() => {
    if (keyRef.current && targetRef.current) keyRef.current.target = targetRef.current;
  }, [assets]);

  /* ── per frame ── */
  useFrame((state, delta) => {
    if (!assets || !materials || !root.current) return;
    const dt = Math.min(delta, 1 / 20);
    const t = state.clock.elapsedTime;

    if (!live.current.started) {
      // Two frames on screen in the filed pose, then hand over from the poster and rewind into the mess.
      if (++live.current.frames >= 2) {
        live.current.started = true;
        host.section.dataset.live = '';
        choreo.startIntro(t);
      }
    }

    const P = story.current.P;
    choreo.update(t, dt, P);
    if (Math.abs(P - live.current.lastP) > 0.004) {
      live.current.lastP = P;
      host.section.style.setProperty('--hero-p', P.toFixed(3));
    }

    // Root: fitted transform + stamp thud + pointer parallax (calmer once filed).
    const L = layout.current;
    const r = root.current;
    r.position.copy(L.pos);
    r.scale.setScalar(L.s);
    const pm = pointer.current;
    pm.sx = MathUtils.damp(pm.sx, pm.x, HERO.parallax.damping, dt);
    pm.sy = MathUtils.damp(pm.sy, pm.y, HERO.parallax.damping, dt);
    const calm = MathUtils.lerp(1, HERO.parallax.filedFactor, choreo.filed);
    const sc = scroll.current;
    sc.value = MathUtils.damp(sc.value, sc.target, 3, dt);
    r.rotation.set(
      pm.sy * HERO.parallax.rotX * calm + sc.value * HERO.parallax.scrollTilt,
      pm.sx * HERO.parallax.rotY * calm + sc.value * HERO.parallax.scrollTurn,
      sc.value * HERO.parallax.scrollRoll,
    );
    // The stamp "thud" nudges the whole scene; keep it subtle on phones, where it read as screen shake.
    r.position.y -= choreo.thud * L.s * (mobile ? 0.25 : 1);

    // Sheets.
    const P0 = HERO.paper;
    for (let i = 0; i < choreo.count; i++) {
      const g = sheetRefs.current[i];
      if (!g) continue;
      const f = choreo.sheets[i];
      g.position.copy(f.pose.p);
      g.quaternion.copy(f.pose.q);
      g.scale.setScalar(f.pose.s);
      const u = materials.sheets[i].userData.u;
      const k = f.settle;
      u.uCurl.value = MathUtils.lerp(P0.curlIdle, P0.curlStacked, k);
      u.uCorner.value = P0.cornerIdle * (1 - k);
      u.uFlutter.value = P0.flutterIdle * (1 - k);
      u.uTime.value = t;
    }

    // Top sheet: Form 16 → acknowledgement, with the FILED impression riding on it.
    const top = choreo.count - 1;
    const topU = materials.sheets[top].userData.u;
    const ackU = materials.ack.userData.u;
    ackU.uCurl.value = topU.uCurl.value;
    ackU.uCorner.value = topU.uCorner.value;
    ackU.uFlutter.value = topU.uFlutter.value;
    ackU.uTime.value = t;
    ackU.uPhase.value = topU.uPhase.value;
    materials.ack.opacity = choreo.morph;
    if (ackRef.current) ackRef.current.visible = choreo.morph > 0.002;
    const base = baseRefs.current[top];
    if (base) base.visible = choreo.morph < 0.995;
    (materials.ink as ShaderMaterial).uniforms.uInk.value = choreo.ink;
    if (inkRef.current) inkRef.current.visible = choreo.ink > 0.002;

    // Stamp.
    const st = stampRef.current;
    if (st) {
      st.visible = choreo.stamp.visible;
      st.position.copy(choreo.stamp.pos);
      st.rotation.set(0, 0, choreo.stamp.rotZ);
      if (stampBodyRef.current) stampBodyRef.current.scale.set(1 + (1 - choreo.stamp.squash) * 0.35, 1 + (1 - choreo.stamp.squash) * 0.35, choreo.stamp.squash);
    }

    // Contact shadow under the pile grows as sheets land.
    const c = contactRef.current;
    if (c) (c.material as MeshBasicMaterial).opacity = HERO.desk.contactOpacity * choreo.filed * choreo.filed;
  });

  const deskTilt = HERO.desk.tilt;
  const L = HERO.lights;
  const shadowSize = mobile ? L.shadowMap.mobile : L.shadowMap.desktop;

  return (
    <group ref={root}>
      <group rotation={[deskTilt, 0, 0]}>
        <hemisphereLight args={['#fffaf0', '#0d3926', L.hemi.intensity]} />
        <object3D ref={targetRef} position={[0, 0, 0]} />
        <directionalLight
          ref={keyRef}
          position={L.key.position}
          intensity={L.key.intensity}
          color="#fff6e8"
          castShadow
          shadow-mapSize={[shadowSize, shadowSize]}
          shadow-radius={L.key.radius}
          shadow-bias={L.key.bias}
          shadow-normalBias={0.02}
        />
        <directionalLight position={L.rim.position} intensity={L.rim.intensity} color="#9ee3bb" />

        {/* Shadow catcher: the desk itself is the CSS background behind the transparent canvas. */}
        <mesh receiveShadow position={[0, 0, -0.002]}>
          <planeGeometry args={[HERO.desk.size, HERO.desk.size]} />
          <shadowMaterial transparent opacity={HERO.desk.shadowOpacity} color="#021008" />
        </mesh>
        {assets && (
          <mesh ref={contactRef} position={[HERO.stack.center[0] + 0.03, HERO.stack.center[1] - 0.03, -0.001]} scale={[1.25, 1.55, 1]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={assets.contact} transparent depthWrite={false} color="#000000" opacity={0} />
          </mesh>
        )}

        {assets &&
          materials &&
          assets.kinds.map((k, i) => {
            const isTop = i === assets.kinds.length - 1;
            return (
              <group key={`${k}-${i}`} ref={(el) => void (sheetRefs.current[i] = el)}>
                <mesh
                  ref={(el) => void (baseRefs.current[i] = el)}
                  geometry={geometry}
                  material={materials.sheets[i] as PaperMaterial}
                  castShadow
                  receiveShadow
                />
                {isTop && (
                  <>
                    <mesh ref={ackRef} geometry={geometry} material={materials.ack} position={[0, 0, 0.0012]} renderOrder={1} castShadow />
                    <mesh
                      ref={inkRef}
                      geometry={inkGeometry}
                      material={materials.ink}
                      position={[HERO.impression.x, HERO.impression.y, 0.0026]}
                      rotation={[0, 0, HERO.impression.angle]}
                      renderOrder={2}
                    />
                  </>
                )}
              </group>
            );
          })}

        {assets && <Stamp groupRef={stampRef} bodyRef={stampBodyRef} />}
      </group>
    </group>
  );
}

/** A rubber stamp built from primitives: wooden block, neck, knob, red rubber pad. Pad bottom sits at z = 0. */
function Stamp({ groupRef, bodyRef }: { groupRef: React.RefObject<Group | null>; bodyRef: React.RefObject<Group | null> }) {
  const w = HERO.impression.w * 1.06;
  const h = HERO.impression.h * 1.12;
  return (
    <group ref={groupRef} visible={false}>
      <group ref={bodyRef}>
        <mesh position={[0, 0, 0.012]} castShadow>
          <boxGeometry args={[w * 0.97, h * 0.95, 0.024]} />
          <meshStandardMaterial color="#b8342a" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0, 0.07]} castShadow>
          <boxGeometry args={[w, h, 0.09]} />
          <meshStandardMaterial color="#0d3926" roughness={0.42} metalness={0.05} />
        </mesh>
        <mesh position={[0, 0, 0.118]} castShadow>
          <boxGeometry args={[w * 1.02, h * 1.04, 0.012]} />
          <meshStandardMaterial color="#c9a45c" roughness={0.35} metalness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.042, 0.16, 24]} />
          <meshStandardMaterial color="#175437" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0, 0.31]} castShadow>
          <sphereGeometry args={[0.068, 32, 20]} />
          <meshStandardMaterial color="#f4efe4" roughness={0.32} />
        </mesh>
      </group>
    </group>
  );
}
