import { Toolbar } from './toolbar';
import { PropertiesPanel } from './properties-panel';
import { ZoomControls } from './zoom-controls';
import { ExportDialog } from './export-dialog';
import { ContextMenu } from './context-menu';

export function DrawingPage({ roomId }: { roomId?: string }) {
  return (
    <div
      id="app"
      data-signals-active-tool="'selection'"
      data-signals-stroke-color="'#1e1e1e'"
      data-signals-background-color="'transparent'"
      data-signals-fill-style="'hachure'"
      data-signals-stroke-width="2"
      data-signals-stroke-style="'solid'"
      data-signals-roughness="1"
      data-signals-opacity="100"
      data-signals-font-size="20"
      data-signals-font-family="'Virgil'"
      data-signals-zoom="100"
      data-signals-selected-count="0"
      data-signals-room-id={roomId ? `'${roomId}'` : "''"}
      data-signals-theme="'light'"
      data-signals-connected="false"
      data-signals-show-help="false"
      data-signals-show-export="false"
    >
      <canvas id="excalidraw-canvas" />

      <Toolbar />
      <PropertiesPanel />
      <ZoomControls />
      <ExportDialog />
      <ContextMenu />

      {/* Top-right actions */}
      <div class="top-actions">
        <button
          class="action-btn"
          title="Import file"
          data-on-click="window.dispatchEvent(new CustomEvent('excalidraw:action', {detail: {action: 'import'}}))"
        >
          Open
        </button>
        <button
          class="action-btn"
          title="Export drawing"
          data-on-click="$showExport = true"
        >
          Export
        </button>
        <button
          class="action-btn"
          title="Toggle theme"
          data-on-click="$theme = $theme === 'light' ? 'dark' : 'light'; document.getElementById('app').setAttribute('data-theme', $theme)"
        >
          Theme
        </button>
        {roomId && (
          <span class="connection-status" data-show="$connected" data-attr-class="$connected ? 'connection-status connected' : 'connection-status'">
            <span class="status-dot" />
            <span>Connected</span>
          </span>
        )}
      </div>

      {/* Help indicator */}
      <div class="help-indicator">
        <button class="action-btn" data-on-click="$showHelp = !$showHelp">
          ? Help
        </button>
      </div>

      {/* Help modal */}
      <div id="help-modal" class="modal-overlay" style="display:none" data-show="$showHelp">
        <div class="modal">
          <div class="modal-header">
            <h3>Keyboard Shortcuts</h3>
            <button class="modal-close" data-on-click="$showHelp = false">{'\u00d7'}</button>
          </div>
          <div class="modal-body shortcuts-grid">
            <div><kbd>V</kbd> Selection</div>
            <div><kbd>R</kbd> Rectangle</div>
            <div><kbd>O</kbd> Ellipse</div>
            <div><kbd>D</kbd> Diamond</div>
            <div><kbd>L</kbd> Line</div>
            <div><kbd>A</kbd> Arrow</div>
            <div><kbd>P</kbd> Pencil</div>
            <div><kbd>T</kbd> Text</div>
            <div><kbd>E</kbd> Eraser</div>
            <div><kbd>H</kbd> Hand (pan)</div>
            <div><kbd>Ctrl+Z</kbd> Undo</div>
            <div><kbd>Ctrl+Shift+Z</kbd> Redo</div>
            <div><kbd>Ctrl+C</kbd> Copy</div>
            <div><kbd>Ctrl+V</kbd> Paste</div>
            <div><kbd>Del</kbd> Delete</div>
            <div><kbd>Ctrl+=</kbd> Zoom in</div>
            <div><kbd>Ctrl+-</kbd> Zoom out</div>
            <div><kbd>Scroll</kbd> Pan</div>
            <div><kbd>Ctrl+Scroll</kbd> Zoom</div>
            <div><kbd>Shift+Click</kbd> Multi-select</div>
          </div>
        </div>
      </div>
    </div>
  );
}
