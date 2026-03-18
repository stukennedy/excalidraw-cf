import { store } from './state';
import type { ExcalidrawElement, ArrowElement, FreedrawElement, TextElement, IconElement } from './types';
import { getMultiElementBounds, midpointToControlPoint } from './geometry';
import { drawIcon } from './icons';

export function exportToPNG(): void {
  const elements = store.getVisibleElements();
  if (elements.length === 0) return;

  const bounds = getMultiElementBounds(elements);
  if (!bounds) return;

  const padding = 40;
  const width = bounds.width + padding * 2;
  const height = bounds.height + padding * 2;

  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);

  // Dark background
  ctx.fillStyle = '#0f1117';
  ctx.fillRect(0, 0, width, height);

  for (const element of elements) {
    renderElementForExport(ctx, element, -bounds.minX + padding, -bounds.minY + padding);
  }

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'excalidraw-export.png';
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

export function exportToSVG(): void {
  const elements = store.getVisibleElements();
  if (elements.length === 0) return;

  const bounds = getMultiElementBounds(elements);
  if (!bounds) return;

  const padding = 40;
  const width = bounds.width + padding * 2;
  const height = bounds.height + padding * 2;
  const offsetX = -bounds.minX + padding;
  const offsetY = -bounds.minY + padding;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // Dark background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', '#0f1117');
  svg.appendChild(bg);

  for (const element of elements) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('opacity', String(element.opacity / 100));

    const ex = element.x + offsetX;
    const ey = element.y + offsetY;

    switch (element.type) {
      case 'rectangle': {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(ex));
        rect.setAttribute('y', String(ey));
        rect.setAttribute('width', String(element.width));
        rect.setAttribute('height', String(element.height));
        rect.setAttribute('stroke', element.strokeColor);
        rect.setAttribute('stroke-width', String(element.strokeWidth));
        rect.setAttribute('fill', element.backgroundColor !== 'transparent' ? element.backgroundColor : 'none');
        if (element.cornerRadius > 0) {
          rect.setAttribute('rx', String(element.cornerRadius));
        }
        g.appendChild(rect);
        break;
      }
      case 'ellipse': {
        const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        ellipse.setAttribute('cx', String(ex + element.width / 2));
        ellipse.setAttribute('cy', String(ey + element.height / 2));
        ellipse.setAttribute('rx', String(element.width / 2));
        ellipse.setAttribute('ry', String(element.height / 2));
        ellipse.setAttribute('stroke', element.strokeColor);
        ellipse.setAttribute('stroke-width', String(element.strokeWidth));
        ellipse.setAttribute('fill', element.backgroundColor !== 'transparent' ? element.backgroundColor : 'none');
        g.appendChild(ellipse);
        break;
      }
      case 'diamond': {
        const cx = ex + element.width / 2;
        const cy = ey + element.height / 2;
        const r = element.cornerRadius;
        if (r > 0) {
          const verts = [[cx, ey], [ex + element.width, cy], [cx, ey + element.height], [ex, cy]];
          // Build a rounded diamond path using arc segments at each vertex
          let d = '';
          for (let i = 0; i < 4; i++) {
            const prev = verts[(i + 3) % 4];
            const curr = verts[i];
            const next = verts[(i + 1) % 4];
            // Vectors from vertex to neighbors
            const dx1 = prev[0] - curr[0], dy1 = prev[1] - curr[1];
            const dx2 = next[0] - curr[0], dy2 = next[1] - curr[1];
            const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
            const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            const offset = Math.min(r, len1 / 2, len2 / 2);
            const p1x = curr[0] + dx1 / len1 * offset, p1y = curr[1] + dy1 / len1 * offset;
            const p2x = curr[0] + dx2 / len2 * offset, p2y = curr[1] + dy2 / len2 * offset;
            if (i === 0) d += `M${p1x},${p1y}`;
            else d += ` L${p1x},${p1y}`;
            d += ` Q${curr[0]},${curr[1]} ${p2x},${p2y}`;
          }
          d += ' Z';
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', d);
          path.setAttribute('stroke', element.strokeColor);
          path.setAttribute('stroke-width', String(element.strokeWidth));
          path.setAttribute('fill', element.backgroundColor !== 'transparent' ? element.backgroundColor : 'none');
          g.appendChild(path);
        } else {
          const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
          polygon.setAttribute('points', `${cx},${ey} ${ex + element.width},${cy} ${cx},${ey + element.height} ${ex},${cy}`);
          polygon.setAttribute('stroke', element.strokeColor);
          polygon.setAttribute('stroke-width', String(element.strokeWidth));
          polygon.setAttribute('fill', element.backgroundColor !== 'transparent' ? element.backgroundColor : 'none');
          g.appendChild(polygon);
        }
        break;
      }
      case 'line':
      case 'arrow': {
        const pts = (element as any).points as [number, number][];
        if (pts.length >= 2) {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          let d: string;
          if (element.type === 'arrow' && pts.length === 3) {
            const [cpx, cpy] = midpointToControlPoint(
              pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1],
            );
            d = `M${ex + pts[0][0]},${ey + pts[0][1]} Q${ex + cpx},${ey + cpy} ${ex + pts[2][0]},${ey + pts[2][1]}`;
          } else {
            d = `M${ex + pts[0][0]},${ey + pts[0][1]}` + pts.slice(1).map(p => ` L${ex + p[0]},${ey + p[1]}`).join('');
          }
          path.setAttribute('d', d);
          path.setAttribute('stroke', element.strokeColor);
          path.setAttribute('stroke-width', String(element.strokeWidth));
          path.setAttribute('fill', 'none');
          g.appendChild(path);
        }
        break;
      }
      case 'text': {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(ex));
        text.setAttribute('y', String(ey + (element as TextElement).fontSize));
        text.setAttribute('fill', element.strokeColor);
        text.setAttribute('font-size', String((element as TextElement).fontSize));
        text.textContent = (element as TextElement).text;
        g.appendChild(text);
        break;
      }
    }

    svg.appendChild(g);
  }

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'excalidraw-export.svg';
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToJSON(): void {
  const elements = store.getVisibleElements();
  const data = {
    type: 'excalidraw',
    version: 2,
    elements,
    appState: {
      viewBackgroundColor: '#0f1117',
    },
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'drawing.excalidraw';
  a.click();
  URL.revokeObjectURL(url);
}

function renderElementForExport(
  ctx: CanvasRenderingContext2D,
  element: ExcalidrawElement,
  offsetX: number,
  offsetY: number
): void {
  ctx.save();
  ctx.globalAlpha = element.opacity / 100;

  const ex = element.x + offsetX;
  const ey = element.y + offsetY;

  ctx.strokeStyle = element.strokeColor;
  ctx.fillStyle = element.backgroundColor !== 'transparent' ? element.backgroundColor : 'transparent';
  ctx.lineWidth = element.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (element.glow) {
    ctx.shadowColor = element.strokeColor;
    ctx.shadowBlur = 16;
  }

  switch (element.type) {
    case 'rectangle': {
      const r = element.cornerRadius;
      if (r > 0) {
        roundRectPath(ctx, ex, ey, element.width, element.height, r);
      } else {
        ctx.beginPath();
        ctx.rect(ex, ey, element.width, element.height);
      }
      if (element.backgroundColor !== 'transparent') ctx.fill();
      ctx.stroke();
      break;
    }
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(ex + element.width / 2, ey + element.height / 2, element.width / 2, element.height / 2, 0, 0, Math.PI * 2);
      if (element.backgroundColor !== 'transparent') ctx.fill();
      ctx.stroke();
      break;
    case 'diamond': {
      const cx = ex + element.width / 2;
      const cy = ey + element.height / 2;
      const r = element.cornerRadius;
      ctx.beginPath();
      if (r > 0) {
        const verts: [number, number][] = [[cx, ey], [ex + element.width, cy], [cx, ey + element.height], [ex, cy]];
        ctx.moveTo((verts[3][0] + verts[0][0]) / 2, (verts[3][1] + verts[0][1]) / 2);
        for (let i = 0; i < 4; i++) {
          const next = (i + 1) % 4;
          ctx.arcTo(verts[i][0], verts[i][1], verts[next][0], verts[next][1], r);
        }
        ctx.closePath();
      } else {
        ctx.moveTo(cx, ey);
        ctx.lineTo(ex + element.width, cy);
        ctx.lineTo(cx, ey + element.height);
        ctx.lineTo(ex, cy);
        ctx.closePath();
      }
      if (element.backgroundColor !== 'transparent') ctx.fill();
      ctx.stroke();
      break;
    }
    case 'line': {
      const pts = (element as any).points as [number, number][];
      if (pts.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(ex + pts[0][0], ey + pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(ex + pts[i][0], ey + pts[i][1]);
      }
      ctx.stroke();
      break;
    }
    case 'arrow': {
      const arrow = element as ArrowElement;
      const pts = arrow.points;
      if (pts.length < 2) break;
      ctx.beginPath();
      if (pts.length === 3) {
        const [cpx, cpy] = midpointToControlPoint(
          pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1],
        );
        ctx.moveTo(ex + pts[0][0], ey + pts[0][1]);
        ctx.quadraticCurveTo(ex + cpx, ey + cpy, ex + pts[2][0], ey + pts[2][1]);
      } else {
        ctx.moveTo(ex + pts[0][0], ey + pts[0][1]);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(ex + pts[i][0], ey + pts[i][1]);
        }
      }
      ctx.stroke();
      // Arrowhead
      if (arrow.endArrowhead) {
        const last = pts[pts.length - 1];
        let prev: [number, number];
        if (pts.length === 3) {
          const [cpx, cpy] = midpointToControlPoint(
            pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1],
          );
          prev = [cpx, cpy];
        } else {
          prev = pts[pts.length - 2];
        }
        const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
        const headLen = 14;
        ctx.beginPath();
        ctx.moveTo(ex + last[0] - headLen * Math.cos(angle - Math.PI / 6), ey + last[1] - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(ex + last[0], ey + last[1]);
        ctx.lineTo(ex + last[0] - headLen * Math.cos(angle + Math.PI / 6), ey + last[1] - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
      break;
    }
    case 'freedraw': {
      const pts = (element as FreedrawElement).points;
      if (pts.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(ex + pts[0][0], ey + pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(ex + pts[i][0], ey + pts[i][1]);
      }
      ctx.stroke();
      break;
    }
    case 'text': {
      const te = element as TextElement;
      ctx.fillStyle = te.strokeColor;
      ctx.font = `${te.fontSize}px "DM Sans", sans-serif`;
      ctx.textBaseline = 'top';
      const lines = te.text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], ex, ey + i * te.fontSize * te.lineHeight);
      }
      break;
    }
    case 'icon': {
      const icon = element as IconElement;
      drawIcon(ctx, icon.iconType, ex, ey, icon.width, icon.height, icon.strokeColor, icon.glow);
      break;
    }
  }

  ctx.restore();
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
