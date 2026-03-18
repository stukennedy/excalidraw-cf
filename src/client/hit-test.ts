import type { ExcalidrawElement } from './types';
import { getElementBounds, distance, rotatePoint, midpointToControlPoint, type Point } from './geometry';

const HIT_THRESHOLD = 10;

export function hitTestElement(element: ExcalidrawElement, point: Point): boolean {
  // Rotate point inversely if element is rotated
  let p = point;
  if (element.angle !== 0) {
    const bounds = getElementBounds(element);
    const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
    p = rotatePoint(point, center, -element.angle);
  }

  switch (element.type) {
    case 'rectangle':
    case 'text':
    case 'icon':
      return hitTestRectangle(element, p);
    case 'ellipse':
      return hitTestEllipse(element, p);
    case 'diamond':
      return hitTestDiamond(element, p);
    case 'line':
    case 'arrow':
    case 'freedraw':
      return hitTestLinear(element, p);
  }
}

function hitTestRectangle(element: ExcalidrawElement, point: Point): boolean {
  const t = HIT_THRESHOLD;
  const { x, y, width, height } = element;

  // Check if near any edge
  if (element.backgroundColor !== 'transparent') {
    // Filled: check if inside
    return point.x >= x - t && point.x <= x + width + t && point.y >= y - t && point.y <= y + height + t;
  }

  // Stroke only: check if near edges
  const nearTop = Math.abs(point.y - y) < t && point.x >= x - t && point.x <= x + width + t;
  const nearBottom = Math.abs(point.y - (y + height)) < t && point.x >= x - t && point.x <= x + width + t;
  const nearLeft = Math.abs(point.x - x) < t && point.y >= y - t && point.y <= y + height + t;
  const nearRight = Math.abs(point.x - (x + width)) < t && point.y >= y - t && point.y <= y + height + t;
  return nearTop || nearBottom || nearLeft || nearRight;
}

function hitTestEllipse(element: ExcalidrawElement, point: Point): boolean {
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  const rx = element.width / 2;
  const ry = element.height / 2;

  if (rx === 0 || ry === 0) return false;

  const normalizedDist = ((point.x - cx) / rx) ** 2 + ((point.y - cy) / ry) ** 2;

  if (element.backgroundColor !== 'transparent') {
    return normalizedDist <= 1.1;
  }
  return Math.abs(normalizedDist - 1) < 0.3;
}

function hitTestDiamond(element: ExcalidrawElement, point: Point): boolean {
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  const rx = element.width / 2;
  const ry = element.height / 2;

  if (rx === 0 || ry === 0) return false;

  const dist = Math.abs(point.x - cx) / rx + Math.abs(point.y - cy) / ry;

  if (element.backgroundColor !== 'transparent') {
    return dist <= 1.1;
  }
  return Math.abs(dist - 1) < HIT_THRESHOLD / Math.min(rx, ry);
}

function hitTestLinear(element: ExcalidrawElement, point: Point): boolean {
  if (!('points' in element)) return false;
  const points = (element as any).points as [number, number][];

  // For single-point elements (just started drawing)
  if (points.length === 1) {
    return distance(point, { x: element.x + points[0][0], y: element.y + points[0][1] }) < HIT_THRESHOLD;
  }

  // 3-point arrows: midpoint is a pass-through point, convert to control point for bezier
  if (element.type === 'arrow' && points.length === 3) {
    const p0 = { x: element.x + points[0][0], y: element.y + points[0][1] };
    const mid = { x: element.x + points[1][0], y: element.y + points[1][1] };
    const p2 = { x: element.x + points[2][0], y: element.y + points[2][1] };
    const [cpx, cpy] = midpointToControlPoint(p0.x, p0.y, mid.x, mid.y, p2.x, p2.y);
    return distToBezier(point, p0, { x: cpx, y: cpy }, p2) < HIT_THRESHOLD;
  }

  // Lines and freedraw: test each straight segment
  for (let i = 0; i < points.length - 1; i++) {
    const ax = element.x + points[i][0];
    const ay = element.y + points[i][1];
    const bx = element.x + points[i + 1][0];
    const by = element.y + points[i + 1][1];

    const d = distToSegment(point, { x: ax, y: ay }, { x: bx, y: by });
    if (d < HIT_THRESHOLD) return true;
  }

  return false;
}

/** Sample a quadratic bezier curve and return minimum distance from point to curve */
function distToBezier(p: Point, p0: Point, p1: Point, p2: Point): number {
  let minDist = Infinity;
  const steps = 32;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const invT = 1 - t;
    const x = invT * invT * p0.x + 2 * invT * t * p1.x + t * t * p2.x;
    const y = invT * invT * p0.y + 2 * invT * t * p1.y + t * t * p2.y;
    const d = distance(p, { x, y });
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(p, a);

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotation';

export function hitTestHandles(element: ExcalidrawElement, point: Point, handleSize = 8): HandlePosition | null {
  const bounds = getElementBounds(element);
  const { minX, minY, maxX, maxY } = bounds;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const hs = handleSize;

  // Un-rotate the world point into the element's local coordinate system
  let p = point;
  if (element.angle !== 0) {
    p = rotatePoint(point, { x: cx, y: cy }, -element.angle);
  }

  const handles: [HandlePosition, number, number][] = [
    ['nw', minX, minY],
    ['n', cx, minY],
    ['ne', maxX, minY],
    ['e', maxX, cy],
    ['se', maxX, maxY],
    ['s', cx, maxY],
    ['sw', minX, maxY],
    ['w', minX, cy],
    ['rotation', cx, minY - 25],
  ];

  for (const [pos, hx, hy] of handles) {
    if (Math.abs(p.x - hx) < hs && Math.abs(p.y - hy) < hs) {
      return pos;
    }
  }
  return null;
}
