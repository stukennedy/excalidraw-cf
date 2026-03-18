import rough from 'roughjs';
import type { RoughCanvas } from 'roughjs/bin/canvas';
import type { ExcalidrawElement, LinearElement, ArrowElement, FreedrawElement, TextElement } from './types';
import { store } from './state';
import { worldToScreen } from './camera';
import { getElementBounds } from './geometry';

let rc: RoughCanvas;
let ctx: CanvasRenderingContext2D;

export function initRenderer(canvas: HTMLCanvasElement): void {
  rc = rough.canvas(canvas);
  ctx = canvas.getContext('2d')!;
}

export function renderScene(canvas: HTMLCanvasElement): void {
  const dpr = window.devicePixelRatio || 1;
  const logicalW = canvas.width / dpr;
  const logicalH = canvas.height / dpr;

  ctx.clearRect(0, 0, logicalW, logicalH);

  drawGrid(logicalW, logicalH);

  const elements = store.getVisibleElements();
  for (const element of elements) {
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
  ctx.strokeStyle = '#e5e5e5';
  ctx.lineWidth = 1;
  ctx.globalAlpha = Math.min(1, (scaledGrid - 10) / 10);

  const offsetX = ((scrollX % scaledGrid) + scaledGrid) % scaledGrid;
  const offsetY = ((scrollY % scaledGrid) + scaledGrid) % scaledGrid;

  ctx.beginPath();
  for (let x = offsetX; x < logicalW; x += scaledGrid) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, logicalH);
  }
  for (let y = offsetY; y < logicalH; y += scaledGrid) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(logicalW, Math.round(y) + 0.5);
  }
  ctx.stroke();
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

  const roughOptions = {
    seed: element.seed,
    stroke: element.strokeColor,
    fill: element.backgroundColor !== 'transparent' ? element.backgroundColor : undefined,
    fillStyle: element.fillStyle,
    strokeWidth: element.strokeWidth * zoom,
    roughness: element.roughness,
    strokeLineDash: getStrokeDash(element.strokeStyle, element.strokeWidth),
  };

  const w = element.width * zoom;
  const h = element.height * zoom;

  switch (element.type) {
    case 'rectangle':
      rc.rectangle(screenPos.x, screenPos.y, w, h, roughOptions);
      break;

    case 'ellipse':
      rc.ellipse(screenPos.x + w / 2, screenPos.y + h / 2, w, h, roughOptions);
      break;

    case 'diamond': {
      const cx = screenPos.x + w / 2;
      const cy = screenPos.y + h / 2;
      rc.polygon([
        [cx, screenPos.y],
        [screenPos.x + w, cy],
        [cx, screenPos.y + h],
        [screenPos.x, cy],
      ], roughOptions);
      break;
    }

    case 'line':
      renderLinear(element as LinearElement, roughOptions);
      break;

    case 'arrow':
      renderArrow(element as ArrowElement, roughOptions);
      break;

    case 'freedraw':
      renderFreedraw(element as FreedrawElement);
      break;

    case 'text':
      renderText(element as TextElement);
      break;
  }

  ctx.restore();
}

function renderLinear(element: LinearElement, roughOptions: any): void {
  const points = element.points.map(([px, py]) => {
    const s = worldToScreen(element.x + px, element.y + py);
    return [s.x, s.y] as [number, number];
  });

  if (points.length < 2) return;

  for (let i = 0; i < points.length - 1; i++) {
    rc.line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], roughOptions);
  }
}

function renderArrow(element: ArrowElement, roughOptions: any): void {
  const points = element.points.map(([px, py]) => {
    const s = worldToScreen(element.x + px, element.y + py);
    return [s.x, s.y] as [number, number];
  });

  if (points.length < 2) return;

  // Draw line segments
  for (let i = 0; i < points.length - 1; i++) {
    rc.line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], roughOptions);
  }

  // Arrowhead at end
  if (element.endArrowhead) {
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    drawArrowhead(prev[0], prev[1], last[0], last[1], roughOptions);
  }

  // Arrowhead at start
  if (element.startArrowhead) {
    const first = points[0];
    const second = points[1];
    drawArrowhead(second[0], second[1], first[0], first[1], roughOptions);
  }
}

function drawArrowhead(fromX: number, fromY: number, toX: number, toY: number, roughOptions: any): void {
  const headLen = 15 * store.appState.zoom;
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const a1 = angle - Math.PI / 6;
  const a2 = angle + Math.PI / 6;

  rc.line(toX, toY, toX - headLen * Math.cos(a1), toY - headLen * Math.sin(a1), roughOptions);
  rc.line(toX, toY, toX - headLen * Math.cos(a2), toY - headLen * Math.sin(a2), roughOptions);
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
  ctx.globalAlpha = element.opacity / 100;

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
  ctx.globalAlpha = element.opacity / 100;

  const fontFamily = element.fontFamily === 'Virgil' ? '"Virgil", cursive'
    : element.fontFamily === 'Cascadia' ? '"Cascadia Code", monospace'
    : 'Helvetica, Arial, sans-serif';

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

    // Rotate the entire selection UI if the element is rotated
    ctx.save();
    if (el.angle !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate(el.angle);
      ctx.translate(-cx, -cy);
    }

    // Dashed selection rectangle
    ctx.strokeStyle = '#4a90d9';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(topLeft.x - 4, topLeft.y - 4, w + 8, h + 8);

    // Corner/edge handles
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#4a90d9';
    ctx.lineWidth = 2;

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
    ctx.fill();
    ctx.stroke();

    // Line to rotation handle
    ctx.beginPath();
    ctx.setLineDash([2, 2]);
    ctx.moveTo(cx, topLeft.y - 4);
    ctx.lineTo(cx, topLeft.y - 20);
    ctx.stroke();

    ctx.restore();
  }

  ctx.restore();
}

/** Render grabbable point handles for lines and arrows */
function renderLinearHandles(element: LinearElement | ArrowElement): void {
  const points = element.points;
  if (points.length === 0) return;

  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#4a90d9';
  ctx.lineWidth = 2;

  // Draw a thin dashed line showing the path
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(74, 144, 217, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const s = worldToScreen(element.x + points[i][0], element.y + points[i][1]);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  }
  ctx.stroke();

  // Draw endpoint handles (larger circles)
  ctx.setLineDash([]);
  ctx.strokeStyle = '#4a90d9';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#fff';

  for (let i = 0; i < points.length; i++) {
    const s = worldToScreen(element.x + points[i][0], element.y + points[i][1]);
    const isEndpoint = i === 0 || i === points.length - 1;
    const radius = isEndpoint ? 5 : 4;

    ctx.beginPath();
    ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Draw midpoint handles (smaller, for adding bend points)
  ctx.fillStyle = '#e8f0fe';
  ctx.strokeStyle = '#4a90d9';
  ctx.lineWidth = 1.5;

  for (let i = 0; i < points.length - 1; i++) {
    const s1 = worldToScreen(element.x + points[i][0], element.y + points[i][1]);
    const s2 = worldToScreen(element.x + points[i + 1][0], element.y + points[i + 1][1]);
    const mx = (s1.x + s2.x) / 2;
    const my = (s1.y + s2.y) / 2;

    ctx.beginPath();
    ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
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

    ctx.fillStyle = getCursorColor(userId);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x, pos.y + 18);
    ctx.lineTo(pos.x + 5, pos.y + 14);
    ctx.lineTo(pos.x + 12, pos.y + 14);
    ctx.closePath();
    ctx.fill();

    ctx.font = '12px sans-serif';
    ctx.fillStyle = getCursorColor(userId);
    const textWidth = ctx.measureText(cursor.username).width;
    const labelX = pos.x + 14;
    const labelY = pos.y + 10;

    ctx.fillRect(labelX - 2, labelY - 10, textWidth + 8, 16);
    ctx.fillStyle = '#fff';
    ctx.fillText(cursor.username, labelX + 2, labelY + 2);
  }

  ctx.restore();
}

function getCursorColor(userId: string): string {
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

function getStrokeDash(style: string, width: number): number[] | undefined {
  switch (style) {
    case 'dashed': return [width * 4, width * 3];
    case 'dotted': return [width, width * 2];
    default: return undefined;
  }
}
