import { store } from './state';
import { setTool } from './interaction';
import type { Tool, IconType, TextElement, ExcalidrawElement } from './types';
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
  const textProps = new Set(['fontSize', 'fontFamily', 'textAlign']);
  window.addEventListener('excalidraw:set-property', ((e: CustomEvent) => {
    const { property, value } = e.detail;
    const selected = store.getSelectedElements();

    if (selected.length > 0) {
      const updated: ExcalidrawElement[] = [];

      if (textProps.has(property)) {
        // Text properties apply to the text element, not the container
        for (const el of selected) {
          let textEl: ExcalidrawElement | undefined;
          if (el.type === 'text') {
            textEl = el;
          } else if (el.boundElements) {
            for (const b of el.boundElements) {
              if (b.type === 'text') {
                textEl = store.getElement(b.id);
                break;
              }
            }
          }
          if (textEl) {
            const newEl = { ...textEl, [property]: value, version: textEl.version + 1, versionNonce: generateSeed() };
            store.updateElement(newEl);
            updated.push(newEl);
          }
        }
      } else {
        for (const el of selected) {
          const newEl = { ...el, [property]: value, version: el.version + 1, versionNonce: generateSeed() };
          store.updateElement(newEl);
          updated.push(newEl);
          // Sync strokeColor to bound text so text matches container stroke
          if (property === 'strokeColor' && el.boundElements) {
            for (const b of el.boundElements) {
              if (b.type === 'text') {
                const textEl = store.getElement(b.id);
                if (textEl) {
                  const newText = { ...textEl, strokeColor: value, version: textEl.version + 1, versionNonce: generateSeed() };
                  store.updateElement(newText);
                  updated.push(newText);
                }
              }
            }
          }
        }
      }

      if (updated.length > 0) wsClient.sendElementUpdate(updated);
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

  // Datastar -> Canvas: Icon type selection
  window.addEventListener('excalidraw:set-icon-type', ((e: CustomEvent) => {
    store.setAppState({ iconType: e.detail.iconType as IconType });
  }) as EventListener);

  // Context menu - managed entirely via JS DOM, not Datastar
  setupContextMenu();

  // Canvas -> Datastar: Push state changes via custom events on window
  // The hidden #ds-bridge element in drawing-page.tsx listens for these
  // and updates Datastar signals directly via expressions.
  let lastTool = store.appState.activeTool;
  let lastSelectedCount = 0;
  let lastZoom = store.appState.zoom;

  store.subscribe(() => {
    const selected = store.getSelectedElements();
    const tool = store.appState.activeTool;
    const zoom = Math.round(store.appState.zoom * 100);

    // Only dispatch events when values actually change to avoid unnecessary work
    if (tool !== lastTool) {
      lastTool = tool;
      window.dispatchEvent(new CustomEvent('ds-tool-sync', { detail: { tool } }));
    }

    if (selected.length !== lastSelectedCount) {
      lastSelectedCount = selected.length;
      window.dispatchEvent(new CustomEvent('ds-selection-sync', { detail: { count: selected.length } }));
    }

    if (zoom !== lastZoom) {
      lastZoom = zoom;
      window.dispatchEvent(new CustomEvent('ds-zoom-sync', { detail: { zoom } }));
    }

    if (selected.length === 1) {
      const el = selected[0];
      // Find the text element: either the element itself or bound text
      let textEl: TextElement | null = null;
      if (el.type === 'text') {
        textEl = el as TextElement;
      } else if (el.boundElements) {
        for (const b of el.boundElements) {
          if (b.type === 'text') {
            const t = store.getElement(b.id);
            if (t && t.type === 'text') { textEl = t as TextElement; break; }
          }
        }
      }
      window.dispatchEvent(new CustomEvent('ds-props-sync', {
        detail: {
          strokeColor: el.strokeColor,
          backgroundColor: el.backgroundColor,
          strokeWidth: el.strokeWidth,
          strokeStyle: el.strokeStyle,
          opacity: el.opacity,
          glow: el.glow,
          cornerRadius: el.cornerRadius,
          hasText: !!textEl,
          fontSize: textEl ? textEl.fontSize : 20,
          fontFamily: textEl ? textEl.fontFamily : 'Helvetica',
          textAlign: textEl ? textEl.textAlign : 'left',
        },
      }));
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
