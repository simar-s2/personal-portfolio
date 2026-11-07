// A scene is plain data: blocks, the wires between them, and an optional walkthrough.
// World units are arbitrary. x goes right, z comes toward the viewer, y goes up.

export type NodeKind =
  | 'box' // a rounded block
  | 'server' // three stacked slabs
  | 'db' // three stacked discs
  | 'ball' // a sphere, for people and clients
  | 'queue' // a tray with a row of small cubes
  | 'chip' // a low slab with a smaller one on top
  | 'bin' // a slab holding jobs, drawn as small blocks of different sizes
  | 'screen' // a thin upright panel
  | 'keyboard' // a flat slab covered in keys
  | 'cloud' // a point cloud shaped like a head
  | 'mesh'; // the same head, as a tidy grid of points

export interface RNode {
  id: string;
  label: string;
  sub?: string;
  x: number;
  z: number;
  y?: number;
  w?: number;
  d?: number;
  h?: number;
  kind?: NodeKind;
  tone?: number;
  tag?: string; // a role shown next to the label, like "leader"
  glow?: number; // lit in the accent color when nothing else is going on
  pin?: number; // how far above the block its label floats
  fill?: number[]; // for bins: the width of each job, as a share of the bin
  info: string; // shown when the block is clicked
  path?: string; // where it lives in the repo
}

export interface RZone {
  label?: string;
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface REdge {
  from: string;
  to: string;
  arc?: number;
  bend?: number;
  quiet?: boolean; // no packets travel along it until a step lights it up
}

export interface RStep {
  title: string;
  text: string;
  on?: string[];
  edges?: string[]; // written as "from>to"
  down?: string[];
  tags?: Record<string, string>;
}

export interface RScene {
  nodes: RNode[];
  zones?: RZone[];
  edges: REdge[];
  steps?: RStep[];
  cta?: string; // the text on the button that starts the walkthrough
  caption: string; // what the panel says before anything is selected
  camera?: { az?: number; el?: number; zoom?: number };
}
