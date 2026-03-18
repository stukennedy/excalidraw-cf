const presetColors = [
  '#1e1e1e', '#343a40', '#495057', '#c92a2a', '#a61e4d', '#862e9c',
  '#5f3dc4', '#364fc7', '#1864ab', '#0b7285', '#087f5b', '#2b8a3e',
  '#5c940d', '#e67700', '#d9480f', '#ffffff', '#f8f9fa', '#e9ecef',
  '#ffc9c9', '#fcc2d7', '#eebefa', '#d0bfff', '#bac8ff', '#a5d8ff',
  '#99e9f2', '#96f2d7', '#b2f2bb', '#d8f5a2', '#ffec99', '#ffe8cc',
];

export function ColorPicker({ property, label }: { property: string; label: string }) {
  return (
    <div class="color-picker">
      <label class="prop-label">{label}</label>
      <div class="color-grid">
        {presetColors.map((color) => (
          <button
            key={color}
            class="color-swatch-small"
            style={`background: ${color}; border: 1px solid ${color === '#ffffff' || color === '#f8f9fa' || color === '#e9ecef' ? '#ccc' : color}`}
            data-on-click={`$$dispatch('excalidraw:set-property', {detail: {property: '${property}', value: '${color}'}}); $${property} = '${color}'`}
          />
        ))}
      </div>
      <div class="color-custom">
        <label>Custom:</label>
        <input
          type="color"
          data-on-input={`$$dispatch('excalidraw:set-property', {detail: {property: '${property}', value: evt.target.value}}); $${property} = evt.target.value`}
        />
      </div>
    </div>
  );
}
