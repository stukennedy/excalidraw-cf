const strokeColors = ['#e6edf3', '#f85149', '#3fb950', '#58a6ff', '#d29922', '#bc8cff', '#f0883e', '#39d2c0'];
const bgColors = [
  'transparent',
  'rgba(248, 81, 73, 0.12)',
  'rgba(63, 185, 80, 0.12)',
  'rgba(88, 166, 255, 0.12)',
  'rgba(210, 153, 34, 0.12)',
  'rgba(188, 140, 255, 0.12)',
  'rgba(57, 210, 192, 0.12)',
];
const strokeWidths = [1, 2, 4];
const strokeStyles = ['solid', 'dashed', 'dotted'];
const fontSizes = [12, 16, 20, 28, 36];
const fontFamilies: { value: string; label: string }[] = [
  { value: 'Helvetica', label: 'Sans' },
  { value: 'Virgil', label: 'Hand' },
  { value: 'Cascadia', label: 'Mono' },
];
const textAligns = ['left', 'center', 'right'];

function dispatch(property: string, value: string) {
  return `window.dispatchEvent(new CustomEvent('excalidraw:set-property', {detail: {property: '${property}', value: ${value}}}))`;
}

export function PropertiesPanel() {
  return (
    <div
      id="properties-panel"
      class="properties-panel"
      style="display:none"
      data-show="$selectedCount > 0 && ($activeTool === 'selection' || $activeTool === 'hand')"
    >
      {/* Stroke Color */}
      <div class="prop-section">
        <label class="prop-label">Stroke</label>
        <div class="color-row">
          {strokeColors.map((color) => (
            <button
              key={color}
              class="color-swatch"
              style={`background: ${color}`}
              data-attr-class={`$strokeColor === '${color}' ? 'color-swatch active' : 'color-swatch'`}
              data-on-click={`$strokeColor = '${color}'; ${dispatch('strokeColor', `'${color}'`)}`}
            />
          ))}
        </div>
      </div>

      {/* Background Color */}
      <div class="prop-section">
        <label class="prop-label">Background</label>
        <div class="color-row">
          {bgColors.map((color) => (
            <button
              key={color}
              class="color-swatch"
              style={`background: ${color === 'transparent'
                ? 'repeating-conic-gradient(rgba(255,255,255,0.06) 0% 25%, transparent 0% 50%) 50% / 8px 8px'
                : color}`}
              data-attr-class={`$backgroundColor === '${color}' ? 'color-swatch active' : 'color-swatch'`}
              data-on-click={`$backgroundColor = '${color}'; ${dispatch('backgroundColor', `'${color}'`)}`}
            />
          ))}
        </div>
      </div>

      {/* Stroke Width */}
      <div class="prop-section">
        <label class="prop-label">Stroke width</label>
        <div class="btn-row">
          {strokeWidths.map((w) => (
            <button
              key={w}
              class="prop-btn"
              data-attr-class={`$strokeWidth === ${w} ? 'prop-btn active' : 'prop-btn'`}
              data-on-click={`$strokeWidth = ${w}; ${dispatch('strokeWidth', String(w))}`}
            >
              <div class="stroke-preview">
                <div class="stroke-preview-line" style={`height: ${w}px`} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Stroke Style */}
      <div class="prop-section">
        <label class="prop-label">Stroke style</label>
        <div class="btn-row">
          {strokeStyles.map((s) => (
            <button
              key={s}
              class="prop-btn"
              data-attr-class={`$strokeStyle === '${s}' ? 'prop-btn active' : 'prop-btn'`}
              data-on-click={`$strokeStyle = '${s}'; ${dispatch('strokeStyle', `'${s}'`)}`}
            >
              {s === 'solid' ? '\u2500\u2500' : s === 'dashed' ? '- -' : '\u00b7\u00b7\u00b7'}
            </button>
          ))}
        </div>
      </div>

      {/* Edges (Corner Radius) */}
      <div class="prop-section">
        <label class="prop-label">Edges</label>
        <div class="btn-row">
          <button
            class="prop-btn"
            data-attr-class={`$cornerRadius === 0 ? 'prop-btn active' : 'prop-btn'`}
            data-on-click={`$cornerRadius = 0; ${dispatch('cornerRadius', '0')}`}
          >
            Sharp
          </button>
          <button
            class="prop-btn"
            data-attr-class={`$cornerRadius === 12 ? 'prop-btn active' : 'prop-btn'`}
            data-on-click={`$cornerRadius = 12; ${dispatch('cornerRadius', '12')}`}
          >
            Round
          </button>
        </div>
      </div>

      {/* Glow */}
      <div class="prop-section">
        <button
          class="prop-toggle"
          data-attr-class={`$glow ? 'prop-toggle active' : 'prop-toggle'`}
          data-on-click={`$glow = !$glow; ${dispatch('glow', '$glow')}`}
        >
          <span class="toggle-dot" />
          Glow effect
        </button>
      </div>

      {/* Opacity */}
      <div class="prop-section">
        <label class="prop-label">Opacity</label>
        <div class="opacity-row">
          <input
            type="range"
            min="0"
            max="100"
            class="opacity-slider"
            data-model="opacity"
            data-on-input={`${dispatch('opacity', 'Number(evt.target.value)')}`}
          />
          <span class="opacity-value" data-text="$opacity">100</span>
        </div>
      </div>

      {/* Text properties — shown only when a text element is selected */}
      <div data-show="$hasText">
        <div class="prop-divider" />

        {/* Font Size */}
        <div class="prop-section">
          <label class="prop-label">Font size</label>
          <div class="btn-row">
            {fontSizes.map((s) => (
              <button
                key={s}
                class="prop-btn"
                data-attr-class={`$fontSize === ${s} ? 'prop-btn active' : 'prop-btn'`}
                data-on-click={`$fontSize = ${s}; ${dispatch('fontSize', String(s))}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Font Family */}
        <div class="prop-section">
          <label class="prop-label">Font</label>
          <div class="btn-row">
            {fontFamilies.map((f) => (
              <button
                key={f.value}
                class="prop-btn"
                data-attr-class={`$fontFamily === '${f.value}' ? 'prop-btn active' : 'prop-btn'`}
                data-on-click={`$fontFamily = '${f.value}'; ${dispatch('fontFamily', `'${f.value}'`)}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Text Align */}
        <div class="prop-section">
          <label class="prop-label">Align</label>
          <div class="btn-row">
            {textAligns.map((a) => (
              <button
                key={a}
                class="prop-btn"
                data-attr-class={`$textAlign === '${a}' ? 'prop-btn active' : 'prop-btn'`}
                data-on-click={`$textAlign = '${a}'; ${dispatch('textAlign', `'${a}'`)}`}
              >
                {a === 'left' ? '\u2261' : a === 'center' ? '\u2550' : '\u2261'}
                <span style="font-size: 10px; margin-left: 2px">{a.charAt(0).toUpperCase() + a.slice(1)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div class="prop-divider" />

      {/* Layers */}
      <div class="prop-section">
        <label class="prop-label">Layers</label>
        <div class="layer-row">
          <button class="layer-btn" title="Send to back" data-on-click="window.dispatchEvent(new CustomEvent('excalidraw:action', {detail: {action: 'sendToBack'}}))">
            <svg viewBox="0 0 24 24"><polyline points="18 18 12 22 6 18"/><polyline points="18 14 12 18 6 14"/><polyline points="18 6 12 10 6 6"/><polyline points="18 2 12 6 6 2"/></svg>
          </button>
          <button class="layer-btn" title="Bring to front" data-on-click="window.dispatchEvent(new CustomEvent('excalidraw:action', {detail: {action: 'bringToFront'}}))">
            <svg viewBox="0 0 24 24"><polyline points="6 6 12 2 18 6"/><polyline points="6 10 12 6 18 10"/><polyline points="6 18 12 14 18 18"/><polyline points="6 22 12 18 18 22"/></svg>
          </button>
        </div>
      </div>

      {/* Actions */}
      <div class="prop-section">
        <label class="prop-label">Actions</label>
        <div class="action-row">
          <button class="action-icon-btn" title="Duplicate" data-on-click="window.dispatchEvent(new CustomEvent('excalidraw:action', {detail: {action: 'copy'}})); window.dispatchEvent(new CustomEvent('excalidraw:action', {detail: {action: 'paste'}}))">
            <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="1"/><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1"/></svg>
          </button>
          <button class="action-icon-btn danger" title="Delete" data-on-click="window.dispatchEvent(new CustomEvent('excalidraw:action', {detail: {action: 'delete'}}))">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
