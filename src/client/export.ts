import rough from 'roughjs';
import { store } from './state';
import type { ExcalidrawElement } from './types';
import { getElementBounds, getMultiElementBounds } from './geometry';

export function exportToPNG(): void {
  const elements = store.getVisibleElements();
  if (elements.length === 0) return;

  const bounds = getMultiElementBounds(elements);
  if (!bounds) return;

  const padding = 40;
  const width = bounds.width + padding * 2;
  const height = bounds.height + padding * 2;

  const canvas = document.createElement('canvas');
  canvas.width = width * 2; // 2x for retina
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Render elements offset to fit
  const rc = rough.canvas(canvas);
  for (const element of elements) {
    renderElementForExport(ctx, rc, element, -bounds.minX + padding, -bounds.minY + padding);
  }

  // Download
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

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // White background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', '#ffffff');
  svg.appendChild(bg);

  const rc = rough.svg(svg);
  const offsetX = -bounds.minX + padding;
  const offsetY = -bounds.minY + padding;

  for (const element of elements) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('opacity', String(element.opacity / 100));

    const opts = {
      seed: element.seed,
      stroke: element.strokeColor,
      fill: element.backgroundColor !== 'transparent' ? element.backgroundColor : undefined,
      fillStyle: element.fillStyle,
      strokeWidth: element.strokeWidth,
      roughness: element.roughness,
    };

    const ex = element.x + offsetX;
    const ey = element.y + offsetY;

    switch (element.type) {
      case 'rectangle':
        g.appendChild(rc.rectangle(ex, ey, element.width, element.height, opts));
        break;
      case 'ellipse':
        g.appendChild(rc.ellipse(ex + element.width / 2, ey + element.height / 2, element.width, element.height, opts));
        break;
      case 'diamond': {
        const cx = ex + element.width / 2;
        const cy = ey + element.height / 2;
        g.appendChild(rc.polygon([[cx, ey], [ex + element.width, cy], [cx, ey + element.height], [ex, cy]], opts));
        break;
      }
      case 'line':
      case 'arrow': {
        const pts = (element as any).points as [number, number][];
        for (let i = 0; i < pts.length - 1; i++) {
          g.appendChild(rc.line(ex + pts[i][0], ey + pts[i][1], ex + pts[i + 1][0], ey + pts[i + 1][1], opts));
        }
        break;
      }
      case 'text': {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(ex));
        text.setAttribute('y', String(ey + (element as any).fontSize));
        text.setAttribute('fill', element.strokeColor);
        text.setAttribute('font-size', String((element as any).fontSize));
        text.textContent = (element as any).text;
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
      viewBackgroundColor: '#ffffff',
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
  rc: any,
  element: ExcalidrawElement,
  offsetX: number,
  offsetY: number
): void {
  ctx.save();
  ctx.globalAlpha = element.opacity / 100;

  const opts = {
    seed: element.seed,
    stroke: element.strokeColor,
    fill: element.backgroundColor !== 'transparent' ? element.backgroundColor : undefined,
    fillStyle: element.fillStyle,
    strokeWidth: element.strokeWidth,
    roughness: element.roughness,
  };

  const ex = element.x + offsetX;
  const ey = element.y + offsetY;

  switch (element.type) {
    case 'rectangle':
      rc.rectangle(ex, ey, element.width, element.height, opts);
      break;
    case 'ellipse':
      rc.ellipse(ex + element.width / 2, ey + element.height / 2, element.width, element.height, opts);
      break;
    case 'diamond': {
      const cx = ex + element.width / 2;
      const cy = ey + element.height / 2;
      rc.polygon([[cx, ey], [ex + element.width, cy], [cx, ey + element.height], [ex, cy]], opts);
      break;
    }
    case 'line':
    case 'arrow': {
      const pts = (element as any).points as [number, number][];
      for (let i = 0; i < pts.length - 1; i++) {
        rc.line(ex + pts[i][0], ey + pts[i][1], ex + pts[i + 1][0], ey + pts[i + 1][1], opts);
      }
      break;
    }
    case 'freedraw': {
      const pts = (element as any).points as [number, number][];
      if (pts.length < 2) break;
      ctx.strokeStyle = element.strokeColor;
      ctx.lineWidth = element.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(ex + pts[0][0], ey + pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(ex + pts[i][0], ey + pts[i][1]);
      }
      ctx.stroke();
      break;
    }
    case 'text': {
      ctx.fillStyle = element.strokeColor;
      ctx.font = `${(element as any).fontSize}px ${(element as any).fontFamily}`;
      ctx.textBaseline = 'top';
      const lines = (element as any).text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], ex, ey + i * (element as any).fontSize * (element as any).lineHeight);
      }
      break;
    }
  }

  ctx.restore();
}
