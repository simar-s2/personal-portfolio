// Labels are real DOM text, so they stay sharp and can be focused and clicked.

import type { Built } from './build';
import type { Camera } from './camera';
import type { RScene } from './types';

interface Item {
  el: HTMLButtonElement;
  tag: HTMLElement;
  w: number;
  h: number;
  x: number;
  y: number;
  depth: number;
}

export class Labels {
  private items: Item[];
  private zones: { el: HTMLElement; x: number; z: number }[];

  constructor(
    host: HTMLElement,
    private scene: RScene,
    private built: Built,
    on: { hover(i: number | null): void; pick(i: number): void },
  ) {
    this.items = scene.nodes.map((node, i) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'rl';
      // On a phone, touches go through labels to the block or the drag underneath.
      if (matchMedia('(max-width: 620px)').matches) el.tabIndex = -1;
      const name = document.createElement('span');
      name.className = 'rl-name';
      name.textContent = node.label;
      const tag = document.createElement('span');
      tag.className = 'rl-tag';
      el.append(name, tag);
      if (node.sub) {
        const sub = document.createElement('span');
        sub.className = 'rl-sub';
        sub.textContent = node.sub;
        el.append(sub);
      }
      el.addEventListener('pointerenter', () => on.hover(i));
      el.addEventListener('pointerleave', () => on.hover(null));
      el.addEventListener('focus', () => on.hover(i));
      el.addEventListener('blur', () => on.hover(null));
      el.addEventListener('click', () => on.pick(i));
      host.append(el);
      return { el, tag, w: 0, h: 0, x: 0, y: 0, depth: 0 };
    });
    this.zones = (scene.zones ?? [])
      .filter((zone) => zone.label)
      .map((zone) => {
        const el = document.createElement('span');
        el.className = 'rz';
        el.textContent = zone.label!;
        host.append(el);
        return { el, x: zone.x - zone.w / 2 + 0.3, z: zone.z + zone.d / 2 - 0.05 };
      });
    this.setTags(Object.fromEntries(scene.nodes.filter((n) => n.tag).map((n) => [n.id, n.tag!])));
    this.measure();
    document.fonts?.ready.then(() => this.measure());
  }

  destroy(): void {
    for (const item of this.items) item.el.remove();
    for (const zone of this.zones) zone.el.remove();
  }

  measure(): void {
    for (const item of this.items) {
      item.w = item.el.offsetWidth;
      item.h = item.el.offsetHeight;
    }
  }

  setTags(tags: Record<string, string>): void {
    this.scene.nodes.forEach((node, i) => {
      const text = tags[node.id] ?? '';
      const item = this.items[i]!;
      if (item.tag.textContent !== text) item.tag.textContent = text;
    });
    this.measure();
  }

  // Reflect the glow, dim and crashed state of each node.
  setStates(nodes: Float32Array): void {
    this.items.forEach((item, i) => {
      const wasOn = item.el.classList.contains('on');
      const isOn = nodes[i * 4 + 1]! > 0.5;
      item.el.classList.toggle('on', isOn);
      item.el.classList.toggle('down', nodes[i * 4 + 2]! > 0.5);
      item.el.classList.toggle('dim', nodes[i * 4 + 3]! > 0.5);
      // A lit label also shows its second line, so it changes size.
      if (wasOn !== isOn) {
        item.w = item.el.offsetWidth;
        item.h = item.el.offsetHeight;
      }
    });
  }

  place(cam: Camera, width: number, height: number): void {
    const a = this.built.anchors;
    for (const zone of this.zones) {
      const [x, y] = cam.project(zone.x, 0, zone.z, width, height);
      zone.el.style.transform = `translate(${x.toFixed(1)}px,${(y + 2).toFixed(1)}px)`;
    }
    this.items.forEach((item, i) => {
      const [x, y, depth] = cam.project(a[i * 3]!, a[i * 3 + 1]!, a[i * 3 + 2]!, width, height);
      item.x = Math.max(item.w / 2 + 4, Math.min(width - item.w / 2 - 4, x));
      item.y = Math.max(item.h + 4, y);
      item.depth = depth;
      item.el.style.transform = `translate(${(item.x - item.w / 2).toFixed(1)}px,${(item.y - item.h).toFixed(1)}px)`;
    });

    // When labels collide, keep the nearer one readable and fade the other.
    const order = [...this.items].sort((p, q) => p.depth - q.depth);
    for (let i = 0; i < order.length; i++) {
      const p = order[i]!;
      let covered = false;
      for (let j = 0; j < i && !covered; j++) {
        const q = order[j]!;
        covered =
          Math.abs(p.x - q.x) < (p.w + q.w) / 2 - 2 && Math.abs(p.y - p.h / 2 - (q.y - q.h / 2)) < (p.h + q.h) / 2 - 2;
      }
      p.el.classList.toggle('behind', covered);
    }
  }
}
