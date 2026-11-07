// One rounded box mesh, drawn many times with instancing.
//
// Each vertex stores which corner of the inner box it belongs to (sign) and the
// direction it bulges out from there (dir). The vertex shader computes
// position = sign * (half - radius) + dir * radius, so corners stay round at any size,
// and a radius of half the width turns the same mesh into a cylinder or a sphere.

export interface BoxMesh {
  sign: Float32Array;
  dir: Float32Array;
  index: Uint16Array;
}

export function roundedBox(segments = 5): BoxMesh {
  // Positions along one axis of a face: around the low corner, then around the high one.
  const stops: [number, number][] = [];
  for (let i = segments; i >= 0; i--) stops.push([-1, Math.tan(((i / segments) * Math.PI) / 4)]);
  for (let i = 0; i <= segments; i++) stops.push([1, Math.tan(((i / segments) * Math.PI) / 4)]);
  const n = stops.length;

  const sign: number[] = [];
  const dir: number[] = [];
  const index: number[] = [];
  let base = 0;

  for (let axis = 0; axis < 3; axis++) {
    const b = (axis + 1) % 3;
    const c = (axis + 2) % 3;
    for (const side of [1, -1]) {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const s = [0, 0, 0];
          const d = [0, 0, 0];
          s[axis] = side;
          d[axis] = side;
          s[b] = stops[i]![0];
          d[b] = stops[i]![0] * stops[i]![1];
          s[c] = stops[j]![0];
          d[c] = stops[j]![0] * stops[j]![1];
          const len = Math.hypot(d[0]!, d[1]!, d[2]!);
          sign.push(s[0]!, s[1]!, s[2]!);
          dir.push(d[0]! / len, d[1]! / len, d[2]! / len);
        }
      }
      for (let i = 0; i < n - 1; i++) {
        for (let j = 0; j < n - 1; j++) {
          const p = base + i * n + j;
          const q = p + n;
          if (side > 0) index.push(p, q, q + 1, p, q + 1, p + 1);
          else index.push(p, q + 1, q, p, p + 1, q + 1);
        }
      }
      base += n * n;
    }
  }

  return {
    sign: new Float32Array(sign),
    dir: new Float32Array(dir),
    index: new Uint16Array(index),
  };
}
