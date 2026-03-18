import type { ExcalidrawElement } from './types';
import { store } from './state';
import { history } from './history';

export function importFromFile(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.excalidraw,.json';

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.type !== 'excalidraw' || !Array.isArray(data.elements)) {
        alert('Invalid Excalidraw file');
        return;
      }

      history.capture();
      store.elements.clear();
      store.updateElements(data.elements as ExcalidrawElement[]);
      store.clearSelection();
    } catch {
      alert('Failed to parse file');
    }
  };

  input.click();
}

export function loadFromJSON(json: string): void {
  try {
    const data = JSON.parse(json);
    if (Array.isArray(data.elements)) {
      store.updateElements(data.elements as ExcalidrawElement[]);
    }
  } catch {
    console.error('Failed to load JSON');
  }
}
