import type { Tool } from '../types/elements';

interface ToolDef {
  id: Tool;
  label: string;
  icon: string;
  shortcut: string;
}

const tools: ToolDef[] = [
  { id: 'hand', label: 'Hand (pan)', icon: '\u{1F91A}', shortcut: 'H' },
  { id: 'selection', label: 'Selection', icon: '\u{1F446}', shortcut: 'V' },
  { id: 'rectangle', label: 'Rectangle', icon: '\u25AD', shortcut: 'R' },
  { id: 'ellipse', label: 'Ellipse', icon: '\u25EF', shortcut: 'O' },
  { id: 'diamond', label: 'Diamond', icon: '\u25C7', shortcut: 'D' },
  { id: 'line', label: 'Line', icon: '\u2571', shortcut: 'L' },
  { id: 'arrow', label: 'Arrow', icon: '\u2192', shortcut: 'A' },
  { id: 'freedraw', label: 'Pencil', icon: '\u270F', shortcut: 'P' },
  { id: 'text', label: 'Text', icon: 'T', shortcut: 'T' },
  { id: 'eraser', label: 'Eraser', icon: '\u{1F9F9}', shortcut: 'E' },
];

export function Toolbar() {
  return (
    <div id="toolbar" class="toolbar">
      {tools.map((tool) => (
        <button
          key={tool.id}
          class="toolbar-btn"
          title={`${tool.label} (${tool.shortcut})`}
          data-attr-class={`$activeTool === '${tool.id}' ? 'toolbar-btn active' : 'toolbar-btn'`}
          data-on-click={`$activeTool = '${tool.id}'; window.dispatchEvent(new CustomEvent('excalidraw:set-tool', {detail: {tool: '${tool.id}'}}))`}
        >
          <span class="tool-icon">{tool.icon}</span>
        </button>
      ))}
    </div>
  );
}
