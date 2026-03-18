import type { Tool, IconType } from '../types/elements';
import { allIconTypes, iconLabels } from '../client/icons';

interface ToolDef {
  id: Tool;
  label: string;
  shortcut: string;
  svg: string;
}

const tools: ToolDef[] = [
  { id: 'hand', label: 'Hand (pan)', shortcut: 'H',
    svg: '<path d="M18 11V3a1 1 0 00-2 0v5M14 10V2a1 1 0 00-2 0v8M10 10V4a1 1 0 00-2 0v7M6 15V8a1 1 0 00-2 0v8a7 7 0 0014 0v-5a1 1 0 00-2 0v3"/>' },
  { id: 'selection', label: 'Selection', shortcut: 'V',
    svg: '<path d="M4 4l7 17 2.5-6.5L20 12z"/>' },
];

const shapeTools: ToolDef[] = [
  { id: 'rectangle', label: 'Rectangle', shortcut: 'R',
    svg: '<rect x="3" y="5" width="18" height="14" rx="1"/>' },
  { id: 'ellipse', label: 'Ellipse', shortcut: 'O',
    svg: '<ellipse cx="12" cy="12" rx="9" ry="7"/>' },
  { id: 'diamond', label: 'Diamond', shortcut: 'D',
    svg: '<path d="M12 2l9 10-9 10-9-10z"/>' },
];

const lineTools: ToolDef[] = [
  { id: 'line', label: 'Line', shortcut: 'L',
    svg: '<line x1="5" y1="19" x2="19" y2="5"/>' },
  { id: 'arrow', label: 'Arrow', shortcut: 'A',
    svg: '<line x1="5" y1="19" x2="19" y2="5"/><polyline points="12 5 19 5 19 12"/>' },
];

const drawTools: ToolDef[] = [
  { id: 'freedraw', label: 'Pencil', shortcut: 'P',
    svg: '<path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z"/>' },
  { id: 'text', label: 'Text', shortcut: 'T',
    svg: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/>' },
];

const otherTools: ToolDef[] = [
  { id: 'eraser', label: 'Eraser', shortcut: 'E',
    svg: '<path d="M20 20H7L2 15l10-10 8 8-5 5M14 4l6 6"/>' },
  { id: 'icon', label: 'Icons', shortcut: 'I',
    svg: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>' },
];

function ToolButton({ tool }: { tool: ToolDef }) {
  return (
    <button
      class="toolbar-btn"
      title={`${tool.label} (${tool.shortcut})`}
      data-attr-class={`$activeTool === '${tool.id}' ? 'toolbar-btn active' : 'toolbar-btn'`}
      data-on-click={`$activeTool = '${tool.id}'; window.dispatchEvent(new CustomEvent('excalidraw:set-tool', {detail: {tool: '${tool.id}'}}))`}
      dangerouslySetInnerHTML={{
        __html: `<svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round">${tool.svg}</svg><span class="shortcut-hint">${tool.shortcut}</span>`,
      }}
    />
  );
}

export function Toolbar() {
  return (
    <div id="toolbar" class="toolbar">
      {tools.map((tool) => <ToolButton key={tool.id} tool={tool} />)}
      <div class="toolbar-divider" />
      {shapeTools.map((tool) => <ToolButton key={tool.id} tool={tool} />)}
      <div class="toolbar-divider" />
      {lineTools.map((tool) => <ToolButton key={tool.id} tool={tool} />)}
      <div class="toolbar-divider" />
      {drawTools.map((tool) => <ToolButton key={tool.id} tool={tool} />)}
      <div class="toolbar-divider" />
      {otherTools.map((tool) => <ToolButton key={tool.id} tool={tool} />)}
    </div>
  );
}

export function IconPicker() {
  return (
    <div id="icon-picker" class="icon-picker" style="display:none" data-show="$activeTool === 'icon'">
      {allIconTypes.map((iconType: IconType) => (
        <button
          key={iconType}
          class="icon-picker-btn"
          data-attr-class={`$iconType === '${iconType}' ? 'icon-picker-btn active' : 'icon-picker-btn'`}
          data-on-click={`$iconType = '${iconType}'; window.dispatchEvent(new CustomEvent('excalidraw:set-icon-type', {detail: {iconType: '${iconType}'}}))`}
        >
          <svg viewBox="0 0 28 28" width="28" height="28">
            <text x="14" y="18" text-anchor="middle" font-size="10" fill="currentColor">{iconLabels[iconType].substring(0, 3)}</text>
          </svg>
          {iconLabels[iconType]}
        </button>
      ))}
    </div>
  );
}
