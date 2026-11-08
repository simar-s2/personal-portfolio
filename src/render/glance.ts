// The small live render beside the project list. One WebGL context for all five projects:
// pointing at a project swaps its scene in, and the compiled shaders are reused.

import { build, type Built } from './build';
import { Camera } from './camera';
import { Focus } from './focus';
import { palettes, Renderer } from './renderer';
import type { REntry } from './types';

export interface Glance {
  show(id: string): void; // loads the project if it isn't the current one, then runs
  stop(): void;
}

export function glance(canvas: HTMLCanvasElement, entries: REntry[], onDraw: () => void): Glance | null {
  let renderer: Renderer;
  try {
    renderer = new Renderer(canvas);
  } catch (error) {
    console.warn('Keeping the static image:', error);
    return null;
  }

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cam = new Camera();
  const cache = new Map<string, Built>();
  let current = '';
  let built: Built | null = null;
  let focus: Focus | null = null;
  let states = {
    block: renderer.blockState,
    curve: renderer.curveState,
    packet: renderer.packetState,
  };
  let home = { az: 0, el: 0 };
  let force = true;
  let dirty = true;
  let swing = 0;
  let time = 0;
  let width = 0;
  let height = 0;
  const dpr = Math.min(devicePixelRatio || 1, 2);

  const palette = () => palettes[document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'];
  new MutationObserver(() => {
    dirty = true;
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  let raf = 0;
  let last = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const gap = now - last;
    if (gap < 14) return; // About 60 fps at most, like the main render.
    last = now;
    const dt = Math.min(gap / 1000, 0.1);
    if (!built || !focus) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w !== width || h !== height) {
      width = w;
      height = h;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      dirty = true;
    }

    if (focus.tick(dt, states, force)) {
      renderer.writeStates();
      force = false;
      dirty = true;
    }

    if (!calm) {
      // Swings into place, then drifts a little wider than the main render so it reads as live.
      time += dt;
      swing *= Math.exp(-dt * 2.6);
      cam.az = home.az + swing + Math.sin(time * 0.4) * 0.16;
      cam.el = home.el + Math.sin(time * 0.27) * 0.03;
      dirty = true;
    }
    if (!dirty) return;
    dirty = false;

    cam.fit(built.bounds, width / Math.max(height, 1));
    cam.update();
    renderer.draw(cam, time, palette(), width);
    onDraw();
  };

  canvas.addEventListener('webglcontextlost', () => {
    cancelAnimationFrame(raf);
    raf = 0;
    built = null;
  });

  return {
    show(id) {
      const entry = entries.find((e) => e.id === id);
      if (!entry) return;
      if (id !== current) {
        current = id;
        built = cache.get(id) ?? build(entry.scene);
        cache.set(id, built);
        renderer.load(built);
        states = {
          block: renderer.blockState,
          curve: renderer.curveState,
          packet: renderer.packetState,
        };
        focus = new Focus(entry.scene, built);
        force = true;
        dirty = true;
        home = {
          az: entry.scene.camera?.az ?? -0.62,
          el: entry.scene.camera?.el ?? 0.62,
        };
        cam.az = home.az;
        cam.el = home.el;
        // Closer than the main render: there are no labels here to leave room for.
        cam.zoom = (entry.scene.camera?.zoom ?? 1) * 1.1;
        swing = calm ? 0 : 0.24;
      }
      if (!raf && built) {
        last = performance.now() - 16;
        raf = requestAnimationFrame(frame);
      }
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
