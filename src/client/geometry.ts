import type { ExcalidrawElement } from './types';

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export function getElementBounds(element: ExcalidrawElement): Bounds {
  if ('points' in element && element.points) {
    const points = element.points as [number, number][];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of points) {
      const x = element.x + px;
      const y = element.y + py;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  return {
    minX: element.x,
    minY: element.y,
    maxX: element.x + element.width,
    maxY: element.y + element.height,
    width: element.width,
    height: element.height,
  };
}

export function normalizeRect(x1: number, y1: number, x2: number, y2: number) {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

export function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function rotatePoint(point: Point, center: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function getBoundsCenter(bounds: Bounds): Point {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}

/**
 * Find the closest element near `point` and return the edge point facing `point`.
 * Uses distance to the element's center (with margin) to determine proximity.
 */
export function snapToElementEdge(
  point: Point,
  elements: ExcalidrawElement[],
  excludeId?: string,
  threshold = 40,
): { point: Point; elementId: string } | null {
  let best: { point: Point; elementId: string; dist: number } | null = null;

  for (const el of elements) {
    if (el.id === excludeId) continue;
    if (el.type === 'line' || el.type === 'arrow' || el.type === 'freedraw') continue;

    const bounds = getElementBounds(el);
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;

    // For rotated elements, un-rotate the test point into local space
    const localPoint = el.angle ? rotatePoint(point, { x: cx, y: cy }, -el.angle) : point;

    // Check distance to the element's expanded bounding box (not just edge point)
    const expandedMinX = bounds.minX - threshold;
    const expandedMinY = bounds.minY - threshold;
    const expandedMaxX = bounds.maxX + threshold;
    const expandedMaxY = bounds.maxY + threshold;

    if (localPoint.x < expandedMinX || localPoint.x > expandedMaxX ||
        localPoint.y < expandedMinY || localPoint.y > expandedMaxY) {
      continue; // Too far
    }

    // Project from center toward un-rotated point to find edge intersection in local space
    const edgePt = getEdgePoint(el, localPoint, cx, cy, bounds);
    // Rotate edge point back to world space
    const worldEdgePt = el.angle ? rotatePoint(edgePt, { x: cx, y: cy }, el.angle) : edgePt;
    const d = distance(point, worldEdgePt);

    if (!best || d < best.dist) {
      best = { point: worldEdgePt, elementId: el.id, dist: d };
    }
  }

  return best ? { point: best.point, elementId: best.elementId } : null;
}

/**
 * Get the edge point of an element at a specific angle (radians) from its center.
 * Used by bound arrows to maintain a stable anchor position.
 */
export function getElementEdgeAtAngle(el: ExcalidrawElement, angle: number): Point {
  const bounds = getElementBounds(el);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  // `angle` is in local (unrotated) space — compute edge point on the unrotated shape
  const target = { x: cx + Math.cos(angle) * 1000, y: cy + Math.sin(angle) * 1000 };
  const edgePt = getEdgePoint(el, target, cx, cy, bounds);
  // Rotate the edge point into world space by the element's rotation
  if (el.angle) {
    return rotatePoint(edgePt, { x: cx, y: cy }, el.angle);
  }
  return edgePt;
}

/**
 * Calculate the angle from an element's center to a given point.
 * Used to record WHERE on the boundary an arrow is anchored.
 */
export function getAngleFromElementCenter(el: ExcalidrawElement, point: Point): number {
  const bounds = getElementBounds(el);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  // Compute world-space angle, then subtract element rotation to get local-space angle.
  // This ensures the anchor stays at the same position on the boundary when rotated.
  const worldAngle = Math.atan2(point.y - cy, point.x - cx);
  return worldAngle - (el.angle || 0);
}

function getEdgePoint(
  el: ExcalidrawElement,
  target: Point,
  cx: number, cy: number,
  bounds: Bounds,
): Point {
  const hw = bounds.width / 2;
  const hh = bounds.height / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;

  if (el.type === 'ellipse') {
    // Ellipse edge point
    const angle = Math.atan2(dy, dx);
    return {
      x: cx + hw * Math.cos(angle),
      y: cy + hh * Math.sin(angle),
    };
  }

  if (el.type === 'diamond') {
    // Diamond edge: |dx/hw| + |dy/hh| = 1
    const angle = Math.atan2(dy, dx);
    const absCos = Math.abs(Math.cos(angle));
    const absSin = Math.abs(Math.sin(angle));
    const scale = 1 / (absCos / hw + absSin / hh);
    return {
      x: cx + scale * Math.cos(angle),
      y: cy + scale * Math.sin(angle),
    };
  }

  // Rectangle (and icon): clamp to nearest edge
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
    return { x: cx, y: bounds.minY }; // Default to top
  }

  const angle = Math.atan2(dy, dx);
  // Find intersection with rect edges
  const tanA = Math.tan(angle);
  let ix: number, iy: number;

  if (Math.abs(dx) * hh > Math.abs(dy) * hw) {
    // Hits left or right edge
    ix = dx > 0 ? hw : -hw;
    iy = ix * tanA;
  } else {
    // Hits top or bottom edge
    iy = dy > 0 ? hh : -hh;
    ix = tanA !== 0 ? iy / tanA : 0;
  }

  return { x: cx + ix, y: cy + iy };
}

/**
 * Convert a pass-through midpoint to a quadratic bezier control point.
 * Given endpoints P0, P2 and a point M that the curve should pass through at t=0.5:
 *   CP = 2*M - 0.5*P0 - 0.5*P2
 */
export function midpointToControlPoint(
  p0x: number, p0y: number,
  mx: number, my: number,
  p2x: number, p2y: number,
): [number, number] {
  return [
    2 * mx - 0.5 * p0x - 0.5 * p2x,
    2 * my - 0.5 * p0y - 0.5 * p2y,
  ];
}

export function getMultiElementBounds(elements: ExcalidrawElement[]): Bounds | null {
  if (elements.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    const b = getElementBounds(el);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
