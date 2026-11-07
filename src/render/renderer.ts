// Six instanced draw calls per frame. No scene graph, no per-object work on the CPU.

import type { Built } from './build';
import type { Camera } from './camera';
import { roundedBox } from './mesh';
import * as glsl from './shaders';

export interface Palette {
  base: number[];
  down: number[];
  accent: number[];
  light: number[];
  dot: number[];
  fg: number[];
  zone: number[];
  shadow: number;
  wire: number[];
  packet: number[];
  add: number;
}

export const palettes: Record<'dark' | 'light', Palette> = {
  dark: {
    base: [0.235, 0.232, 0.222],
    down: [0.095, 0.07, 0.065],
    accent: [0.96, 0.33, 0.09],
    light: [0.26, 1.0, 0.13, 0.15],
    dot: [0.92, 0.9, 0.86, 0.2],
    fg: [0.92, 0.9, 0.86],
    zone: [0.022, 0.3],
    shadow: 0.68,
    wire: [0.72, 0.7, 0.66],
    packet: [0.96, 0.94, 0.9],
    add: 1,
  },
  light: {
    base: [0.98, 0.97, 0.95],
    down: [0.72, 0.67, 0.63],
    accent: [0.88, 0.27, 0.05],
    light: [0.56, 0.36, 0.06, 0],
    dot: [0.2, 0.18, 0.16, 0.26],
    fg: [0.2, 0.18, 0.16],
    zone: [0.028, 0.42],
    shadow: 0.24,
    wire: [0.32, 0.3, 0.27],
    packet: [0.17, 0.15, 0.13],
    add: 0,
  },
};

const FLOAT = 5126;
const WIRE_SEGMENTS = 28;

export class Renderer {
  private gl: WebGL2RenderingContext;
  private programs: Record<string, { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }> = {};
  private vaos: Record<string, WebGLVertexArrayObject> = {};
  private sceneBuffers: WebGLBuffer[] = [];
  private indexCount: number;
  private meshSign: WebGLBuffer;
  private meshDir: WebGLBuffer;
  private meshIndex: WebGLBuffer;
  private quad: WebGLBuffer;
  private strip: WebGLBuffer;
  private built!: Built;
  private counts = { blocks: 0, shadows: 0, zones: 0, curves: 0, packets: 0 };
  private blockStateBuf!: WebGLBuffer;
  private curveStateBuf!: WebGLBuffer;
  private packetStateBuf!: WebGLBuffer;
  blockState = new Float32Array(0);
  curveState = new Float32Array(0);
  packetState = new Float32Array(0);

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: 'low-power',
      stencil: false,
    });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;

    this.program('block', glsl.blockVS, glsl.blockFS, ['uVP', 'uEye', 'uBase', 'uAccent', 'uDown', 'uLight']);
    this.program('ground', glsl.groundVS, glsl.groundFS, ['uVP', 'uC', 'uDot']);
    this.program('zone', glsl.zoneVS, glsl.zoneFS, ['uVP', 'uFg', 'uZone']);
    this.program('shadow', glsl.shadowVS, glsl.shadowFS, ['uVP', 'uShadow']);
    this.program('wire', glsl.wireVS, glsl.wireFS, ['uVP', 'uRes', 'uWidth', 'uWire', 'uAccent']);
    this.program('packet', glsl.packetVS, glsl.packetFS, ['uVP', 'uScale', 'uTime', 'uPacket', 'uAccent', 'uAdd']);

    const mesh = roundedBox();
    this.indexCount = mesh.index.length;
    this.meshSign = this.data(mesh.sign);
    this.meshDir = this.data(mesh.dir);
    this.meshIndex = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshIndex);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW);
    this.quad = this.data(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
    const strip = new Float32Array((WIRE_SEGMENTS + 1) * 4);
    for (let i = 0; i <= WIRE_SEGMENTS; i++) {
      strip.set([i / WIRE_SEGMENTS, -1, i / WIRE_SEGMENTS, 1], i * 4);
    }
    this.strip = this.data(strip);
  }

  // Swaps in a new scene. Shaders stay compiled, so switching projects doesn't stall.
  load(built: Built): void {
    const gl = this.gl;
    for (const vao of Object.values(this.vaos)) gl.deleteVertexArray(vao);
    for (const buffer of this.sceneBuffers) gl.deleteBuffer(buffer);
    this.vaos = {};
    this.sceneBuffers = [];
    this.built = built;
    this.counts = {
      blocks: built.blocks.length / 9,
      shadows: built.shadows.length / 6,
      zones: built.zones.length / 4,
      curves: built.curves.length / 12,
      packets: built.packets.length / 15,
    };
    this.blockState = new Float32Array(this.counts.blocks * 4);
    this.curveState = new Float32Array(this.counts.curves * 3);
    this.packetState = new Float32Array(this.counts.packets * 2);
    const own = (array: Float32Array, usage?: number) => {
      const buffer = this.data(array, usage);
      this.sceneBuffers.push(buffer);
      return buffer;
    };

    // Blocks
    this.vao('block');
    this.attr(this.meshSign, [[0, 3, 0, 0, 0]]);
    this.attr(this.meshDir, [[1, 3, 0, 0, 0]]);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshIndex);
    this.attr(own(built.blocks), [
      [2, 3, 36, 0, 1],
      [3, 3, 36, 12, 1],
      [4, 2, 36, 24, 1],
      [5, 1, 36, 32, 1],
    ]);
    this.blockStateBuf = own(this.blockState, gl.DYNAMIC_DRAW);
    this.attr(this.blockStateBuf, [[6, 4, 0, 0, 1]]);

    // Ground, zones and shadows
    this.vao('ground');
    this.attr(this.quad, [[0, 2, 0, 0, 0]]);
    this.vao('zone');
    this.attr(this.quad, [[0, 2, 0, 0, 0]]);
    this.attr(own(built.zones), [[1, 4, 0, 0, 1]]);
    this.vao('shadow');
    this.attr(this.quad, [[0, 2, 0, 0, 0]]);
    this.attr(own(built.shadows), [
      [1, 4, 24, 0, 1],
      [2, 2, 24, 16, 1],
    ]);

    // Wires
    this.vao('wire');
    this.attr(this.strip, [[0, 2, 0, 0, 0]]);
    this.attr(own(built.curves), [
      [1, 3, 48, 0, 1],
      [2, 3, 48, 12, 1],
      [3, 3, 48, 24, 1],
      [4, 3, 48, 36, 1],
    ]);
    this.curveStateBuf = own(this.curveState, gl.DYNAMIC_DRAW);
    this.attr(this.curveStateBuf, [[5, 3, 0, 0, 1]]);

    // Packets, and the points of a cloud
    this.vao('packet');
    this.attr(this.quad, [[0, 2, 0, 0, 0]]);
    this.attr(own(built.packets), [
      [1, 3, 60, 0, 1],
      [2, 3, 60, 12, 1],
      [3, 3, 60, 24, 1],
      [4, 3, 60, 36, 1],
      [5, 3, 60, 48, 1],
    ]);
    this.packetStateBuf = own(this.packetState, gl.DYNAMIC_DRAW);
    this.attr(this.packetStateBuf, [[6, 2, 0, 0, 1]]);
    gl.bindVertexArray(null);
  }

  private program(name: string, vs: string, fs: string, uniforms: string[]): void {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(`${name}: ${gl.getShaderInfoLog(s)}`);
      }
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`${name}: ${gl.getProgramInfoLog(p)}`);
    const u: Record<string, WebGLUniformLocation | null> = {};
    for (const key of uniforms) u[key] = gl.getUniformLocation(p, key);
    this.programs[name] = { p, u };
  }

  private vao(name: string): void {
    const v = this.gl.createVertexArray()!;
    this.vaos[name] = v;
    this.gl.bindVertexArray(v);
  }

  private data(array: Float32Array, usage = 35044 /* STATIC_DRAW */): WebGLBuffer {
    const gl = this.gl;
    const b = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, array, usage);
    return b;
  }

  // Each layout entry: location, size, stride, offset, divisor.
  private attr(buffer: WebGLBuffer, layout: number[][]): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (const [loc, size, stride, offset, divisor] of layout) {
      gl.enableVertexAttribArray(loc!);
      gl.vertexAttribPointer(loc!, size!, FLOAT, false, stride!, offset!);
      gl.vertexAttribDivisor(loc!, divisor!);
    }
  }

  writeStates(): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.blockStateBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.blockState);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.curveStateBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.curveState);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.packetStateBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.packetState);
  }

  draw(cam: Camera, time: number, pal: Palette, width: number): void {
    const gl = this.gl;
    const { canvas, built, counts, programs: P, vaos } = this;
    const c = gl.TRIANGLE_STRIP;
    const start = (name: string) => {
      gl.useProgram(P[name]!.p);
      gl.bindVertexArray(vaos[name]!);
      gl.uniformMatrix4fv(P[name]!.u.uVP!, false, cam.vp);
      return P[name]!.u;
    };

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.depthMask(true);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Flat things on the ground come first, with no depth test.
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);

    let u = start('ground');
    gl.uniform3f(u.uC!, built.center[0], built.center[1], built.radius * 2.1);
    gl.uniform4fv(u.uDot!, pal.dot);
    gl.drawArrays(c, 0, 4);

    if (counts.zones) {
      u = start('zone');
      gl.uniform3fv(u.uFg!, pal.fg);
      gl.uniform2fv(u.uZone!, pal.zone);
      gl.drawArraysInstanced(c, 0, 4, counts.zones);
    }

    u = start('shadow');
    gl.uniform1f(u.uShadow!, pal.shadow);
    gl.drawArraysInstanced(c, 0, 4, counts.shadows);

    // Solid blocks.
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    if (counts.blocks) {
      u = start('block');
      gl.uniform3fv(u.uEye!, cam.eye);
      gl.uniform3fv(u.uBase!, pal.base);
      gl.uniform3fv(u.uAccent!, pal.accent);
      gl.uniform3fv(u.uDown!, pal.down);
      gl.uniform4fv(u.uLight!, pal.light);
      gl.drawElementsInstanced(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0, counts.blocks);
    }

    // Wires and packets last, hidden by blocks in front of them.
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.depthMask(false);

    u = start('wire');
    gl.uniform2f(u.uRes!, canvas.width, canvas.height);
    gl.uniform1f(u.uWidth!, (2.1 * canvas.width) / Math.max(width, 1));
    gl.uniform3fv(u.uWire!, pal.wire);
    gl.uniform3fv(u.uAccent!, pal.accent);
    gl.drawArraysInstanced(c, 0, (WIRE_SEGMENTS + 1) * 2, counts.curves);

    if (counts.packets) {
      u = start('packet');
      gl.uniform2fv(u.uScale!, cam.scale);
      gl.uniform1f(u.uTime!, time);
      gl.uniform3fv(u.uPacket!, pal.packet);
      gl.uniform3fv(u.uAccent!, pal.accent);
      gl.uniform1f(u.uAdd!, pal.add);
      gl.drawArraysInstanced(c, 0, 4, counts.packets);
    }
    gl.bindVertexArray(null);
  }
}
