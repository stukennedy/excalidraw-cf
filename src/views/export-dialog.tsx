export function ExportDialog() {
  return (
    <div
      id="export-dialog"
      class="modal-overlay"
      style="display:none"
      data-show="$showExport"
    >
      <div class="modal">
        <div class="modal-header">
          <h3>Export</h3>
          <button class="modal-close" data-on-click="$showExport = false">{'\u00d7'}</button>
        </div>
        <div class="modal-body">
          <div class="export-options">
            <button
              class="export-btn"
              data-on-click="window.dispatchEvent(new CustomEvent('excalidraw:export', {detail: {format: 'png'}})); $showExport = false"
            >
              <span>PNG Image</span>
              <span class="export-desc">High-res raster image</span>
            </button>
            <button
              class="export-btn"
              data-on-click="window.dispatchEvent(new CustomEvent('excalidraw:export', {detail: {format: 'svg'}})); $showExport = false"
            >
              <span>SVG Vector</span>
              <span class="export-desc">Scalable vector graphic</span>
            </button>
            <button
              class="export-btn"
              data-on-click="window.dispatchEvent(new CustomEvent('excalidraw:export', {detail: {format: 'json'}})); $showExport = false"
            >
              <span>Excalidraw File</span>
              <span class="export-desc">.excalidraw JSON format</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
