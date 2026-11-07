// An orbit camera with a narrow lens, so scenes read almost like an isometric drawing.

type V = [number, number, number];

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: V): V => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

const FOV = (24 * Math.PI) / 180;
const TAN = Math.tan(FOV / 2);

export class Camera {
  az = -0.62;
  el = 0.62;
  zoom = 1;
  dist = 30;
  aspect = 1.6;
  depth = 20;
  target: V = [0, 0.4, 0];
  eye: V = [0, 0, 0];
  right: V = [1, 0, 0];
  up: V = [0, 1, 0];
  forward: V = [0, 0, -1];
  vp = new Float32Array(16);
  scale: [number, number] = [1, 1]; // projection scale, used to size billboards

  private basis(az: number, el: number): [V, V, V, V] {
    const ce = Math.cos(el);
    const offset: V = [ce * Math.sin(az), Math.sin(el), ce * Math.cos(az)];
    const forward = norm([-offset[0], -offset[1], -offset[2]]);
    const right = norm(cross(forward, [0, 1, 0]));
    return [offset, right, cross(right, forward), forward];
  }

  // Frames the scene from the starting angle. Dragging later never changes the zoom.
  fit(points: Float32Array, aspect: number): void {
    this.aspect = aspect;
    const [, r, u, f] = this.basis(this.az, this.el);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < points.length; i += 3) {
      const p: V = [points[i]!, points[i + 1]!, points[i + 2]!];
      const x = dot(r, p);
      const y = dot(u, p);
      const z = dot(f, p);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    this.target = [
      r[0] * cx + u[0] * cy + f[0] * cz,
      r[1] * cx + u[1] * cy + f[1] * cz,
      r[2] * cx + u[2] * cy + f[2] * cz,
    ];
    const halfZ = (maxZ - minZ) / 2;
    const across = (maxX - minX) / 2 / (TAN * aspect) + halfZ;
    const down = (maxY - minY) / 2 / TAN + halfZ;
    this.dist = Math.max(across, down) * 1.03;
    this.depth = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  }

  update(): void {
    const [offset, r, u, w] = this.basis(this.az, this.el);
    const dist = this.dist / this.zoom;
    this.eye = [
      this.target[0] + offset[0] * dist,
      this.target[1] + offset[1] * dist,
      this.target[2] + offset[2] * dist,
    ];
    this.forward = w;
    this.right = r;
    this.up = u;

    const f = 1 / TAN;
    const near = Math.max(0.5, dist - this.depth * 1.5);
    const far = dist + this.depth * 2;
    const a = f / this.aspect;
    const c = (far + near) / (near - far);
    const d = (2 * far * near) / (near - far);
    const tx = -dot(r, this.eye);
    const ty = -dot(u, this.eye);
    const tz = dot(w, this.eye);
    this.scale = [a, f];

    // Projection times view, written out to avoid a matrix library.
    const vp = this.vp;
    vp[0] = a * r[0];
    vp[4] = a * r[1];
    vp[8] = a * r[2];
    vp[12] = a * tx;
    vp[1] = f * u[0];
    vp[5] = f * u[1];
    vp[9] = f * u[2];
    vp[13] = f * ty;
    vp[2] = -c * w[0];
    vp[6] = -c * w[1];
    vp[10] = -c * w[2];
    vp[14] = c * tz + d;
    vp[3] = w[0];
    vp[7] = w[1];
    vp[11] = w[2];
    vp[15] = -tz;
  }

  // World position to CSS pixels. Also returns the depth, for sorting labels.
  project(x: number, y: number, z: number, width: number, height: number): [number, number, number] {
    const v = this.vp;
    const cw = v[3]! * x + v[7]! * y + v[11]! * z + v[15]!;
    const cx = v[0]! * x + v[4]! * y + v[8]! * z + v[12]!;
    const cy = v[1]! * x + v[5]! * y + v[9]! * z + v[13]!;
    return [((cx / cw + 1) / 2) * width, ((1 - cy / cw) / 2) * height, cw];
  }

  // A ray through a point on screen, given in -1..1 coordinates.
  ray(nx: number, ny: number): V {
    const sx = nx * TAN * this.aspect;
    const sy = ny * TAN;
    return norm([
      this.forward[0] + this.right[0] * sx + this.up[0] * sy,
      this.forward[1] + this.right[1] * sx + this.up[1] * sy,
      this.forward[2] + this.right[2] * sx + this.up[2] * sy,
    ]);
  }
}
