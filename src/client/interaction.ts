import type { ExcalidrawElement, Tool, LinearElement, ArrowElement, FreedrawElement, TextElement } from './types';
import { generateSeed } from './types';
import { store } from './state';
import { screenToWorld, zoomAtPoint, pan } from './camera';
import { hitTestAll, getElementsInSelectionBox, resizeElement, hitTestHandles, type HandlePosition } from './selection';
import { history } from './history';
import { createElement } from '../lib/element-factory';
import { normalizeRect, getElementBounds, type Point } from './geometry';
import { wsClient } from './ws-client';

type InteractionState =
  | { type: 'idle' }
  | { type: 'drawing'; elementId: string; startX: number; startY: number }
  | { type: 'dragging'; startX: number; startY: number; elementOffsets: Map<string, { dx: number; dy: number }> }
  | { type: 'selecting'; startX: number; startY: number }
  | { type: 'resizing'; elementId: string; handle: HandlePosition; original: { x: number; y: number; width: number; height: number }; startX: number; startY: number }
  | { type: 'rotating'; elementId: string; center: Point; startAngle: number; originalAngle: number }
  | { type: 'panning'; lastX: number; lastY: number }
  | { type: 'drawing-linear'; elementId: string }
  | { type: 'drawing-freedraw'; elementId: string }
  | { type: 'editing-text'; elementId: string }
  | { type: 'dragging-point'; elementId: string; pointIndex: number };

let interactionState: InteractionState = { type: 'idle' };
let selectionBox: { x1: number; y1: number; x2: number; y2: number } | null = null;

export function getSelectionBox() { return selectionBox; }

export function setupInteraction(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('pointerdown', (e) => onPointerDown(e, canvas));
  canvas.addEventListener('pointermove', (e) => onPointerMove(e, canvas));
  canvas.addEventListener('pointerup', (e) => onPointerUp(e, canvas));
  canvas.addEventListener('wheel', (e) => onWheel(e), { passive: false });
  canvas.addEventListener('dblclick', (e) => onDoubleClick(e, canvas));

  // Prevent context menu on canvas
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e);
  });
}

function onPointerDown(e: PointerEvent, canvas: HTMLCanvasElement): void {
  const world = screenToWorld(e.offsetX, e.offsetY);
  const tool = store.appState.activeTool;

  // Middle mouse button or space+click for panning
  if (e.button === 1 || (e.button === 0 && tool === 'hand')) {
    interactionState = { type: 'panning', lastX: e.clientX, lastY: e.clientY };
    canvas.style.cursor = 'grabbing';
    canvas.setPointerCapture(e.pointerId);
    return;
  }

  if (e.button !== 0) return;
  canvas.setPointerCapture(e.pointerId);

  switch (tool) {
    case 'selection':
      handleSelectionDown(world, e.shiftKey);
      break;
    case 'eraser':
      handleEraserDown(world);
      break;
    case 'rectangle':
    case 'ellipse':
    case 'diamond':
      handleShapeDown(tool, world);
      break;
    case 'line':
    case 'arrow':
      handleLinearDown(tool, world);
      break;
    case 'freedraw':
      handleFreedrawDown(world);
      break;
    case 'text':
      handleTextDown(world, canvas);
      break;
  }
}

function onPointerMove(e: PointerEvent, canvas: HTMLCanvasElement): void {
  const world = screenToWorld(e.offsetX, e.offsetY);

  // Send cursor position to other users
  if (store.appState.roomId) {
    wsClient.sendCursorMove(world.x, world.y);
  }

  switch (interactionState.type) {
    case 'panning': {
      const dx = e.clientX - interactionState.lastX;
      const dy = e.clientY - interactionState.lastY;
      pan(dx, dy);
      interactionState.lastX = e.clientX;
      interactionState.lastY = e.clientY;
      break;
    }
    case 'drawing': {
      const el = store.getElement(interactionState.elementId);
      if (!el) break;
      const rect = normalizeRect(interactionState.startX, interactionState.startY, world.x, world.y);
      store.updateElement({
        ...el,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      });
      break;
    }
    case 'dragging': {
      const dx = world.x - interactionState.startX;
      const dy = world.y - interactionState.startY;
      for (const [id, offset] of interactionState.elementOffsets) {
        const el = store.getElement(id);
        if (!el) continue;
        store.updateElement({
          ...el,
          x: interactionState.startX + dx + offset.dx,
          y: interactionState.startY + dy + offset.dy,
          version: el.version + 1,
          versionNonce: generateSeed(),
        });
      }
      break;
    }
    case 'selecting': {
      selectionBox = {
        x1: interactionState.startX,
        y1: interactionState.startY,
        x2: world.x,
        y2: world.y,
      };
      const elements = getElementsInSelectionBox(
        selectionBox.x1, selectionBox.y1,
        selectionBox.x2, selectionBox.y2
      );
      store.appState.selectedElementIds = new Set(elements.map(el => el.id));
      store.notify();
      break;
    }
    case 'resizing': {
      const el = store.getElement(interactionState.elementId);
      if (!el) break;
      const dx = world.x - interactionState.startX;
      const dy = world.y - interactionState.startY;
      const updated = resizeElement(el, interactionState.handle, dx, dy, interactionState.original);
      store.updateElement(updated);
      break;
    }
    case 'rotating': {
      const el = store.getElement(interactionState.elementId);
      if (!el) break;
      const angle = Math.atan2(
        world.y - interactionState.center.y,
        world.x - interactionState.center.x
      );
      const angleDiff = angle - interactionState.startAngle;
      store.updateElement({
        ...el,
        angle: interactionState.originalAngle + angleDiff,
        version: el.version + 1,
        versionNonce: generateSeed(),
      });
      break;
    }
    case 'dragging-point': {
      const el = store.getElement(interactionState.elementId) as LinearElement | ArrowElement | undefined;
      if (!el) break;
      const points = [...el.points];
      points[interactionState.pointIndex] = [world.x - el.x, world.y - el.y];
      store.updateElement({ ...el, points, version: el.version + 1, versionNonce: generateSeed() } as ExcalidrawElement);
      break;
    }
    case 'drawing-linear': {
      const el = store.getElement(interactionState.elementId) as LinearElement | ArrowElement | undefined;
      if (!el) break;
      const points = [...el.points];
      points[points.length - 1] = [world.x - el.x, world.y - el.y];
      store.updateElement({ ...el, points } as ExcalidrawElement);
      break;
    }
    case 'drawing-freedraw': {
      const el = store.getElement(interactionState.elementId) as FreedrawElement | undefined;
      if (!el) break;
      const points = [...el.points, [world.x - el.x, world.y - el.y] as [number, number]];
      store.updateElement({ ...el, points } as ExcalidrawElement);
      break;
    }
    default: {
      // Update cursor based on what's under pointer
      updateCursor(world, canvas);
    }
  }
}

function onPointerUp(e: PointerEvent, canvas: HTMLCanvasElement): void {
  canvas.releasePointerCapture(e.pointerId);

  switch (interactionState.type) {
    case 'drawing': {
      const el = store.getElement(interactionState.elementId);
      if (el && el.width < 2 && el.height < 2) {
        // Too small, delete
        store.elements.delete(interactionState.elementId);
        store.notify();
      } else if (el) {
        wsClient.sendElementUpdate([el]);
      }
      // Return to selection tool after drawing
      setTool('selection');
      break;
    }
    case 'drawing-linear': {
      const el = store.getElement(interactionState.elementId);
      if (el) {
        finishLinear(el as LinearElement | ArrowElement);
        wsClient.sendElementUpdate([el]);
      }
      setTool('selection');
      break;
    }
    case 'drawing-freedraw': {
      const el = store.getElement(interactionState.elementId);
      if (el) {
        finishFreedraw(el as FreedrawElement);
        wsClient.sendElementUpdate([el]);
      }
      setTool('selection');
      break;
    }
    case 'dragging': {
      const selected = store.getSelectedElements();
      if (selected.length > 0) {
        wsClient.sendElementUpdate(selected);
      }
      break;
    }
    case 'resizing':
    case 'rotating':
    case 'dragging-point': {
      const el = store.getElement(interactionState.elementId);
      if (el) wsClient.sendElementUpdate([el]);
      break;
    }
    case 'panning':
      canvas.style.cursor = store.appState.activeTool === 'hand' ? 'grab' : 'default';
      break;
  }

  selectionBox = null;
  interactionState = { type: 'idle' };
}

function onWheel(e: WheelEvent): void {
  e.preventDefault();

  if (e.ctrlKey || e.metaKey) {
    // Zoom
    const delta = -e.deltaY * 0.001;
    const newZoom = store.appState.zoom * (1 + delta);
    zoomAtPoint(newZoom, e.offsetX, e.offsetY);
  } else {
    // Pan
    pan(-e.deltaX, -e.deltaY);
  }
}

function onDoubleClick(e: MouseEvent, canvas: HTMLCanvasElement): void {
  const world = screenToWorld(e.offsetX, e.offsetY);
  const hit = hitTestAll(world);

  if (hit && hit.type === 'text') {
    startTextEditing(hit as TextElement, canvas);
  } else if (!hit) {
    // Double-click on empty space creates text
    handleTextDown(world, canvas);
  }
}

function handleSelectionDown(world: Point, shiftKey: boolean): void {
  const selected = store.getSelectedElements();
  if (selected.length === 1) {
    const el = selected[0];

    // For linear elements, check point handles first
    if ((el.type === 'line' || el.type === 'arrow') && 'points' in el) {
      const linearEl = el as LinearElement | ArrowElement;
      const pointIndex = hitTestLinearPoints(linearEl, world);
      if (pointIndex !== -1) {
        history.capture();
        interactionState = { type: 'dragging-point', elementId: el.id, pointIndex };
        return;
      }
      // Check midpoint handles for inserting bend points
      const midIndex = hitTestLinearMidpoints(linearEl, world);
      if (midIndex !== -1) {
        history.capture();
        const points = [...linearEl.points];
        const newPoint: [number, number] = [
          (points[midIndex][0] + points[midIndex + 1][0]) / 2,
          (points[midIndex][1] + points[midIndex + 1][1]) / 2,
        ];
        points.splice(midIndex + 1, 0, newPoint);
        store.updateElement({ ...linearEl, points } as ExcalidrawElement);
        interactionState = { type: 'dragging-point', elementId: el.id, pointIndex: midIndex + 1 };
        return;
      }
    }

    // Check resize/rotation handles for non-linear elements
    if (el.type !== 'line' && el.type !== 'arrow') {
      const handle = hitTestHandles(el, world);
      if (handle === 'rotation') {
        const bounds = getElementBounds(el);
        const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
        const startAngle = Math.atan2(world.y - center.y, world.x - center.x);
        history.capture();
        interactionState = { type: 'rotating', elementId: el.id, center, startAngle, originalAngle: el.angle };
        return;
      }
      if (handle) {
        history.capture();
        interactionState = {
          type: 'resizing',
          elementId: el.id,
          handle,
          original: { x: el.x, y: el.y, width: el.width, height: el.height },
          startX: world.x,
          startY: world.y,
        };
        return;
      }
    }
  }

  const hit = hitTestAll(world);

  if (hit) {
    if (shiftKey) {
      // Toggle selection
      if (store.appState.selectedElementIds.has(hit.id)) {
        store.appState.selectedElementIds.delete(hit.id);
        store.notify();
      } else {
        store.selectElement(hit.id, true);
      }
    } else if (!store.appState.selectedElementIds.has(hit.id)) {
      store.selectElement(hit.id);
    }

    // Start dragging
    history.capture();
    const offsets = new Map<string, { dx: number; dy: number }>();
    for (const id of store.appState.selectedElementIds) {
      const el = store.getElement(id);
      if (el) {
        offsets.set(id, { dx: el.x - world.x, dy: el.y - world.y });
      }
    }
    interactionState = { type: 'dragging', startX: world.x, startY: world.y, elementOffsets: offsets };
  } else {
    if (!shiftKey) store.clearSelection();
    interactionState = { type: 'selecting', startX: world.x, startY: world.y };
  }
}

function handleEraserDown(world: Point): void {
  const hit = hitTestAll(world);
  if (hit) {
    history.capture();
    store.deleteElement(hit.id);
    wsClient.sendElementDelete([hit.id]);
  }
}

function handleShapeDown(tool: 'rectangle' | 'ellipse' | 'diamond', world: Point): void {
  history.capture();
  const element = createElement(tool, world.x, world.y, store.appState);
  store.updateElement(element);
  store.selectElement(element.id);
  interactionState = { type: 'drawing', elementId: element.id, startX: world.x, startY: world.y };
}

function handleLinearDown(tool: 'line' | 'arrow', world: Point): void {
  history.capture();
  const element = createElement(tool, world.x, world.y, store.appState);
  const points: [number, number][] = [[0, 0], [0, 0]];
  store.updateElement({ ...element, points } as ExcalidrawElement);
  store.selectElement(element.id);
  interactionState = { type: 'drawing-linear', elementId: element.id };
}

function handleFreedrawDown(world: Point): void {
  history.capture();
  const element = createElement('freedraw', world.x, world.y, store.appState);
  store.updateElement(element);
  store.selectElement(element.id);
  interactionState = { type: 'drawing-freedraw', elementId: element.id };
}

function handleTextDown(world: Point, canvas: HTMLCanvasElement): void {
  const element = createElement('text', world.x, world.y, store.appState);
  store.updateElement(element);
  store.selectElement(element.id);
  startTextEditing(element as TextElement, canvas);
}

function startTextEditing(element: TextElement, canvas: HTMLCanvasElement): void {
  store.setAppState({ editingElement: element.id });

  const textarea = document.createElement('textarea');
  textarea.id = 'text-editor';
  textarea.value = element.text;
  textarea.style.cssText = `
    position: fixed;
    background: transparent;
    border: 1px dashed #4a90d9;
    outline: none;
    resize: none;
    overflow: hidden;
    font-size: ${element.fontSize * store.appState.zoom}px;
    font-family: ${element.fontFamily === 'Virgil' ? '"Virgil", cursive' : element.fontFamily === 'Cascadia' ? '"Cascadia Code", monospace' : 'Helvetica, Arial, sans-serif'};
    color: ${element.strokeColor};
    line-height: ${element.lineHeight};
    text-align: ${element.textAlign};
    min-width: 100px;
    min-height: 30px;
    padding: 4px;
    z-index: 1000;
  `;

  // Position in screen coordinates
  const { zoom, scrollX, scrollY } = store.appState;
  const rect = canvas.getBoundingClientRect();
  textarea.style.left = `${element.x * zoom + scrollX + rect.left}px`;
  textarea.style.top = `${element.y * zoom + scrollY + rect.top}px`;

  document.body.appendChild(textarea);
  textarea.focus();

  const finishEditing = () => {
    const text = textarea.value;
    if (text.trim()) {
      history.capture();
      // Measure text for width/height
      const ctx = canvas.getContext('2d')!;
      ctx.font = `${element.fontSize}px ${element.fontFamily}`;
      const lines = text.split('\n');
      const width = Math.max(...lines.map(l => ctx.measureText(l).width));
      const height = lines.length * element.fontSize * element.lineHeight;

      store.updateElement({
        ...element,
        text,
        width,
        height,
        version: element.version + 1,
        versionNonce: generateSeed(),
      });

      const updatedEl = store.getElement(element.id);
      if (updatedEl) wsClient.sendElementUpdate([updatedEl]);
    } else {
      store.elements.delete(element.id);
      store.notify();
    }
    store.setAppState({ editingElement: null });
    textarea.remove();
    setTool('selection');
  };

  textarea.addEventListener('blur', finishEditing);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      textarea.removeEventListener('blur', finishEditing);
      textarea.value = element.text; // Restore original
      finishEditing();
    }
  });
}

function finishLinear(element: LinearElement | ArrowElement): void {
  // Calculate bounding box from points
  const points = element.points;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [px, py] of points) {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }

  store.updateElement({
    ...element,
    width: maxX - minX,
    height: maxY - minY,
    version: element.version + 1,
    versionNonce: generateSeed(),
  } as ExcalidrawElement);
}

function finishFreedraw(element: FreedrawElement): void {
  const points = element.points;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [px, py] of points) {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }

  store.updateElement({
    ...element,
    width: maxX - minX,
    height: maxY - minY,
    version: element.version + 1,
    versionNonce: generateSeed(),
  });
}

function hitTestLinearPoints(element: LinearElement | ArrowElement, world: Point): number {
  const threshold = 10;
  for (let i = 0; i < element.points.length; i++) {
    const px = element.x + element.points[i][0];
    const py = element.y + element.points[i][1];
    const dx = world.x - px;
    const dy = world.y - py;
    if (dx * dx + dy * dy < threshold * threshold) return i;
  }
  return -1;
}

function hitTestLinearMidpoints(element: LinearElement | ArrowElement, world: Point): number {
  const threshold = 8;
  for (let i = 0; i < element.points.length - 1; i++) {
    const mx = element.x + (element.points[i][0] + element.points[i + 1][0]) / 2;
    const my = element.y + (element.points[i][1] + element.points[i + 1][1]) / 2;
    const dx = world.x - mx;
    const dy = world.y - my;
    if (dx * dx + dy * dy < threshold * threshold) return i;
  }
  return -1;
}

function updateCursor(world: Point, canvas: HTMLCanvasElement): void {
  const tool = store.appState.activeTool;
  if (tool === 'hand') {
    canvas.style.cursor = 'grab';
    return;
  }
  if (tool !== 'selection') {
    canvas.style.cursor = 'crosshair';
    return;
  }

  const selected = store.getSelectedElements();
  if (selected.length === 1) {
    const el = selected[0];
    // Linear point handles
    if ((el.type === 'line' || el.type === 'arrow') && 'points' in el) {
      const linearEl = el as LinearElement | ArrowElement;
      if (hitTestLinearPoints(linearEl, world) !== -1) {
        canvas.style.cursor = 'grab';
        return;
      }
      if (hitTestLinearMidpoints(linearEl, world) !== -1) {
        canvas.style.cursor = 'pointer';
        return;
      }
    }
    // Resize/rotation handles
    if (el.type !== 'line' && el.type !== 'arrow') {
      const handle = hitTestHandles(el, world);
      if (handle) {
        const cursors: Record<HandlePosition, string> = {
          nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize',
          se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize',
          rotation: 'grab',
        };
        canvas.style.cursor = cursors[handle];
        return;
      }
    }
  }

  const hit = hitTestAll(world);
  canvas.style.cursor = hit ? 'move' : 'default';
}

function showContextMenu(e: MouseEvent): void {
  window.dispatchEvent(new CustomEvent('excalidraw:context-menu', {
    detail: { x: e.clientX, y: e.clientY },
  }));
}

export function setTool(tool: Tool): void {
  store.setAppState({ activeTool: tool });
  if (tool !== 'selection') {
    store.clearSelection();
  }
  window.dispatchEvent(new CustomEvent('excalidraw:tool-change', { detail: { tool } }));
}

export function nudgeSelected(dx: number, dy: number): void {
  const selected = store.getSelectedElements();
  if (selected.length === 0) return;

  history.capture();
  for (const el of selected) {
    store.updateElement({
      ...el,
      x: el.x + dx,
      y: el.y + dy,
      version: el.version + 1,
      versionNonce: generateSeed(),
    });
  }
  wsClient.sendElementUpdate(store.getSelectedElements());
}
