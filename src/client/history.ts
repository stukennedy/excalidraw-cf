import type { ExcalidrawElement } from './types';
import { store } from './state';
import { wsClient } from './ws-client';

interface HistoryEntry {
  elements: Map<string, ExcalidrawElement>;
}

class HistoryManager {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private maxSize = 100;

  capture(): void {
    const snapshot: HistoryEntry = {
      elements: new Map(store.elements),
    };
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo(): void {
    if (this.undoStack.length === 0) return;

    // Save current state for redo
    this.redoStack.push({
      elements: new Map(store.elements),
    });

    const entry = this.undoStack.pop()!;
    store.elements = new Map(entry.elements);
    store.clearSelection();
    store.notify();
    this.syncToDO();
  }

  redo(): void {
    if (this.redoStack.length === 0) return;

    // Save current state for undo
    this.undoStack.push({
      elements: new Map(store.elements),
    });

    const entry = this.redoStack.pop()!;
    store.elements = new Map(entry.elements);
    store.clearSelection();
    store.notify();
    this.syncToDO();
  }

  private syncToDO(): void {
    const elements = Array.from(store.elements.values());
    if (elements.length > 0) {
      wsClient.sendElementUpdate(elements);
    }
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }
}

export const history = new HistoryManager();
