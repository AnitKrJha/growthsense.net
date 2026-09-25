/**
 * Hero canvas island (client:idle). Decides whether the live 3D scene should run at all, then code-splits
 * three.js / R3F / GSAP in via a dynamic import, so the hero HTML (headline, CTAs, poster) never waits on it.
 *
 * The poster stays on screen when: reduced motion is on, WebGL is missing, or the scene throws.
 */
import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import type { HeroHost } from './scene/HeroScene';

const HeroScene = lazy(() => import('./scene/HeroScene'));

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[GrowthSense hero] 3D scene failed; showing the still poster instead.', error);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function HeroCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HeroHost | null>(null);

  useEffect(() => {
    const section = ref.current?.closest<HTMLElement>('[data-hero]');
    if (!section) return;
    const q = (sel: string) => section.querySelector<HTMLElement>(sel);
    const track = q('[data-hero-track]');
    const stage = q('[data-hero-stage]');
    const anchor = q('[data-hero-anchor]');
    const copy = q('[data-hero-copy]');
    if (!track || !stage || !anchor || !copy) return;

    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const decide = () => {
      if (reduce.matches || !hasWebGL()) {
        console.info(
          reduce.matches
            ? '[GrowthSense hero] "Reduce motion" is on in system settings: showing the still poster.'
            : '[GrowthSense hero] WebGL is unavailable: showing the still poster.',
        );
        section.dataset.story = 'off';
        delete section.dataset.live;
        setHost(null);
      } else {
        section.dataset.story = 'on';
        setHost({ section, track, stage, anchor, copy });
      }
    };
    decide();
    reduce.addEventListener('change', decide);
    return () => reduce.removeEventListener('change', decide);
  }, []);

  const fail = () => {
    const section = ref.current?.closest<HTMLElement>('[data-hero]');
    if (section) {
      section.dataset.story = 'off';
      delete section.dataset.live;
    }
    setHost(null);
  };

  return (
    <div ref={ref} className="hero__canvas-host">
      {host && (
        <SceneBoundary onError={fail}>
          <Suspense fallback={null}>
            <HeroScene host={host} />
          </Suspense>
        </SceneBoundary>
      )}
    </div>
  );
}
