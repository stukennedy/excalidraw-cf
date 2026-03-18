const strokeColors = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00', '#6741d9'];
const bgColors = ['transparent', '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99', '#d0bfff'];
const fillStyles = ['hachure', 'cross-hatch', 'solid', 'dots'];
const strokeWidths = [1, 2, 4];
const strokeStyles = ['solid', 'dashed', 'dotted'];
const roughnessLevels = [0, 1, 2];

function dispatch(property: string, value: string) {
  return `window.dispatchEvent(new CustomEvent('excalidraw:set-property', {detail: {property: '${property}', value: ${value}}}))`;
}

export function PropertiesPanel() {
  return (
    <div
      id="properties-panel"
      class="properties-panel"
      data-show="$selectedCount > 0 || $activeTool !== 'selection'"
    >
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

      <div class="prop-section">
        <label class="prop-label">Background</label>
        <div class="color-row">
          {bgColors.map((color) => (
            <button
              key={color}
              class="color-swatch"
              style={`background: ${color === 'transparent' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)' : color}; background-size: 8px 8px; background-position: 0 0, 4px 4px;`}
              data-attr-class={`$backgroundColor === '${color}' ? 'color-swatch active' : 'color-swatch'`}
              data-on-click={`$backgroundColor = '${color}'; ${dispatch('backgroundColor', `'${color}'`)}`}
            />
          ))}
        </div>
      </div>

      <div class="prop-section">
        <label class="prop-label">Fill</label>
        <div class="btn-row">
          {fillStyles.map((style) => (
            <button
              key={style}
              class="prop-btn"
              data-attr-class={`$fillStyle === '${style}' ? 'prop-btn active' : 'prop-btn'`}
              data-on-click={`$fillStyle = '${style}'; ${dispatch('fillStyle', `'${style}'`)}`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

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
              {w}px
            </button>
          ))}
        </div>
      </div>

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
              {s}
            </button>
          ))}
        </div>
      </div>

      <div class="prop-section">
        <label class="prop-label">Roughness</label>
        <div class="btn-row">
          {roughnessLevels.map((r) => (
            <button
              key={r}
              class="prop-btn"
              data-attr-class={`$roughness === ${r} ? 'prop-btn active' : 'prop-btn'`}
              data-on-click={`$roughness = ${r}; ${dispatch('roughness', String(r))}`}
            >
              {r === 0 ? 'None' : r === 1 ? 'Low' : 'High'}
            </button>
          ))}
        </div>
      </div>

      <div class="prop-section">
        <label class="prop-label">Opacity</label>
        <input
          type="range"
          min="0"
          max="100"
          class="opacity-slider"
          data-model="opacity"
          data-on-input={`${dispatch('opacity', 'Number(evt.target.value)')}`}
        />
      </div>
    </div>
  );
}
