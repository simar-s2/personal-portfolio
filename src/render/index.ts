// Starts a render: sizing, the frame loop, pointer controls and switching between projects.

import { build, type Built } from './build';
import { Camera } from './camera';
import { Focus } from './focus';
import { Labels } from './labels';
import { palettes, Renderer } from './renderer';
import { Story } from './story';
import type { REntry, RScene } from './types';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// How long the home page shows each project before moving to the next.
const TOUR_SECONDS = 9;

export function mount(root: HTMLElement): void {
  const entries = JSON.parse(root.querySelector('[data-scenes]')!.textContent!) as REntry[];
  const stage = root.querySelector<HTMLElement>('.stage')!;
  const canvas = stage.querySelector('canvas')!;
  const labelHost = stage.querySelector<HTMLElement>('.labels')!;

  let renderer: Renderer;
  try {
    renderer = new Renderer(canvas);
  } catch (error) {
    console.warn('Keeping the static image:', error);
    return; // The poster image stays in place.
  }

  const still = location.search.includes('still');
  const calm = still || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cam = new Camera();

  let scene: RScene = entries[0]!.scene;
  let built: Built;
  let focus: Focus;
  let labels: Labels;
  let states = { block: renderer.blockState, curve: renderer.curveState, packet: renderer.packetState };
  let home = { az: cam.az, el: cam.el };
  let dirty = true;
  let forceStates = true;
  let touched = false;
  let swing = 0;
  let spinAz = 0;
  let spinEl = 0;

  const refresh = () => {
    dirty = true;
  };

  const story = new Story(root, (tags) => {
    labels.setTags(tags);
    refresh();
  });

  const cache = new Map<string, Built>();
  const load = (entry: REntry) => {
    scene = entry.scene;
    built = cache.get(entry.id) ?? build(scene);
    cache.set(entry.id, built);
    renderer.load(built);
    states = { block: renderer.blockState, curve: renderer.curveState, packet: renderer.packetState };
    focus = new Focus(scene, built);
    labels?.destroy();
    labels = new Labels(labelHost, scene, built, {
      hover(i) {
        focus.hover = i;
        focus.retarget();
      },
      pick: (i) => story.select(i),
    });
    story.load(entry, focus);

    cam.az = scene.camera?.az ?? -0.62;
    cam.el = scene.camera?.el ?? 0.62;
    cam.zoom = scene.camera?.zoom ?? 1;
    home = { az: cam.az, el: cam.el };
    touched = false;
    spinAz = spinEl = 0;
    forceStates = true;
    refresh();

    const parts = scene.nodes.map((n) => n.label).join(', ');
    canvas.setAttribute('aria-label', `3D architecture of ${entry.title}. Parts: ${parts}.`);
    stage.style.setProperty('view-transition-name', `${entry.id}-render`);
  };
  load(entries[0]!);

  // Size
  let width = 0;
  let height = 0;
  let dpr = Math.min(devicePixelRatio || 1, 2);
  const resize = () => {
    const box = stage.getBoundingClientRect();
    width = box.width;
    height = box.height;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    labels.measure();
    refresh();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  // Theme
  const palette = () => palettes[document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'];
  new MutationObserver(refresh).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  // Tabs. Until someone interacts, the home page moves through the projects on its own,
  // so a visitor sees all five without having to look for them.
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-tab]')];
  const bars = tabs.map((tab) => tab.querySelector<HTMLElement>('.tab-bar'));
  let current = 0;
  let swapTimer = 0;
  let touring = tabs.length > 1 && !calm;
  let hovering = false;
  let tour = 0;

  const stopTour = () => {
    if (!touring) return;
    touring = false;
    bars.forEach((bar) => bar?.style.removeProperty('transform'));
  };
  const select = (i: number) => {
    if (i === current) return;
    current = i;
    tour = 0;
    tabs.forEach((tab, j) => {
      tab.setAttribute('aria-selected', String(j === i));
      bars[j]?.style.removeProperty('transform');
    });
    clearTimeout(swapTimer);
    stage.classList.add('swapping');
    swapTimer = window.setTimeout(
      () => {
        load(entries[i]!);
        swing = calm ? 0 : 0.24;
        stage.classList.remove('swapping');
      },
      calm ? 0 : 170,
    );
  };
  tabs.forEach((tab, i) => tab.addEventListener('click', () => select(i)));
  root.addEventListener('pointerdown', stopTour);
  root.addEventListener('keydown', stopTour);
  root.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') hovering = true;
  });
  root.addEventListener('pointerleave', () => {
    hovering = false;
  });

  // Pointer
  let drag: { x: number; y: number; moved: boolean } | null = null;

  const pick = (x: number, y: number): number | null => {
    const o = cam.eye;
    const d = cam.ray((x / width) * 2 - 1, 1 - (y / height) * 2);
    const box = built.aabb;
    let best: number | null = null;
    let nearest = Infinity;
    for (let i = 0; i < scene.nodes.length; i++) {
      let t0 = 0;
      let t1 = Infinity;
      for (let a = 0; a < 3; a++) {
        const lo = (box[i * 6 + a]! - o[a]!) / d[a]!;
        const hi = (box[i * 6 + 3 + a]! - o[a]!) / d[a]!;
        t0 = Math.max(t0, Math.min(lo, hi));
        t1 = Math.min(t1, Math.max(lo, hi));
      }
      if (t0 <= t1 && t0 < nearest) {
        nearest = t0;
        best = i;
      }
    }
    return best;
  };

  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, moved: false };
    canvas.setPointerCapture(e.pointerId);
    spinAz = spinEl = 0;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) {
      if (e.pointerType === 'mouse') {
        const box = canvas.getBoundingClientRect();
        const hit = pick(e.clientX - box.left, e.clientY - box.top);
        canvas.style.cursor = hit === null ? 'grab' : 'pointer';
        if (hit !== focus.hover) {
          focus.hover = hit;
          focus.retarget();
        }
      }
      return;
    }
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    touched = true;
    root.classList.add('touched');
    drag.x = e.clientX;
    drag.y = e.clientY;
    cam.az -= dx * 0.0062;
    cam.el = clamp(cam.el + dy * 0.0042, 0.2, 1.3);
    spinAz = -dx * 0.28;
    spinEl = dy * 0.18;
    refresh();
  });
  const endDrag = (e: PointerEvent) => {
    if (drag && !drag.moved && e.type === 'pointerup') {
      const box = canvas.getBoundingClientRect();
      story.select(pick(e.clientX - box.left, e.clientY - box.top));
    }
    drag = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => {
    if (!drag && focus.hover !== null) {
      focus.hover = null;
      focus.retarget();
    }
  });
  canvas.addEventListener('dblclick', () => {
    cam.az = home.az;
    cam.el = home.el;
    cam.zoom = scene.camera?.zoom ?? 1;
    refresh();
  });
  canvas.addEventListener('keydown', (e) => {
    const turn = { ArrowLeft: [0.12, 0], ArrowRight: [-0.12, 0], ArrowUp: [0, 0.08], ArrowDown: [0, -0.08] }[e.key];
    if (!turn) return;
    e.preventDefault();
    touched = true;
    cam.az += turn[0]!;
    cam.el = clamp(cam.el + turn[1]!, 0.2, 1.3);
    refresh();
  });
  // Pinch on a trackpad zooms. A plain wheel keeps scrolling the page.
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      cam.zoom = clamp(cam.zoom * (1 - e.deltaY * 0.01), 0.7, 2.4);
      refresh();
    },
    { passive: false },
  );

  // Frame loop. Runs only while the render is on screen and the tab is visible.
  let raf = 0;
  let running = false;
  let lastDraw = 0;
  let time = 0;
  let pace = 16;

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const gap = now - lastDraw;
    if (gap < 14) return; // Never above about 60 fps, even on a 120 Hz screen.
    lastDraw = now;
    const dt = Math.min(gap / 1000, 0.1);

    // On a slow GPU, trade resolution for frame rate rather than lagging.
    if (gap < 250) {
      pace += (gap - pace) * 0.04;
      if (pace > 25 && dpr > 1) {
        dpr = Math.max(1, dpr - 0.34);
        pace = 16;
        resize();
      }
    }

    if (touring && !hovering) {
      tour += dt;
      const bar = bars[current];
      if (bar) bar.style.transform = `scaleX(${Math.min(tour / TOUR_SECONDS, 1).toFixed(3)})`;
      if (tour >= TOUR_SECONDS) select((current + 1) % entries.length);
    }

    const statesMoved = focus.tick(dt, states, forceStates);
    if (statesMoved) {
      renderer.writeStates();
      labels.setStates(focus.nodes);
      forceStates = false;
    }

    const spinning = !drag && (Math.abs(spinAz) > 0.001 || Math.abs(spinEl) > 0.001);
    if (spinning) {
      cam.az += spinAz * dt;
      cam.el = clamp(cam.el + spinEl * dt, 0.2, 1.3);
      const decay = Math.exp(-dt * 4);
      spinAz *= decay;
      spinEl *= decay;
    }

    if (!calm) {
      time += dt;
      if (!touched) {
        // A new scene swings gently into place, then keeps drifting.
        swing *= Math.exp(-dt * 2.6);
        cam.az = home.az + swing + Math.sin(time * 0.17) * 0.09;
        cam.el = home.el + Math.sin(time * 0.11) * 0.018;
      }
    }

    if (calm && !dirty && !statesMoved && !spinning) return;
    dirty = false;
    cam.fit(built.bounds, width / Math.max(height, 1));
    cam.update();
    labels.place(cam, width, height);
    renderer.draw(cam, still ? 0.37 : time, palette(), width);
    if (!root.classList.contains('ready')) {
      root.classList.add('ready');
      (window as unknown as { __renderReady?: boolean }).__renderReady = true;
    }
  };

  const setRunning = (on: boolean) => {
    if (on === running) return;
    running = on;
    if (on) {
      lastDraw = performance.now();
      raf = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(raf);
    }
  };

  let onScreen = false;
  new IntersectionObserver(
    ([entry]) => {
      onScreen = entry!.isIntersecting;
      setRunning(onScreen && !document.hidden);
    },
    { rootMargin: '80px' },
  ).observe(stage);
  document.addEventListener('visibilitychange', () => setRunning(onScreen && !document.hidden));

  canvas.addEventListener('webglcontextlost', () => {
    setRunning(false);
    root.classList.remove('ready'); // Fall back to the poster image.
  });

  // A link can open straight into the walkthrough.
  if (location.hash === '#play') {
    story.play();
    if (!calm) root.scrollIntoView({ block: 'center' });
  }
  (window as unknown as { __story?: Story }).__story = story;
}
