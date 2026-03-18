export function ZoomControls() {
  return (
    <div id="zoom-controls" class="zoom-controls">
      <button
        class="zoom-btn"
        title="Zoom out"
        data-on-click="$zoom = Math.max(10, $zoom - 10); window.dispatchEvent(new CustomEvent('excalidraw:set-zoom', {detail: {zoom: $zoom / 100}}))"
      >
        -
      </button>
      <span class="zoom-level" data-text="$zoom + '%'">100%</span>
      <button
        class="zoom-btn"
        title="Zoom in"
        data-on-click="$zoom = Math.min(1000, $zoom + 10); window.dispatchEvent(new CustomEvent('excalidraw:set-zoom', {detail: {zoom: $zoom / 100}}))"
      >
        +
      </button>
      <button
        class="zoom-btn"
        title="Reset zoom"
        data-on-click="$zoom = 100; window.dispatchEvent(new CustomEvent('excalidraw:set-zoom', {detail: {zoom: 1}}))"
      >
        {'\u21BA'}
      </button>
    </div>
  );
}
