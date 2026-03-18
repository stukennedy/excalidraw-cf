import type { ExcalidrawElement } from './types';
import { generateSeed } from './types';
import { store } from './state';
import { getElementBounds, getMultiElementBounds, normalizeRect, rotatePoint, type Point } from './geometry';
import { hitTestElement, hitTestHandles, type HandlePosition } from './hit-test';
import { screenToWorld } from './camera';

export function hitTestAll(worldPoint: Point): ExcalidrawElement | null {
  const elements = store.getVisibleElements();
  // Collect contained text IDs — these aren't independently selectable
  const containedTextIds = new Set<string>();
  for (const el of elements) {
    if (el.boundElements) {
      for (const b of el.boundElements) {
        if (b.type === 'text') containedTextIds.add(b.id);
      }
    }
  }
  // Test in reverse order (top to bottom)
  for (let i = elements.length - 1; i >= 0; i--) {
    if (containedTextIds.has(elements[i].id)) continue;
    if (hitTestElement(elements[i], worldPoint)) {
      return elements[i];
    }
  }
  return null;
}

export function getElementsInSelectionBox(x1: number, y1: number, x2: number, y2: number): ExcalidrawElement[] {
  const rect = normalizeRect(x1, y1, x2, y2);
  const selBounds = {
    minX: rect.x,
    minY: rect.y,
    maxX: rect.x + rect.width,
    maxY: rect.y + rect.height,
    width: rect.width,
    height: rect.height,
  };

  // Collect contained text IDs
  const containedTextIds = new Set<string>();
  for (const el of store.getVisibleElements()) {
    if (el.boundElements) {
      for (const b of el.boundElements) {
        if (b.type === 'text') containedTextIds.add(b.id);
      }
    }
  }

  return store.getVisibleElements().filter(el => {
    if (containedTextIds.has(el.id)) return false;
    const bounds = getElementBounds(el);
    return (
      bounds.minX >= selBounds.minX &&
      bounds.minY >= selBounds.minY &&
      bounds.maxX <= selBounds.maxX &&
      bounds.maxY <= selBounds.maxY
    );
  });
}

export function resizeElement(
  element: ExcalidrawElement,
  handle: HandlePosition,
  dx: number,
  dy: number,
  originalBounds: { x: number; y: number; width: number; height: number }
): ExcalidrawElement {
  // Project world-space deltas into element's local (rotated) coordinate system
  let localDx = dx;
  let localDy = dy;
  if (element.angle !== 0) {
    const cos = Math.cos(-element.angle);
    const sin = Math.sin(-element.angle);
    localDx = dx * cos - dy * sin;
    localDy = dx * sin + dy * cos;
  }

  let { x, y, width, height } = originalBounds;

  switch (handle) {
    case 'nw': x += localDx; y += localDy; width -= localDx; height -= localDy; break;
    case 'n': y += localDy; height -= localDy; break;
    case 'ne': y += localDy; width += localDx; height -= localDy; break;
    case 'e': width += localDx; break;
    case 'se': width += localDx; height += localDy; break;
    case 's': height += localDy; break;
    case 'sw': x += localDx; width -= localDx; height += localDy; break;
    case 'w': x += localDx; width -= localDx; break;
  }

  // Prevent negative dimensions
  if (width < 1) { width = 1; }
  if (height < 1) { height = 1; }

  return {
    ...element,
    x, y, width, height,
    version: element.version + 1,
    versionNonce: generateSeed(),
  };
}

export function rotateElement(
  element: ExcalidrawElement,
  center: Point,
  startAngle: number,
  currentAngle: number
): ExcalidrawElement {
  const angleDiff = currentAngle - startAngle;
  return {
    ...element,
    angle: element.angle + angleDiff,
    version: element.version + 1,
    versionNonce: generateSeed(),
  };
}

export { hitTestHandles, type HandlePosition };
