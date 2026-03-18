import type { ExcalidrawElement, LinearElement, ArrowElement, FreedrawElement, TextElement, IconElement } from './types';
import { store } from './state';
import { worldToScreen } from './camera';
import { getElementBounds, midpointToControlPoint } from './geometry';
import { drawIcon } from './icons';

let ctx: CanvasRenderingContext2D;

export function initRenderer(canvas: HTMLCanvasElement): void {
  ctx = canvas.getContext('2d')!;
}

export function renderScene(canvas: HTMLCanvasElement): void {
  const dpr = window.devicePixelRatio || 1;
  const logicalW = canvas.width / dpr;
  const logicalH = canvas.height / dpr;

  // Dark background
  ctx.fillStyle = '#0f1117';
  ctx.fillRect(0, 0, logicalW, logicalH);

  drawGrid(logicalW, logicalH);

  const elements = store.getVisibleElements();
  // Collect IDs of text elements bound to containers — they're rendered with their container
  const containedTextIds = new Set<string>();
  for (const element of elements) {
    if (element.boundElements) {
      for (const b of element.boundElements) {
        if (b.type === 'text') containedTextIds.add(b.id);
      }
    }
  }
  for (const element of elements) {
    if (containedTextIds.has(element.id)) continue; // Rendered by container
    renderElement(element);
  }

  renderSelectionUI();
  renderRemoteCursors();
}

function drawGrid(logicalW: number, logicalH: number): void {
  const { zoom, scrollX, scrollY } = store.appState;
  if (zoom < 0.3) return;

  const gridSize = 20;
  const scaledGrid = gridSize * zoom;
  if (scaledGrid < 10) return;

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.globalAlpha = Math.min(1, (scaledGrid - 10) / 10);

  const offsetX = ((scrollX % scaledGrid) + scaledGrid) % scaledGrid;
  const offsetY = ((scrollY % scaledGrid) + scaledGrid) % scaledGrid;

  // Dot grid
  for (let x = offsetX; x < logicalW; x += scaledGrid) {
    for (let y = offsetY; y < logicalH; y += scaledGrid) {
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
  ctx.restore();
}

function renderElement(element: ExcalidrawElement): void {
  const { zoom } = store.appState;

  ctx.save();
  ctx.globalAlpha = element.opacity / 100;

  const screenPos = worldToScreen(element.x, element.y);

  // Apply rotation around element center
  if (element.angle !== 0) {
    const bounds = getElementBounds(element);
    const center = worldToScreen(
      (bounds.minX + bounds.maxX) / 2,
      (bounds.minY + bounds.maxY) / 2
    );
    ctx.translate(center.x, center.y);
    ctx.rotate(element.angle);
    ctx.translate(-center.x, -center.y);
  }

  // Glow effect
  if (element.glow) {
    ctx.shadowColor = element.strokeColor;
    ctx.shadowBlur = 16;
  }

  ctx.strokeStyle = element.strokeColor;
  ctx.fillStyle = element.backgroundColor !== 'transparent' ? element.backgroundColor : 'transparent';
  ctx.lineWidth = element.strokeWidth * zoom;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (element.strokeStyle !== 'solid') {
    ctx.setLineDash(getStrokeDash(element.strokeStyle, element.strokeWidth * zoom));
  }

  const w = element.width * zoom;
  const h = element.height * zoom;

  switch (element.type) {
    case 'rectangle':
      renderRectangle(screenPos.x, screenPos.y, w, h, element);
      break;
    case 'ellipse':
      renderEllipse(screenPos.x, screenPos.y, w, h, element);
      break;
    case 'diamond':
      renderDiamond(screenPos.x, screenPos.y, w, h, element);
      break;
    case 'line':
      renderLinear(element as LinearElement);
      break;
    case 'arrow':
      renderArrow(element as ArrowElement);
      break;
    case 'freedraw':
      renderFreedraw(element as FreedrawElement);
      break;
    case 'text':
      renderText(element as TextElement);
      break;
    case 'icon':
      renderIconElement(element as IconElement);
      break;
  }

  // Render bound text centered inside container
  if (element.boundElements) {
    for (const bound of element.boundElements) {
      if (bound.type === 'text') {
        const textEl = store.getElement(bound.id) as TextElement | undefined;
        if (textEl && textEl.text && store.appState.editingElement !== textEl.id) {
          renderContainedText(textEl, element);
        }
      }
    }
  }

  ctx.restore();
}

function renderRectangle(x: number, y: number, w: number, h: number, el: ExcalidrawElement): void {
  const r = el.cornerRadius * store.appState.zoom;
  if (r > 0) {
    roundRect(ctx, x, y, w, h, Math.min(r, Math.min(w, h) / 2));
  } else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
  }
  if (el.backgroundColor !== 'transparent') ctx.fill();
  ctx.stroke();
}

function renderEllipse(x: number, y: number, w: number, h: number, el: ExcalidrawElement): void {
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  if (el.backgroundColor !== 'transparent') ctx.fill();
  ctx.stroke();
}

function renderDiamond(x: number, y: number, w: number, h: number, el: ExcalidrawElement): void {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = el.cornerRadius * store.appState.zoom;
  ctx.beginPath();
  if (r > 0) {
    const verts: [number, number][] = [[cx, y], [x + w, cy], [cx, y + h], [x, cy]];
    ctx.moveTo((verts[3][0] + verts[0][0]) / 2, (verts[3][1] + verts[0][1]) / 2);
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4;
      ctx.arcTo(verts[i][0], verts[i][1], verts[next][0], verts[next][1], r);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(cx, y);
    ctx.lineTo(x + w, cy);
    ctx.lineTo(cx, y + h);
    ctx.lineTo(x, cy);
    ctx.closePath();
  }
  if (el.backgroundColor !== 'transparent') ctx.fill();
  ctx.stroke();
}

function renderLinear(element: LinearElement): void {
  const points = element.points.map(([px, py]) => {
    const s = worldToScreen(element.x + px, element.y + py);
    return [s.x, s.y] as [number, number];
  });
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.stroke();
}

function renderArrow(element: ArrowElement): void {
  const points = element.points.map(([px, py]) => {
    const s = worldToScreen(element.x + px, element.y + py);
    return [s.x, s.y] as [number, number];
  });
  if (points.length < 2) return;

  ctx.beginPath();
  if (points.length === 3) {
    // points[1] is a pass-through midpoint — convert to bezier control point
    const [cpx, cpy] = midpointToControlPoint(
      points[0][0], points[0][1],
      points[1][0], points[1][1],
      points[2][0], points[2][1],
    );
    ctx.moveTo(points[0][0], points[0][1]);
    ctx.quadraticCurveTo(cpx, cpy, points[2][0], points[2][1]);

    ctx.stroke();

    // Arrowhead at end — tangent direction is from control point to end
    if (element.endArrowhead) {
      drawArrowhead(ctx, cpx, cpy, points[2][0], points[2][1], store.appState.zoom, element.strokeColor);
    }
    // Arrowhead at start — tangent direction is from control point to start
    if (element.startArrowhead) {
      drawArrowhead(ctx, cpx, cpy, points[0][0], points[0][1], store.appState.zoom, element.strokeColor);
    }
  } else {
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.stroke();

    if (element.endArrowhead) {
      const last = points[points.length - 1];
      const prev = points[points.length - 2];
      drawArrowhead(ctx, prev[0], prev[1], last[0], last[1], store.appState.zoom, element.strokeColor);
    }
    if (element.startArrowhead) {
      drawArrowhead(ctx, points[1][0], points[1][1], points[0][0], points[0][1], store.appState.zoom, element.strokeColor);
    }
  }
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  fromX: number, fromY: number,
  toX: number, toY: number,
  zoom: number,
  _color: string,
): void {
  const headLen = 14 * zoom;
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const a1 = angle - Math.PI / 6;
  const a2 = angle + Math.PI / 6;

  ctx.beginPath();
  ctx.moveTo(toX - headLen * Math.cos(a1), toY - headLen * Math.sin(a1));
  ctx.lineTo(toX, toY);
  ctx.lineTo(toX - headLen * Math.cos(a2), toY - headLen * Math.sin(a2));
  ctx.stroke();
}

function renderFreedraw(element: FreedrawElement): void {
  const { zoom } = store.appState;
  const points = element.points;
  if (points.length < 2) return;

  ctx.save();
  ctx.strokeStyle = element.strokeColor;
  ctx.lineWidth = element.strokeWidth * zoom;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  const start = worldToScreen(element.x + points[0][0], element.y + points[0][1]);
  ctx.moveTo(start.x, start.y);

  for (let i = 1; i < points.length; i++) {
    const p = worldToScreen(element.x + points[i][0], element.y + points[i][1]);
    ctx.lineTo(p.x, p.y);
  }

  ctx.stroke();
  ctx.restore();
}

function renderText(element: TextElement): void {
  const { zoom } = store.appState;
  const pos = worldToScreen(element.x, element.y);

  ctx.save();
  ctx.fillStyle = element.strokeColor;

  const fontFamily = element.fontFamily === 'Virgil' ? '"DM Sans", sans-serif'
    : element.fontFamily === 'Cascadia' ? '"JetBrains Mono", monospace'
    : '"DM Sans", Helvetica, Arial, sans-serif';

  ctx.font = `${element.fontSize * zoom}px ${fontFamily}`;
  ctx.textAlign = element.textAlign as CanvasTextAlign;
  ctx.textBaseline = 'top';

  const lines = element.text.split('\n');
  const lineHeight = element.fontSize * element.lineHeight * zoom;

  let textX = pos.x;
  if (element.textAlign === 'center') textX += (element.width * zoom) / 2;
  else if (element.textAlign === 'right') textX += element.width * zoom;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], textX, pos.y + i * lineHeight);
  }

  ctx.restore();
}

function renderContainedText(textEl: TextElement, container: ExcalidrawElement): void {
  const { zoom } = store.appState;

  ctx.save();
  ctx.globalAlpha = textEl.opacity / 100;
  ctx.fillStyle = textEl.strokeColor;

  const fontFamily = textEl.fontFamily === 'Virgil' ? '"DM Sans", sans-serif'
    : textEl.fontFamily === 'Cascadia' ? '"JetBrains Mono", monospace'
    : '"DM Sans", Helvetica, Arial, sans-serif';

  const fontSize = textEl.fontSize * zoom;
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const containerScreen = worldToScreen(container.x, container.y);
  const cx = containerScreen.x + (container.width * zoom) / 2;
  const cy = containerScreen.y + (container.height * zoom) / 2;

  const lines = textEl.text.split('\n');
  const lineHeight = textEl.fontSize * textEl.lineHeight * zoom;
  const totalHeight = lines.length * lineHeight;
  const startY = cy - totalHeight / 2 + lineHeight / 2;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], cx, startY + i * lineHeight);
  }

  ctx.restore();
}

function renderIconElement(element: IconElement): void {
  const { zoom } = store.appState;
  const pos = worldToScreen(element.x, element.y);
  drawIcon(ctx, element.iconType, pos.x, pos.y, element.width * zoom, element.height * zoom, element.strokeColor, element.glow);
}

function renderSelectionUI(): void {
  const selected = store.getSelectedElements();
  if (selected.length === 0) return;

  ctx.save();

  for (const el of selected) {
    // For linear elements (line/arrow), draw point handles
    if (el.type === 'line' || el.type === 'arrow') {
      renderLinearHandles(el as LinearElement | ArrowElement);
      continue;
    }

    const bounds = getElementBounds(el);
    const topLeft = worldToScreen(bounds.minX, bounds.minY);
    const bottomRight = worldToScreen(bounds.maxX, bounds.maxY);
    const w = bottomRight.x - topLeft.x;
    const h = bottomRight.y - topLeft.y;
    const cx = topLeft.x + w / 2;
    const cy = topLeft.y + h / 2;

    ctx.save();
    if (el.angle !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate(el.angle);
      ctx.translate(-cx, -cy);
    }

    // Selection rectangle
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.strokeRect(topLeft.x - 4, topLeft.y - 4, w + 8, h + 8);

    // Corner/edge handles
    ctx.fillStyle = '#161b22';
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 1.5;

    const handles = [
      [topLeft.x - 4, topLeft.y - 4],
      [cx, topLeft.y - 4],
      [topLeft.x + w + 4, topLeft.y - 4],
      [topLeft.x + w + 4, cy],
      [topLeft.x + w + 4, topLeft.y + h + 4],
      [cx, topLeft.y + h + 4],
      [topLeft.x - 4, topLeft.y + h + 4],
      [topLeft.x - 4, cy],
    ];

    for (const [hx, hy] of handles) {
      ctx.fillRect(hx - 4, hy - 4, 8, 8);
      ctx.strokeRect(hx - 4, hy - 4, 8, 8);
    }

    // Rotation handle
    ctx.beginPath();
    ctx.arc(cx, topLeft.y - 25, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#161b22';
    ctx.fill();
    ctx.stroke();

    // Line to rotation handle
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.moveTo(cx, topLeft.y - 4);
    ctx.lineTo(cx, topLeft.y - 20);
    ctx.stroke();

    ctx.restore();
  }

  ctx.restore();
}

function renderLinearHandles(element: LinearElement | ArrowElement): void {
  const points = element.points;
  if (points.length === 0) return;

  ctx.save();

  // Dashed path line — for lines show the segment chain, skip for arrows (midpoint is on curve)
  if (element.type !== 'arrow') {
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(88, 166, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const s = worldToScreen(element.x + points[i][0], element.y + points[i][1]);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.lineWidth = 1.5;

  // Endpoint handles
  ctx.fillStyle = '#161b22';
  ctx.strokeStyle = '#58a6ff';

  const first = worldToScreen(element.x + points[0][0], element.y + points[0][1]);
  const last = worldToScreen(element.x + points[points.length - 1][0], element.y + points[points.length - 1][1]);

  // Start endpoint
  ctx.beginPath();
  ctx.arc(first.x, first.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // End endpoint
  ctx.beginPath();
  ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // For arrows with 3 points, show single midpoint control
  if (element.type === 'arrow' && points.length === 3) {
    const mid = worldToScreen(element.x + points[1][0], element.y + points[1][1]);
    ctx.fillStyle = 'rgba(88, 166, 255, 0.15)';
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mid.x, mid.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (element.type === 'line') {
    // For lines, show all intermediate points
    for (let i = 1; i < points.length - 1; i++) {
      const s = worldToScreen(element.x + points[i][0], element.y + points[i][1]);
      ctx.fillStyle = '#161b22';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Midpoint add-handles for lines
    ctx.fillStyle = 'rgba(88, 166, 255, 0.1)';
    ctx.strokeStyle = 'rgba(88, 166, 255, 0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < points.length - 1; i++) {
      const s1 = worldToScreen(element.x + points[i][0], element.y + points[i][1]);
      const s2 = worldToScreen(element.x + points[i + 1][0], element.y + points[i + 1][1]);
      const mx = (s1.x + s2.x) / 2;
      const my = (s1.y + s2.y) / 2;
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}

// Remote cursors
const remoteCursors: Map<string, { x: number; y: number; username: string; timestamp: number }> = new Map();

export function updateRemoteCursor(userId: string, x: number, y: number, username: string): void {
  remoteCursors.set(userId, { x, y, username, timestamp: Date.now() });
}

export function removeRemoteCursor(userId: string): void {
  remoteCursors.delete(userId);
}

function renderRemoteCursors(): void {
  const now = Date.now();
  ctx.save();

  for (const [userId, cursor] of remoteCursors) {
    if (now - cursor.timestamp > 5000) {
      remoteCursors.delete(userId);
      continue;
    }

    const pos = worldToScreen(cursor.x, cursor.y);
    const color = getCursorColor(userId);

    // Cursor arrow
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x, pos.y + 18);
    ctx.lineTo(pos.x + 5, pos.y + 14);
    ctx.lineTo(pos.x + 12, pos.y + 14);
    ctx.closePath();
    ctx.fill();

    // Label
    ctx.font = '11px "DM Sans", sans-serif';
    const textWidth = ctx.measureText(cursor.username).width;
    const labelX = pos.x + 14;
    const labelY = pos.y + 10;

    ctx.fillStyle = color;
    ctx.beginPath();
    roundRect(ctx, labelX - 3, labelY - 10, textWidth + 10, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(cursor.username, labelX + 2, labelY + 3);
  }

  ctx.restore();
}

function getCursorColor(userId: string): string {
  const colors = ['#f85149', '#58a6ff', '#3fb950', '#d29922', '#bc8cff', '#39d2c0', '#f0883e', '#79c0ff'];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

function getStrokeDash(style: string, width: number): number[] {
  switch (style) {
    case 'dashed': return [width * 4, width * 3];
    case 'dotted': return [width, width * 2];
    default: return [];
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
