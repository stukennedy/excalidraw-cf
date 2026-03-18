import type { ExcalidrawElement } from './types';
import { generateId, generateSeed } from './types';
import { store } from './state';
import { history } from './history';
import { wsClient } from './ws-client';

let clipboardElements: ExcalidrawElement[] = [];
let pasteOffset = 0;

export function copySelected(): void {
  clipboardElements = store.getSelectedElements().map(el => ({ ...el }));
  pasteOffset = 0;
}

export function cutSelected(): void {
  copySelected();
  history.capture();
  const selected = store.getSelectedElements();
  const ids: string[] = [];
  for (const el of selected) {
    ids.push(el.id);
    if (el.boundElements) {
      for (const b of el.boundElements) {
        if (b.type === 'text') {
          ids.push(b.id);
          store.deleteElement(b.id);
        }
      }
    }
    store.deleteElement(el.id);
  }
  wsClient.sendElementDelete(ids);
  store.clearSelection();
}

export function paste(): void {
  if (clipboardElements.length === 0) return;

  history.capture();
  pasteOffset += 20;

  const newElements: ExcalidrawElement[] = clipboardElements.map(el => ({
    ...el,
    id: generateId(),
    x: el.x + pasteOffset,
    y: el.y + pasteOffset,
    seed: generateSeed(),
    version: 1,
    versionNonce: generateSeed(),
  }));

  store.clearSelection();
  for (const el of newElements) {
    store.updateElement(el);
    store.selectElement(el.id, true);
  }
  wsClient.sendElementUpdate(newElements);
}

export function deleteSelected(): void {
  const selected = store.getSelectedElements();
  if (selected.length === 0) return;

  history.capture();
  const ids: string[] = [];
  for (const el of selected) {
    ids.push(el.id);
    // Also delete bound text elements
    if (el.boundElements) {
      for (const b of el.boundElements) {
        if (b.type === 'text') {
          ids.push(b.id);
          store.deleteElement(b.id);
        }
      }
    }
    store.deleteElement(el.id);
  }
  wsClient.sendElementDelete(ids);
  store.clearSelection();
}
