import { Toolbar, IconPicker } from './toolbar';
import { PropertiesPanel } from './properties-panel';
import { ZoomControls } from './zoom-controls';
import { ExportDialog } from './export-dialog';
import { ContextMenu } from './context-menu';

export function DrawingPage({ roomId }: { roomId?: string }) {
  return (
    <div
      id="app"
      data-signals-active-tool="'selection'"
      data-signals-stroke-color="'#e6edf3'"
      data-signals-background-color="'transparent'"
      data-signals-fill-style="'solid'"
      data-signals-stroke-width="2"
      data-signals-stroke-style="'solid'"
      data-signals-roughness="0"
      data-signals-opacity="100"
      data-signals-font-size="20"
      data-signals-font-family="'Helvetica'"
      data-signals-zoom="100"
      data-signals-selected-count="0"
      data-signals-room-id={roomId ? `'${roomId}'` : "''"}
      data-signals-connected="false"
      data-signals-show-help="false"
      data-signals-show-export="false"
      data-signals-glow="false"
      data-signals-corner-radius="0"
      data-signals-icon-type="'database'"
      data-signals-has-text="false"
      data-signals-text-align="'left'"
    >
      <canvas id="excalidraw-canvas" />

      {/* Hidden bridge: syncs canvas JS state → Datastar signals via custom events */}
      <div
        id="ds-bridge"
        style="display:none"
        data-on-ds-tool-sync__window="$activeTool = evt.detail.tool"
        data-on-ds-selection-sync__window="$selectedCount = evt.detail.count; $hasText = evt.detail.count === 0 ? false : $hasText"
        data-on-ds-props-sync__window="$strokeColor = evt.detail.strokeColor; $backgroundColor = evt.detail.backgroundColor; $strokeWidth = evt.detail.strokeWidth; $strokeStyle = evt.detail.strokeStyle; $opacity = evt.detail.opacity; $glow = evt.detail.glow; $cornerRadius = evt.detail.cornerRadius; $hasText = evt.detail.hasText; $fontSize = evt.detail.fontSize; $fontFamily = evt.detail.fontFamily; $textAlign = evt.detail.textAlign"
        data-on-ds-zoom-sync__window="$zoom = evt.detail.zoom"
      />

      <Toolbar />
      <IconPicker />
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
          ?
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
            <div><kbd>I</kbd> Icons</div>
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
          </div>
        </div>
      </div>
    </div>
  );
}
