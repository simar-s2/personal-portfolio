// Decides what is lit up, faded out or crashed, and eases every value toward its target.

import type { Built } from './build';
import type { RScene, RStep } from './types';

export class Focus {
  // Per node: lift, glow, down, dim. Per edge: lit, dim. Current values, then targets.
  private node: Float32Array;
  private nodeTo: Float32Array;
  private edge: Float32Array;
  private edgeTo: Float32Array;
  private ids: Map<string, number>;
  private edgeIds: Map<string, number>;
  step: RStep | null = null;
  selected: number | null = null;
  hover: number | null = null;

  constructor(
    private scene: RScene,
    private built: Built,
  ) {
    const n = scene.nodes.length;
    const e = scene.edges.length;
    this.node = new Float32Array(n * 4);
    this.nodeTo = new Float32Array(n * 4);
    this.edge = new Float32Array(e * 2);
    this.edgeTo = new Float32Array(e * 2);
    this.ids = new Map(scene.nodes.map((node, i) => [node.id, i]));
    this.edgeIds = new Map(scene.edges.map((edge, i) => [`${edge.from}>${edge.to}`, i]));
    this.retarget();
  }

  get nodes(): Float32Array {
    return this.node;
  }

  indexOf(id: string): number | undefined {
    return this.ids.get(id);
  }

  retarget(): void {
    const { scene, nodeTo, edgeTo } = this;
    const n = scene.nodes.length;
    const e = scene.edges.length;
    nodeTo.fill(0);
    edgeTo.fill(0);

    if (this.step) {
      const lit = new Set(this.step.on ?? []);
      const down = new Set(this.step.down ?? []);
      const litEdges = new Set(this.step.edges ?? []);
      for (let i = 0; i < n; i++) {
        const id = scene.nodes[i]!.id;
        nodeTo[i * 4 + 1] = lit.has(id) ? 1 : 0;
        nodeTo[i * 4 + 2] = down.has(id) ? 1 : 0;
        nodeTo[i * 4 + 3] = lit.has(id) || down.has(id) ? 0 : 1;
      }
      for (let i = 0; i < e; i++) {
        const key = `${scene.edges[i]!.from}>${scene.edges[i]!.to}`;
        edgeTo[i * 2] = litEdges.has(key) ? 1 : 0;
        edgeTo[i * 2 + 1] = litEdges.has(key) ? 0 : 1;
      }
      return;
    }

    const focus = this.selected ?? this.hover;
    if (focus !== null) {
      const id = scene.nodes[focus]!.id;
      const near = new Set([id]);
      for (let i = 0; i < e; i++) {
        const edge = scene.edges[i]!;
        const touches = edge.from === id || edge.to === id;
        edgeTo[i * 2] = touches ? 1 : 0;
        edgeTo[i * 2 + 1] = touches ? 0 : 0.8;
        if (touches) near.add(edge.from).add(edge.to);
      }
      for (let i = 0; i < n; i++) {
        const nid = scene.nodes[i]!.id;
        nodeTo[i * 4] = i === focus ? 0.07 : 0;
        nodeTo[i * 4 + 1] = i === focus ? 0.8 : 0;
        nodeTo[i * 4 + 3] = near.has(nid) ? 0 : 0.75;
      }
      return;
    }

    // Quiet wires stay dark until something lights them.
    for (let i = 0; i < e; i++) {
      edgeTo[i * 2 + 1] = scene.edges[i]!.quiet ? 0.86 : 0;
    }
  }

  // Moves everything toward its target and fills the GPU arrays. True if anything changed.
  tick(dt: number, states: { block: Float32Array; curve: Float32Array; packet: Float32Array }, force = false): boolean {
    const k = 1 - Math.exp(-dt * 9);
    let moving = force;
    const ease = (a: Float32Array, b: Float32Array) => {
      for (let i = 0; i < a.length; i++) {
        const d = b[i]! - a[i]!;
        if (Math.abs(d) > 0.002) {
          a[i]! += d * k;
          moving = true;
        } else {
          a[i] = b[i]!;
        }
      }
    };
    ease(this.node, this.nodeTo);
    ease(this.edge, this.edgeTo);
    if (!moving) return false;

    const { built, node, edge } = this;
    const { blockNode, curveOwner, curveAlpha, packetOwner } = built;
    for (let i = 0; i < blockNode.length; i++) {
      const ni = blockNode[i]! * 4;
      states.block.set([node[ni]!, node[ni + 1]!, node[ni + 2]!, node[ni + 3]!], i * 4);
    }
    for (let i = 0; i < curveOwner.length; i++) {
      const o = curveOwner[i]!;
      const on = o >= 0 ? edge[o * 2]! : 0;
      const dim = o >= 0 ? edge[o * 2 + 1]! : node[(-1 - o) * 4 + 3]!;
      states.curve.set([on, dim, curveAlpha[i]!], i * 3);
    }
    for (let i = 0; i < packetOwner.length; i++) {
      const o = packetOwner[i]!;
      if (o >= 0) {
        states.packet.set([edge[o * 2]!, edge[o * 2 + 1]!], i * 2);
      } else {
        const ni = (-1 - o) * 4;
        states.packet.set([node[ni + 1]!, node[ni + 3]! * 0.8], i * 2);
      }
    }
    return true;
  }
}
