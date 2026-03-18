import { setTool, nudgeSelected } from './interaction';
import { history } from './history';
import { copySelected, cutSelected, paste, deleteSelected } from './clipboard';
import { bringToFront, sendToBack, bringForward, sendBackward } from './z-order';
import { store } from './state';
import { zoomAtPoint } from './camera';

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
}

const shortcuts: Shortcut[] = [
  // Tools
  { key: 'v', action: () => setTool('selection') },
  { key: '1', action: () => setTool('selection') },
  { key: 'r', action: () => setTool('rectangle') },
  { key: '2', action: () => setTool('rectangle') },
  { key: 'o', action: () => setTool('ellipse') },
  { key: '3', action: () => setTool('ellipse') },
  { key: 'd', action: () => setTool('diamond') },
  { key: '4', action: () => setTool('diamond') },
  { key: 'l', action: () => setTool('line') },
  { key: '5', action: () => setTool('line') },
  { key: 'a', action: () => setTool('arrow') },
  { key: '6', action: () => setTool('arrow') },
  { key: 'p', action: () => setTool('freedraw') },
  { key: '7', action: () => setTool('freedraw') },
  { key: 't', action: () => setTool('text') },
  { key: '8', action: () => setTool('text') },
  { key: 'e', action: () => setTool('eraser') },
  { key: '9', action: () => setTool('eraser') },
  { key: 'i', action: () => setTool('icon') },
  { key: 'h', action: () => setTool('hand') },
  { key: '0', action: () => setTool('hand') },

  // Undo/Redo
  { key: 'z', ctrl: true, action: () => history.undo() },
  { key: 'z', ctrl: true, shift: true, action: () => history.redo() },
  { key: 'y', ctrl: true, action: () => history.redo() },

  // Clipboard
  { key: 'c', ctrl: true, action: () => copySelected() },
  { key: 'x', ctrl: true, action: () => cutSelected() },
  { key: 'v', ctrl: true, action: () => paste() },

  // Delete
  { key: 'Delete', action: () => deleteSelected() },
  { key: 'Backspace', action: () => deleteSelected() },

  // Select all
  { key: 'a', ctrl: true, action: () => {
    const elements = store.getVisibleElements();
    store.appState.selectedElementIds = new Set(elements.map(el => el.id));
    store.notify();
  }},

  // Nudge
  { key: 'ArrowUp', action: () => nudgeSelected(0, -1) },
  { key: 'ArrowDown', action: () => nudgeSelected(0, 1) },
  { key: 'ArrowLeft', action: () => nudgeSelected(-1, 0) },
  { key: 'ArrowRight', action: () => nudgeSelected(1, 0) },
  { key: 'ArrowUp', shift: true, action: () => nudgeSelected(0, -10) },
  { key: 'ArrowDown', shift: true, action: () => nudgeSelected(0, 10) },
  { key: 'ArrowLeft', shift: true, action: () => nudgeSelected(-10, 0) },
  { key: 'ArrowRight', shift: true, action: () => nudgeSelected(10, 0) },

  // Z-order
  { key: ']', ctrl: true, shift: true, action: () => bringToFront() },
  { key: '[', ctrl: true, shift: true, action: () => sendToBack() },
  { key: ']', ctrl: true, action: () => bringForward() },
  { key: '[', ctrl: true, action: () => sendBackward() },

  // Zoom
  { key: '=', ctrl: true, action: () => {
    const c = document.querySelector('canvas')!;
    zoomAtPoint(store.appState.zoom * 1.1, c.width / 2, c.height / 2);
  }},
  { key: '-', ctrl: true, action: () => {
    const c = document.querySelector('canvas')!;
    zoomAtPoint(store.appState.zoom * 0.9, c.width / 2, c.height / 2);
  }},
  { key: '0', ctrl: true, action: () => {
    store.setAppState({ zoom: 1 });
  }},

  // Escape
  { key: 'Escape', action: () => {
    store.clearSelection();
    setTool('selection');
  }},
];

export function setupShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    // Don't handle if typing in input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (store.appState.editingElement) return;

    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    // Find matching shortcut (more specific first)
    const match = shortcuts.find(s => {
      if (s.key !== e.key) return false;
      if (s.ctrl && !ctrl) return false;
      if (!s.ctrl && ctrl && s.key.length === 1) return false;
      if (s.shift && !shift) return false;
      if (!s.shift && shift && s.key.startsWith('Arrow')) return false;
      return true;
    });

    if (match) {
      e.preventDefault();
      match.action();
    }
  });
}
