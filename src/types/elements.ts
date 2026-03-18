export interface ExcalidrawElementBase {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number;
  opacity: number;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  groupIds: string[];
  boundElements: BoundElement[] | null;
  locked: boolean;
}

export interface BoundElement {
  id: string;
  type: 'arrow' | 'text';
}

export type FillStyle = 'hachure' | 'cross-hatch' | 'solid' | 'dots';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type Arrowhead = 'arrow' | 'bar' | 'dot' | 'triangle' | null;

export interface RectangleElement extends ExcalidrawElementBase {
  type: 'rectangle';
}

export interface EllipseElement extends ExcalidrawElementBase {
  type: 'ellipse';
}

export interface DiamondElement extends ExcalidrawElementBase {
  type: 'diamond';
}

export interface LinearElement extends ExcalidrawElementBase {
  type: 'line';
  points: [number, number][];
}

export interface ArrowElement extends ExcalidrawElementBase {
  type: 'arrow';
  points: [number, number][];
  startArrowhead: Arrowhead;
  endArrowhead: Arrowhead;
  startBinding: Binding | null;
  endBinding: Binding | null;
}

export interface Binding {
  elementId: string;
  focus: number;
  gap: number;
}

export interface FreedrawElement extends ExcalidrawElementBase {
  type: 'freedraw';
  points: [number, number][];
  pressures: number[];
  simulatePressure: boolean;
}

export interface TextElement extends ExcalidrawElementBase {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: FontFamily;
  textAlign: TextAlign;
  verticalAlign: VerticalAlign;
  containerId: string | null;
  lineHeight: number;
}

export type FontFamily = 'Virgil' | 'Helvetica' | 'Cascadia';
export type TextAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';

export type ExcalidrawElement =
  | RectangleElement
  | EllipseElement
  | DiamondElement
  | LinearElement
  | ArrowElement
  | FreedrawElement
  | TextElement;

export type ElementType = 'rectangle' | 'ellipse' | 'diamond' | 'line' | 'arrow' | 'freedraw' | 'text';

export type Tool =
  | 'selection'
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'line'
  | 'arrow'
  | 'freedraw'
  | 'text'
  | 'eraser'
  | 'hand';

export interface AppState {
  activeTool: Tool;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number;
  opacity: number;
  fontSize: number;
  fontFamily: FontFamily;
  zoom: number;
  scrollX: number;
  scrollY: number;
  selectedElementIds: Set<string>;
  editingElement: string | null;
  roomId: string | null;
}

export function getDefaultAppState(): AppState {
  return {
    activeTool: 'selection',
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'hachure',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    fontSize: 20,
    fontFamily: 'Virgil',
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
    selectedElementIds: new Set(),
    editingElement: null,
    roomId: null,
  };
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function generateSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
