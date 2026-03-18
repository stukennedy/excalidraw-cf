import type { ExcalidrawElement } from '../types/elements';

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

  const minX = element.x;
  const minY = element.y;
  const maxX = element.x + element.width;
  const maxY = element.y + element.height;
  return { minX, minY, maxX, maxY, width: element.width, height: element.height };
}

export function pointInBounds(point: Point, bounds: Bounds, padding = 0): boolean {
  return (
    point.x >= bounds.minX - padding &&
    point.x <= bounds.maxX + padding &&
    point.y >= bounds.minY - padding &&
    point.y <= bounds.maxY + padding
  );
}

export function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
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

export function normalizeRect(x1: number, y1: number, x2: number, y2: number): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}
