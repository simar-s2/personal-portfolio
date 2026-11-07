// Turns a scene into the flat arrays the GPU draws from.

import type { RNode, RScene } from './types';

export interface Built {
  blocks: Float32Array; // x y z, half x y z, radius xz y, tone
  blockNode: Int32Array;
  shadows: Float32Array; // x z, half x z, radius, strength
  zones: Float32Array; // x z, half x z
  curves: Float32Array; // four control points
  curveAlpha: Float32Array;
  curveOwner: Int32Array; // an edge index, or -1 - node index for a label pin
  packets: Float32Array; // four control points, phase, speed, size
  packetOwner: Int32Array; // an edge index, or -1 - node index for a point in a cloud
  anchors: Float32Array; // where each node's label sits
  aabb: Float32Array; // for picking
  center: [number, number];
  radius: number;
  height: number;
}

const size = (n: RNode) => ({
  w: n.w ?? 2,
  d: n.d ?? n.w ?? 2,
  h: n.h ?? 0.7,
  y: n.y ?? 0,
  tone: n.tone ?? 1,
});

// A small random generator, so clouds look the same on every load.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const bump = (a: number, b: number) => Math.exp(-(a * a + b * b));

// A point on the front of a head. u and v both run from -1 to 1.
function head(u: number, v: number): [number, number, number] {
  const t = u * 1.9;
  const p = v * 1.45;
  let r = 1;
  r += 0.34 * bump(t / 0.17, (p + 0.1) / 0.28); // nose
  r -= 0.1 * bump((Math.abs(t) - 0.42) / 0.16, (p - 0.2) / 0.13); // eyes
  r += 0.07 * bump(t / 0.34, (p + 0.56) / 0.07); // lips
  r += 0.05 * bump(t / 0.5, (p - 0.42) / 0.09); // brow
  const taper = 1 - 0.3 * Math.max(0, -v - 0.1);
  return [
    Math.sin(t) * Math.cos(p) * r * 0.82 * taper,
    Math.sin(p) * 1.12,
    Math.cos(t) * Math.cos(p) * r * 0.9 * taper,
  ];
}

export function build(scene: RScene): Built {
  const blocks: number[] = [];
  const blockNode: number[] = [];
  const shadows: number[] = [];
  const curves: number[] = [];
  const curveAlpha: number[] = [];
  const curveOwner: number[] = [];
  const packets: number[] = [];
  const packetOwner: number[] = [];
  const anchors: number[] = [];
  const aabb: number[] = [];
  const index = new Map(scene.nodes.map((n, i) => [n.id, i]));
  const tops: number[] = [];

  scene.nodes.forEach((n, ni) => {
    const { w, d, h, y, tone } = size(n);
    const add = (
      x: number,
      py: number,
      z: number,
      hx: number,
      hy: number,
      hz: number,
      rxz: number,
      ry: number,
      t = tone,
    ) => {
      blocks.push(x, py, z, hx, hy, hz, Math.min(rxz, hx, hz), Math.min(ry, hy), t);
      blockNode.push(ni);
    };
    const kind = n.kind ?? 'box';

    if (kind === 'box') {
      add(n.x, y + h / 2, n.z, w / 2, h / 2, d / 2, 0.15, 0.09);
    } else if (kind === 'server') {
      const gap = 0.07;
      const s = (h - gap * 2) / 3;
      for (let i = 0; i < 3; i++) {
        add(n.x, y + s / 2 + i * (s + gap), n.z, w / 2, s / 2, d / 2, 0.14, 0.05, tone * (0.92 + i * 0.08));
      }
    } else if (kind === 'db') {
      const gap = 0.08;
      const s = (h - gap * 2) / 3;
      for (let i = 0; i < 3; i++) {
        add(n.x, y + s / 2 + i * (s + gap), n.z, w / 2, s / 2, d / 2, Math.min(w, d) / 2, 0.06, tone * (0.92 + i * 0.1));
      }
    } else if (kind === 'ball') {
      add(n.x, y + h / 2, n.z, w / 2, h / 2, d / 2, w / 2, h / 2, tone * 1.1);
    } else if (kind === 'queue') {
      add(n.x, y + 0.09, n.z, w / 2, 0.09, d / 2, 0.12, 0.05, tone * 0.85);
      const count = Math.max(3, Math.round(w / 0.5));
      const cube = (w - 0.3) / count;
      for (let i = 0; i < count; i++) {
        const cx = n.x - w / 2 + 0.15 + cube * (i + 0.5);
        add(cx, y + 0.18 + cube * 0.36, n.z, cube * 0.38, cube * 0.36, d * 0.28, 0.05, 0.05, tone * 1.15);
      }
    } else if (kind === 'chip') {
      add(n.x, y + h * 0.25, n.z, w / 2, h * 0.25, d / 2, 0.14, 0.06);
      add(n.x, y + h * 0.75, n.z, w * 0.31, h * 0.25, d * 0.31, 0.1, 0.06, tone * 1.28);
    } else if (kind === 'bin') {
      add(n.x, y + 0.11, n.z, w / 2, 0.11, d / 2, 0.14, 0.05, tone * 0.92);
      const pad = 0.1;
      let left = n.x - w / 2 + pad;
      (n.fill ?? []).forEach((share, i) => {
        const jw = (w - pad * 2) * share;
        const jh = 0.22 + ((i * 7) % 5) * 0.09;
        add(left + jw / 2, y + 0.22 + jh / 2, n.z, jw / 2 - 0.025, jh / 2, d / 2 - 0.16, 0.05, 0.04, tone * (1.1 + (i % 2) * 0.16));
        left += jw;
      });
    } else if (kind === 'screen') {
      add(n.x, y + h / 2, n.z, w / 2, h / 2, Math.min(d, 0.14) / 2, 0.06, 0.06, tone * 1.5);
    } else if (kind === 'keyboard') {
      add(n.x, y + 0.07, n.z, w / 2, 0.07, d / 2, 0.14, 0.05, tone * 0.8);
      const rows = 4;
      const cols = 11;
      const kw = (w - 0.3) / cols;
      const kd = (d - 0.3) / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          add(n.x - w / 2 + 0.15 + kw * (c + 0.5), y + 0.17, n.z - d / 2 + 0.15 + kd * (r + 0.5), kw * 0.42, 0.04, kd * 0.42, 0.04, 0.03, tone * 1.3);
        }
      }
    } else {
      // Clouds and meshes are points, drawn with the packet shader.
      const random = rng(ni * 97 + 11);
      const addPoint = (u: number, v: number, noise: number, s: number) => {
        const [a, b, c] = head(u, v);
        const px = n.x + (a + (random() - 0.5) * noise) * (w / 2);
        const py = y + h / 2 + (b + (random() - 0.5) * noise) * (h / 2.2);
        const pz = n.z + (c + (random() - 0.5) * noise) * (d / 2) - d * 0.22;
        packets.push(px, py, pz, px, py, pz, px, py, pz, px, py, pz, 0, 0, s);
        packetOwner.push(-1 - ni);
      };
      if (kind === 'mesh') {
        for (let i = 0; i < 26; i++) {
          for (let j = 0; j < 28; j++) addPoint(i / 12.5 - 1, j / 13.5 - 1, 0, 0.042);
        }
      } else {
        for (let i = 0; i < 620; i++) {
          const u = random() * 2 - 1;
          const v = random() * 2 - 1;
          // A hole in the scan, on one cheek.
          if (Math.hypot(u - 0.42, v + 0.22) < 0.22) continue;
          addPoint(u, v, 0.13, 0.036);
        }
        for (let i = 0; i < 26; i++) addPoint(random() * 2.6 - 1.3, random() * 2.4 - 1.2, 1.1, 0.036);
      }
    }

    const isPoints = kind === 'cloud' || kind === 'mesh';
    if (!isPoints && y < 0.2) {
      const radius = kind === 'db' || kind === 'ball' ? Math.min(w, d) / 2 : 0.15;
      shadows.push(n.x, n.z, w / 2, kind === 'screen' ? 0.14 : d / 2, radius, 1);
    }

    const top = y + h + (kind === 'keyboard' ? 0.1 : 0);
    const pin = n.pin ?? 0.5;
    tops[ni] = top;
    anchors.push(n.x, top + pin, n.z);
    aabb.push(n.x - w / 2, y, n.z - d / 2, n.x + w / 2, top, n.z + d / 2);
  });

  scene.edges.forEach((e, ei) => {
    const ia = index.get(e.from);
    const ib = index.get(e.to);
    if (ia === undefined || ib === undefined) throw new Error(`bad edge ${e.from}>${e.to}`);
    const a = scene.nodes[ia]!;
    const b = scene.nodes[ib]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    const bend = e.bend ?? 0;
    const lift = e.arc ?? Math.min(0.32 * len + 0.5, 2.3);
    const peak = Math.max(tops[ia]!, tops[ib]!) + lift;
    const points = [
      a.x, tops[ia]!, a.z,
      a.x + dx * 0.24 + nx * bend, peak, a.z + dz * 0.24 + nz * bend,
      b.x - dx * 0.24 + nx * bend, peak, b.z - dz * 0.24 + nz * bend,
      b.x, tops[ib]!, b.z,
    ];
    curves.push(...points);
    curveAlpha.push(0.42);
    curveOwner.push(ei);
    const count = Math.max(1, Math.min(3, Math.round(len / 3.5)));
    for (let i = 0; i < count; i++) {
      packets.push(...points, ((i / count + ei * 0.137) % 1), 0.2 / Math.max(1, len / 5), 0.085);
      packetOwner.push(ei);
    }
  });

  // A short line from each block up to its label.
  scene.nodes.forEach((_, ni) => {
    const x = anchors[ni * 3]!;
    const y1 = anchors[ni * 3 + 1]!;
    const z = anchors[ni * 3 + 2]!;
    const y0 = tops[ni]!;
    curves.push(x, y0, z, x, y0 + (y1 - y0) / 3, z, x, y0 + ((y1 - y0) * 2) / 3, z, x, y1, z);
    curveAlpha.push(0.28);
    curveOwner.push(-1 - ni);
  });

  const zones = (scene.zones ?? []).flatMap((z) => [z.x, z.z, z.w / 2, z.d / 2]);

  // Fit the camera to everything, including zones.
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let height = 1;
  for (let i = 0; i < aabb.length; i += 6) {
    minX = Math.min(minX, aabb[i]!);
    maxX = Math.max(maxX, aabb[i + 3]!);
    minZ = Math.min(minZ, aabb[i + 2]!);
    maxZ = Math.max(maxZ, aabb[i + 5]!);
    height = Math.max(height, anchors[(i / 6) * 3 + 1]!);
  }
  for (let i = 0; i < zones.length; i += 4) {
    minX = Math.min(minX, zones[i]! - zones[i + 2]!);
    maxX = Math.max(maxX, zones[i]! + zones[i + 2]!);
    minZ = Math.min(minZ, zones[i + 1]! - zones[i + 3]!);
    maxZ = Math.max(maxZ, zones[i + 1]! + zones[i + 3]!);
  }

  return {
    blocks: new Float32Array(blocks),
    blockNode: new Int32Array(blockNode),
    shadows: new Float32Array(shadows),
    zones: new Float32Array(zones),
    curves: new Float32Array(curves),
    curveAlpha: new Float32Array(curveAlpha),
    curveOwner: new Int32Array(curveOwner),
    packets: new Float32Array(packets),
    packetOwner: new Int32Array(packetOwner),
    anchors: new Float32Array(anchors),
    aabb: new Float32Array(aabb),
    center: [(minX + maxX) / 2, (minZ + maxZ) / 2],
    radius: Math.hypot(maxX - minX, maxZ - minZ) * 0.46,
    height,
  };
}
