import { store } from './state';

export function screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
  const { zoom, scrollX, scrollY } = store.appState;
  return {
    x: (screenX - scrollX) / zoom,
    y: (screenY - scrollY) / zoom,
  };
}

export function worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
  const { zoom, scrollX, scrollY } = store.appState;
  return {
    x: worldX * zoom + scrollX,
    y: worldY * zoom + scrollY,
  };
}

export function zoomAtPoint(newZoom: number, screenX: number, screenY: number): void {
  const { zoom, scrollX, scrollY } = store.appState;
  const clampedZoom = Math.max(0.1, Math.min(10, newZoom));

  // Keep the world point under the cursor fixed
  const worldX = (screenX - scrollX) / zoom;
  const worldY = (screenY - scrollY) / zoom;

  store.setAppState({
    zoom: clampedZoom,
    scrollX: screenX - worldX * clampedZoom,
    scrollY: screenY - worldY * clampedZoom,
  });
}

export function pan(dx: number, dy: number): void {
  store.setAppState({
    scrollX: store.appState.scrollX + dx,
    scrollY: store.appState.scrollY + dy,
  });
}

export function resetView(canvasWidth: number, canvasHeight: number): void {
  store.setAppState({
    zoom: 1,
    scrollX: canvasWidth / 2,
    scrollY: canvasHeight / 2,
  });
}
