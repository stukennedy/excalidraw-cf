import type { ExcalidrawElement, AppState } from './types';
import { getDefaultAppState } from './types';

const STYLE_STORAGE_KEY = 'excalidraw-cf-styles';
const PERSISTED_STYLE_KEYS = [
  'strokeColor', 'backgroundColor', 'fillStyle',
  'strokeWidth', 'strokeStyle', 'roughness', 'opacity',
  'fontSize', 'fontFamily',
] as const;

function loadPersistedStyles(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(STYLE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

class StateStore {
  elements: Map<string, ExcalidrawElement> = new Map();
  appState: AppState = { ...getDefaultAppState(), ...loadPersistedStyles() };
  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(): void {
    for (const listener of this.listeners) listener();
  }

  getElement(id: string): ExcalidrawElement | undefined {
    return this.elements.get(id);
  }

  getVisibleElements(): ExcalidrawElement[] {
    return Array.from(this.elements.values()).filter(e => !e.isDeleted);
  }

  updateElement(element: ExcalidrawElement): void {
    this.elements.set(element.id, element);
    this.notify();
  }

  updateElements(elements: ExcalidrawElement[]): void {
    for (const el of elements) {
      this.elements.set(el.id, el);
    }
    this.notify();
  }

  deleteElement(id: string): void {
    const el = this.elements.get(id);
    if (el) {
      this.elements.set(id, { ...el, isDeleted: true, version: el.version + 1 });
      this.notify();
    }
  }

  setAppState(partial: Partial<AppState>): void {
    Object.assign(this.appState, partial);

    // Persist style properties to localStorage
    const toSave: Record<string, unknown> = {};
    for (const key of PERSISTED_STYLE_KEYS) {
      toSave[key] = this.appState[key];
    }
    try { localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(toSave)); } catch {}

    this.notify();
  }

  getSelectedElements(): ExcalidrawElement[] {
    return this.getVisibleElements().filter(el => this.appState.selectedElementIds.has(el.id));
  }

  clearSelection(): void {
    this.appState.selectedElementIds = new Set();
    this.notify();
  }

  selectElement(id: string, addToSelection = false): void {
    if (!addToSelection) {
      this.appState.selectedElementIds = new Set();
    }
    this.appState.selectedElementIds.add(id);
    this.notify();
  }
}

export const store = new StateStore();
