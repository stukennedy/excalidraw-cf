import type {
  ExcalidrawElement,
  ElementType,
  AppState,
  RectangleElement,
  EllipseElement,
  DiamondElement,
  LinearElement,
  ArrowElement,
  FreedrawElement,
  TextElement,
} from '../types/elements';
import { generateId, generateSeed } from '../types/elements';

function baseElement(type: ElementType, x: number, y: number, state: AppState): ExcalidrawElement {
  return {
    id: generateId(),
    type,
    x,
    y,
    width: 0,
    height: 0,
    angle: 0,
    strokeColor: state.strokeColor,
    backgroundColor: state.backgroundColor,
    fillStyle: state.fillStyle,
    strokeWidth: state.strokeWidth,
    strokeStyle: state.strokeStyle,
    roughness: state.roughness,
    opacity: state.opacity,
    seed: generateSeed(),
    version: 1,
    versionNonce: generateSeed(),
    isDeleted: false,
    groupIds: [],
    boundElements: null,
    locked: false,
  } as ExcalidrawElement;
}

export function createRectangle(x: number, y: number, state: AppState): RectangleElement {
  return { ...baseElement('rectangle', x, y, state), type: 'rectangle' } as RectangleElement;
}

export function createEllipse(x: number, y: number, state: AppState): EllipseElement {
  return { ...baseElement('ellipse', x, y, state), type: 'ellipse' } as EllipseElement;
}

export function createDiamond(x: number, y: number, state: AppState): DiamondElement {
  return { ...baseElement('diamond', x, y, state), type: 'diamond' } as DiamondElement;
}

export function createLine(x: number, y: number, state: AppState): LinearElement {
  return {
    ...baseElement('line', x, y, state),
    type: 'line',
    points: [[0, 0]],
  } as LinearElement;
}

export function createArrow(x: number, y: number, state: AppState): ArrowElement {
  return {
    ...baseElement('arrow', x, y, state),
    type: 'arrow',
    points: [[0, 0]],
    startArrowhead: null,
    endArrowhead: 'arrow',
    startBinding: null,
    endBinding: null,
  } as ArrowElement;
}

export function createFreedraw(x: number, y: number, state: AppState): FreedrawElement {
  return {
    ...baseElement('freedraw', x, y, state),
    type: 'freedraw',
    points: [[0, 0]],
    pressures: [],
    simulatePressure: true,
  } as FreedrawElement;
}

export function createText(x: number, y: number, state: AppState): TextElement {
  return {
    ...baseElement('text', x, y, state),
    type: 'text',
    text: '',
    fontSize: state.fontSize,
    fontFamily: state.fontFamily,
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null,
    lineHeight: 1.25,
  } as TextElement;
}

export function createElement(type: ElementType, x: number, y: number, state: AppState): ExcalidrawElement {
  switch (type) {
    case 'rectangle': return createRectangle(x, y, state);
    case 'ellipse': return createEllipse(x, y, state);
    case 'diamond': return createDiamond(x, y, state);
    case 'line': return createLine(x, y, state);
    case 'arrow': return createArrow(x, y, state);
    case 'freedraw': return createFreedraw(x, y, state);
    case 'text': return createText(x, y, state);
  }
}
