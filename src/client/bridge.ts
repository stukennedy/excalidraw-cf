import { store } from './state';
import { setTool } from './interaction';
import type { Tool } from './types';
import { generateSeed } from './types';
import { exportToPNG, exportToSVG, exportToJSON } from './export';
import { importFromFile } from './import';
import { copySelected, cutSelected, paste, deleteSelected } from './clipboard';
import { bringToFront, sendToBack } from './z-order';
import { wsClient } from './ws-client';

export function setupBridge(): void {
  // Datastar -> Canvas: Tool selection
  window.addEventListener('excalidraw:set-tool', ((e: CustomEvent) => {
    setTool(e.detail.tool as Tool);
  }) as EventListener);

  // Datastar -> Canvas: Property changes
  window.addEventListener('excalidraw:set-property', ((e: CustomEvent) => {
    const { property, value } = e.detail;
    const selected = store.getSelectedElements();

    if (selected.length > 0) {
      const updated: typeof selected = [];
      for (const el of selected) {
        const newEl = {
          ...el,
          [property]: value,
          version: el.version + 1,
          versionNonce: generateSeed(),
        };
        store.updateElement(newEl);
        updated.push(newEl);
      }
      wsClient.sendElementUpdate(updated);
    }

    if (property in store.appState) {
      store.setAppState({ [property]: value } as any);
    }
  }) as EventListener);

  // Datastar -> Canvas: Zoom
  window.addEventListener('excalidraw:set-zoom', ((e: CustomEvent) => {
    store.setAppState({ zoom: e.detail.zoom });
  }) as EventListener);

  // Datastar -> Canvas: Export
  window.addEventListener('excalidraw:export', ((e: CustomEvent) => {
    switch (e.detail.format) {
      case 'png': exportToPNG(); break;
      case 'svg': exportToSVG(); break;
      case 'json': exportToJSON(); break;
    }
  }) as EventListener);

  // Datastar -> Canvas: Actions (import, copy, paste, etc.)
  window.addEventListener('excalidraw:action', ((e: CustomEvent) => {
    switch (e.detail.action) {
      case 'import': importFromFile(); break;
      case 'copy': copySelected(); break;
      case 'cut': cutSelected(); break;
      case 'paste': paste(); break;
      case 'delete': deleteSelected(); break;
      case 'bringToFront': bringToFront(); break;
      case 'sendToBack': sendToBack(); break;
    }
  }) as EventListener);

  // Context menu - managed entirely via JS DOM, not Datastar
  setupContextMenu();

  // Canvas -> Datastar: Push state changes to Datastar signals
  store.subscribe(() => {
    const app = document.getElementById('app');
    if (!app) return;

    const selected = store.getSelectedElements();

    app.dataset.signalsSelectedCount = String(selected.length);
    app.dataset.signalsActiveTool = `'${store.appState.activeTool}'`;
    app.dataset.signalsZoom = String(Math.round(store.appState.zoom * 100));

    if (selected.length === 1) {
      const el = selected[0];
      app.dataset.signalsStrokeColor = `'${el.strokeColor}'`;
      app.dataset.signalsBackgroundColor = `'${el.backgroundColor}'`;
      app.dataset.signalsFillStyle = `'${el.fillStyle}'`;
      app.dataset.signalsStrokeWidth = String(el.strokeWidth);
      app.dataset.signalsStrokeStyle = `'${el.strokeStyle}'`;
      app.dataset.signalsRoughness = String(el.roughness);
      app.dataset.signalsOpacity = String(el.opacity);
    }
  });
}

function setupContextMenu(): void {
  const menu = document.getElementById('context-menu');
  if (!menu) return;

  // Show on right-click
  window.addEventListener('excalidraw:context-menu', ((e: CustomEvent) => {
    menu.style.display = 'block';
    menu.style.left = `${e.detail.x}px`;
    menu.style.top = `${e.detail.y}px`;
  }) as EventListener);

  // Handle menu item clicks
  menu.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (target) {
      const action = target.dataset.action;
      if (action) {
        window.dispatchEvent(new CustomEvent('excalidraw:action', { detail: { action } }));
      }
      menu.style.display = 'none';
    }
  });

  // Close on any click outside the menu
  document.addEventListener('pointerdown', (e) => {
    if (menu.style.display !== 'none' && !menu.contains(e.target as Node)) {
      menu.style.display = 'none';
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      menu.style.display = 'none';
    }
  });
}
