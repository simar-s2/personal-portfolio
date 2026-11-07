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
  target: V = [0, 0.4, 0];
  eye: V = [0, 0, 0];
  right: V = [1, 0, 0];
  up: V = [0, 1, 0];
  forward: V = [0, 0, -1];
  vp = new Float32Array(16);
  scale: [number, number] = [1, 1]; // projection scale, used to size billboards

  constructor(
    private radius: number,
    private height: number,
  ) {}

  update(aspect: number): void {
    this.aspect = aspect;
    // Far enough back that the scene fits both across and down.
    const across = this.radius / (TAN * aspect);
    const down = (this.radius * Math.sin(this.el) + this.height) / TAN;
    this.dist = (Math.max(across, down) * 1.04) / this.zoom;

    const ce = Math.cos(this.el);
    const offset: V = [ce * Math.sin(this.az), Math.sin(this.el), ce * Math.cos(this.az)];
    this.eye = [
      this.target[0] + offset[0] * this.dist,
      this.target[1] + offset[1] * this.dist,
      this.target[2] + offset[2] * this.dist,
    ];
    this.forward = norm(sub(this.target, this.eye));
    this.right = norm(cross(this.forward, [0, 1, 0]));
    this.up = cross(this.right, this.forward);

    const f = 1 / TAN;
    const near = Math.max(0.1, this.dist - this.radius * 2.5);
    const far = this.dist + this.radius * 3;
    const a = f / aspect;
    const c = (far + near) / (near - far);
    const d = (2 * far * near) / (near - far);
    const [r, u, w] = [this.right, this.up, this.forward];
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
