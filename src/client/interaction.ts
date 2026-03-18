import type { ExcalidrawElement, Tool, LinearElement, ArrowElement, FreedrawElement, TextElement, IconElement } from './types';
import { generateSeed } from './types';
import { store } from './state';
import { screenToWorld, zoomAtPoint, pan } from './camera';
import { hitTestAll, getElementsInSelectionBox, resizeElement, hitTestHandles, type HandlePosition } from './selection';
import { history } from './history';
import { createElement, createIcon } from '../lib/element-factory';
import { normalizeRect, getElementBounds, snapToElementEdge, getElementEdgeAtAngle, getAngleFromElementCenter, type Point } from './geometry';
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
    case 'icon':
      handleIconDown(world);
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
      const movedIds = new Set<string>();
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
        movedIds.add(id);
        // Move bound text elements with the container
        if (el.boundElements) {
          for (const bound of el.boundElements) {
            if (bound.type === 'text') {
              const textEl = store.getElement(bound.id);
              if (textEl && !movedIds.has(textEl.id)) {
                if (!interactionState.elementOffsets.has(textEl.id)) {
                  interactionState.elementOffsets.set(textEl.id, { dx: textEl.x - world.x, dy: textEl.y - world.y });
                }
                const tOffset = interactionState.elementOffsets.get(textEl.id)!;
                store.updateElement({
                  ...textEl,
                  x: interactionState.startX + dx + tOffset.dx,
                  y: interactionState.startY + dy + tOffset.dy,
                  version: textEl.version + 1,
                  versionNonce: generateSeed(),
                });
              }
            }
          }
        }
      }
      // Update any arrows bound to moved elements
      updateBoundArrows(movedIds);
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
      recenterBoundText(updated);
      updateBoundArrows(new Set([updated.id]));
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
      updateBoundArrows(new Set([el.id]));
      break;
    }
    case 'dragging-point': {
      const el = store.getElement(interactionState.elementId) as LinearElement | ArrowElement | undefined;
      if (!el) break;
      const points = [...el.points];
      const idx = interactionState.pointIndex;

      // For arrows: handle snapping and binding on endpoint drags
      if (el.type === 'arrow' && points.length === 3) {
        const arrow = el as ArrowElement;

        if (idx === 1) {
          // Dragging midpoint — just move it, mark as manually bent
          points[idx] = [world.x - el.x, world.y - el.y];
          store.updateElement({ ...arrow, points, midpointFixed: true, version: el.version + 1, versionNonce: generateSeed() } as ExcalidrawElement);
        } else if (idx === 0) {
          // Dragging start endpoint — snap to nearby element
          const snap = snapToElementEdge(world, store.getVisibleElements(), el.id);
          let newX = arrow.x;
          let newY = arrow.y;
          let startBinding = arrow.startBinding;

          if (snap) {
            const snapTarget = store.getElement(snap.elementId);
            const angle = snapTarget ? getAngleFromElementCenter(snapTarget, snap.point) : 0;
            startBinding = { elementId: snap.elementId, focus: angle, gap: 0 };
            // Move arrow origin to snap point, adjust other points
            const dx = newX - snap.point.x;
            const dy = newY - snap.point.y;
            for (let i = 1; i < points.length; i++) {
              points[i] = [points[i][0] + dx, points[i][1] + dy];
            }
            points[0] = [0, 0];
            newX = snap.point.x;
            newY = snap.point.y;
          } else {
            // No snap — unbind and move freely
            startBinding = null;
            const dx = newX - world.x;
            const dy = newY - world.y;
            for (let i = 1; i < points.length; i++) {
              points[i] = [points[i][0] + dx, points[i][1] + dy];
            }
            points[0] = [0, 0];
            newX = world.x;
            newY = world.y;
          }
          if (!arrow.midpointFixed) {
            points[1] = [(points[0][0] + points[2][0]) / 2, (points[0][1] + points[2][1]) / 2];
          }
          store.updateElement({ ...arrow, x: newX, y: newY, points, startBinding, version: el.version + 1, versionNonce: generateSeed() } as ExcalidrawElement);
        } else {
          // Dragging end endpoint (idx === 2) — snap to nearby element
          const snap = snapToElementEdge(world, store.getVisibleElements(), el.id);
          let endBinding = arrow.endBinding;

          if (snap) {
            const snapTarget = store.getElement(snap.elementId);
            const angle = snapTarget ? getAngleFromElementCenter(snapTarget, snap.point) : 0;
            endBinding = { elementId: snap.elementId, focus: angle, gap: 0 };
            points[idx] = [snap.point.x - arrow.x, snap.point.y - arrow.y];
          } else {
            endBinding = null;
            points[idx] = [world.x - arrow.x, world.y - arrow.y];
          }
          if (!arrow.midpointFixed) {
            points[1] = [(points[0][0] + points[2][0]) / 2, (points[0][1] + points[2][1]) / 2];
          }
          store.updateElement({ ...arrow, points, endBinding, version: el.version + 1, versionNonce: generateSeed() } as ExcalidrawElement);
        }
      } else {
        // Lines and other linear elements — no snapping
        points[idx] = [world.x - el.x, world.y - el.y];
        store.updateElement({ ...el, points, version: el.version + 1, versionNonce: generateSeed() } as ExcalidrawElement);
      }
      break;
    }
    case 'drawing-linear': {
      const el = store.getElement(interactionState.elementId) as LinearElement | ArrowElement | undefined;
      if (!el) break;
      const points = [...el.points];
      if (el.type === 'arrow' && points.length === 3) {
        // Arrow: snap end to nearby element edge
        let endWorld = world;
        const snap = snapToElementEdge(world, store.getVisibleElements(), el.id);
        if (snap) endWorld = snap.point;
        const endPt: [number, number] = [endWorld.x - el.x, endWorld.y - el.y];
        points[2] = endPt;
        points[1] = [endPt[0] / 2, endPt[1] / 2]; // midpoint at center
        // Store binding info with anchor angle
        const arrow = el as ArrowElement;
        let endBinding = null;
        if (snap) {
          const snapTarget = store.getElement(snap.elementId);
          const angle = snapTarget ? getAngleFromElementCenter(snapTarget, snap.point) : 0;
          endBinding = { elementId: snap.elementId, focus: angle, gap: 0 };
        }
        store.updateElement({ ...arrow, points, endBinding } as ExcalidrawElement);
      } else {
        points[points.length - 1] = [world.x - el.x, world.y - el.y];
        store.updateElement({ ...el, points } as ExcalidrawElement);
      }
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
      const selectedIds = new Set(selected.map(el => el.id));
      // Also persist bound arrows and bound text that were repositioned
      const boundArrows = getBoundArrows(selectedIds);
      const boundText = getBoundText(selectedIds);
      const toPersist = [...selected, ...boundArrows, ...boundText];
      if (toPersist.length > 0) {
        wsClient.sendElementUpdate(toPersist);
      }
      break;
    }
    case 'resizing': {
      const el = store.getElement(interactionState.elementId);
      if (el) {
        const ids = new Set([el.id]);
        const toSend = [el, ...getBoundText(ids), ...getBoundArrows(ids)];
        wsClient.sendElementUpdate(toSend);
      }
      break;
    }
    case 'rotating': {
      const el = store.getElement(interactionState.elementId);
      if (el) {
        const ids = new Set([el.id]);
        const toSend = [el, ...getBoundArrows(ids)];
        wsClient.sendElementUpdate(toSend);
      }
      break;
    }
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
  } else if (hit && isContainerType(hit.type)) {
    // Double-click on a container (rectangle, ellipse, diamond, icon) — edit contained text
    startContainerTextEditing(hit, canvas);
  } else if (!hit) {
    // Double-click on empty space creates text
    handleTextDown(world, canvas);
  }
}

function isContainerType(type: string): boolean {
  return type === 'rectangle' || type === 'ellipse' || type === 'diamond' || type === 'icon';
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
      // For lines only: check midpoint handles for inserting bend points
      // Arrows use a fixed 3-point bezier, no extra points
      if (el.type === 'line') {
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
    const ids = [hit.id];
    // Also delete bound text
    if (hit.boundElements) {
      for (const b of hit.boundElements) {
        if (b.type === 'text') {
          ids.push(b.id);
          store.deleteElement(b.id);
        }
      }
    }
    store.deleteElement(hit.id);
    wsClient.sendElementDelete(ids);
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
  let startPos = world;
  let startBinding = null;

  // For arrows, snap start to nearby element
  if (tool === 'arrow') {
    const snap = snapToElementEdge(world, store.getVisibleElements());
    if (snap) {
      startPos = snap.point;
      const target = store.getElement(snap.elementId);
      const angle = target ? getAngleFromElementCenter(target, snap.point) : 0;
      startBinding = { elementId: snap.elementId, focus: angle, gap: 0 };
    }
  }

  const element = createElement(tool, startPos.x, startPos.y, store.appState);
  const points: [number, number][] = tool === 'arrow'
    ? [[0, 0], [0, 0], [0, 0]]
    : [[0, 0], [0, 0]];

  if (tool === 'arrow') {
    store.updateElement({ ...element, points, startBinding } as ExcalidrawElement);
  } else {
    store.updateElement({ ...element, points } as ExcalidrawElement);
  }
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

function recenterBoundText(container: ExcalidrawElement): void {
  if (!container.boundElements) return;
  for (const bound of container.boundElements) {
    if (bound.type === 'text') {
      const textEl = store.getElement(bound.id) as TextElement | undefined;
      if (textEl && textEl.text) {
        store.updateElement({
          ...textEl,
          x: container.x + (container.width - textEl.width) / 2,
          y: container.y + (container.height - textEl.height) / 2,
          version: textEl.version + 1,
          versionNonce: generateSeed(),
        });
      }
    }
  }
}

function startContainerTextEditing(container: ExcalidrawElement, canvas: HTMLCanvasElement): void {
  // Find existing bound text element, or create a new one
  let textEl: TextElement | null = null;

  if (container.boundElements) {
    for (const bound of container.boundElements) {
      if (bound.type === 'text') {
        const el = store.getElement(bound.id);
        if (el && el.type === 'text') {
          textEl = el as TextElement;
          break;
        }
      }
    }
  }

  if (!textEl) {
    // Create a new text element bound to this container
    const newText = createElement('text', container.x, container.y, store.appState) as TextElement;
    textEl = {
      ...newText,
      containerId: container.id,
      textAlign: 'center',
      verticalAlign: 'middle',
      text: '',
      width: container.width,
      height: container.height,
    } as TextElement;
    store.updateElement(textEl);

    // Add to container's boundElements
    const boundElements = container.boundElements ? [...container.boundElements] : [];
    boundElements.push({ id: textEl.id, type: 'text' });
    store.updateElement({
      ...container,
      boundElements,
      version: container.version + 1,
      versionNonce: generateSeed(),
    });
  }

  store.selectElement(container.id);
  store.setAppState({ editingElement: textEl.id });

  const textarea = document.createElement('textarea');
  textarea.id = 'text-editor';
  textarea.value = textEl.text;

  const { zoom, scrollX, scrollY } = store.appState;
  const rect = canvas.getBoundingClientRect();

  // Position textarea centered over the container
  const containerScreenX = container.x * zoom + scrollX + rect.left;
  const containerScreenY = container.y * zoom + scrollY + rect.top;
  const containerScreenW = container.width * zoom;
  const containerScreenH = container.height * zoom;
  const padding = 8;

  const fontFamily = textEl.fontFamily === 'Virgil' ? '"DM Sans", sans-serif'
    : textEl.fontFamily === 'Cascadia' ? '"JetBrains Mono", monospace'
    : '"DM Sans", Helvetica, Arial, sans-serif';

  // Calculate vertical padding to center text inside the container
  const scaledFontSize = textEl.fontSize * zoom;
  const existingLines = textEl.text ? textEl.text.split('\n').length : 1;
  const textBlockHeight = existingLines * scaledFontSize * textEl.lineHeight;
  const verticalPad = Math.max(padding, (containerScreenH - textBlockHeight) / 2);

  textarea.style.cssText = `
    position: fixed;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    overflow: hidden;
    font-size: ${scaledFontSize}px;
    font-family: ${fontFamily};
    color: ${textEl.strokeColor};
    line-height: ${textEl.lineHeight};
    text-align: center;
    left: ${containerScreenX + padding}px;
    top: ${containerScreenY + verticalPad}px;
    width: ${containerScreenW - padding * 2}px;
    height: ${containerScreenH - verticalPad * 2}px;
    padding: 0;
    margin: 0;
    box-sizing: border-box;
    z-index: 1000;
  `;

  document.body.appendChild(textarea);
  textarea.focus();

  const capturedTextEl = textEl;
  const finishEditing = () => {
    const text = textarea.value;
    const latestContainer = store.getElement(container.id);

    if (text.trim()) {
      history.capture();
      // Measure text
      const ctx = canvas.getContext('2d')!;
      ctx.font = `${capturedTextEl.fontSize}px "DM Sans", Helvetica, Arial, sans-serif`;
      const lines = text.split('\n');
      const textWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
      const textHeight = lines.length * capturedTextEl.fontSize * capturedTextEl.lineHeight;

      // Center inside container
      const cx = (latestContainer || container).x;
      const cy = (latestContainer || container).y;
      const cw = (latestContainer || container).width;
      const ch = (latestContainer || container).height;

      store.updateElement({
        ...capturedTextEl,
        text,
        x: cx + (cw - textWidth) / 2,
        y: cy + (ch - textHeight) / 2,
        width: textWidth,
        height: textHeight,
        version: capturedTextEl.version + 1,
        versionNonce: generateSeed(),
      });

      const updatedText = store.getElement(capturedTextEl.id);
      if (updatedText) wsClient.sendElementUpdate([updatedText]);
      if (latestContainer) wsClient.sendElementUpdate([latestContainer]);
    } else {
      // Empty text — remove the text element and unbind
      store.elements.delete(capturedTextEl.id);
      if (latestContainer) {
        const boundElements = (latestContainer.boundElements || []).filter(b => b.id !== capturedTextEl.id);
        store.updateElement({
          ...latestContainer,
          boundElements: boundElements.length > 0 ? boundElements : null,
          version: latestContainer.version + 1,
          versionNonce: generateSeed(),
        });
      }
      store.notify();
    }
    store.setAppState({ editingElement: null });
    textarea.remove();
  };

  textarea.addEventListener('blur', finishEditing);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      textarea.removeEventListener('blur', finishEditing);
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

function updateBoundArrows(movedIds: Set<string>): void {
  for (const el of store.getVisibleElements()) {
    if (el.type !== 'arrow') continue;
    const arrow = el as ArrowElement;
    const startBound = arrow.startBinding && movedIds.has(arrow.startBinding.elementId);
    const endBound = arrow.endBinding && movedIds.has(arrow.endBinding.elementId);
    if (!startBound && !endBound) continue;

    let points = [...arrow.points] as [number, number][];
    let newX = arrow.x;
    let newY = arrow.y;

    if (startBound && arrow.startBinding) {
      const target = store.getElement(arrow.startBinding.elementId);
      if (target) {
        // Use the stored anchor angle to find the edge point
        const edgePt = getElementEdgeAtAngle(target, arrow.startBinding.focus);
        // Move arrow origin to this edge point, adjust all other points
        const dx = newX - edgePt.x;
        const dy = newY - edgePt.y;
        for (let i = 1; i < points.length; i++) {
          points[i] = [points[i][0] + dx, points[i][1] + dy];
        }
        points[0] = [0, 0];
        newX = edgePt.x;
        newY = edgePt.y;
      }
    }

    if (endBound && arrow.endBinding) {
      const target = store.getElement(arrow.endBinding.elementId);
      if (target) {
        // Use the stored anchor angle to find the edge point
        const edgePt = getElementEdgeAtAngle(target, arrow.endBinding.focus);
        points[points.length - 1] = [edgePt.x - newX, edgePt.y - newY];
      }
    }

    // Re-center midpoint only if the user hasn't manually bent the arrow
    if (points.length === 3 && !arrow.midpointFixed) {
      points[1] = [(points[0][0] + points[2][0]) / 2, (points[0][1] + points[2][1]) / 2];
    }

    store.updateElement({
      ...arrow, x: newX, y: newY, points,
      version: arrow.version + 1, versionNonce: generateSeed(),
    } as ExcalidrawElement);
  }
}

function getBoundArrows(elementIds: Set<string>): ExcalidrawElement[] {
  const arrows: ExcalidrawElement[] = [];
  for (const el of store.getVisibleElements()) {
    if (el.type !== 'arrow') continue;
    if (elementIds.has(el.id)) continue; // Already in the persist list
    const arrow = el as ArrowElement;
    if ((arrow.startBinding && elementIds.has(arrow.startBinding.elementId)) ||
        (arrow.endBinding && elementIds.has(arrow.endBinding.elementId))) {
      arrows.push(el);
    }
  }
  return arrows;
}

function getBoundText(elementIds: Set<string>): ExcalidrawElement[] {
  const texts: ExcalidrawElement[] = [];
  for (const id of elementIds) {
    const el = store.getElement(id);
    if (el?.boundElements) {
      for (const b of el.boundElements) {
        if (b.type === 'text' && !elementIds.has(b.id)) {
          const textEl = store.getElement(b.id);
          if (textEl) texts.push(textEl);
        }
      }
    }
  }
  return texts;
}

function handleIconDown(world: Point): void {
  history.capture();
  const element = createIcon(world.x - 40, world.y - 40, store.appState, store.appState.iconType);
  store.updateElement(element);
  store.selectElement(element.id);
  wsClient.sendElementUpdate([element]);
  setTool('selection');
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
