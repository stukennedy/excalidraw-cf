import type { IconType } from './types';

/** Draw an icon into a canvas context at the given bounds */
export function drawIcon(
  ctx: CanvasRenderingContext2D,
  iconType: IconType,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  glow: boolean,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
  }

  const drawer = iconDrawers[iconType];
  if (drawer) drawer(ctx, x, y, w, h, color);

  ctx.restore();
}

type DrawFn = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => void;

const iconDrawers: Record<IconType, DrawFn> = {
  computer: (ctx, x, y, w, h) => {
    const m = Math.min(w, h);
    const pad = m * 0.1;
    const sw = w - pad * 2;
    const sh = h * 0.6;
    const sx = x + pad;
    const sy = y + pad;
    // Monitor
    ctx.strokeRect(sx, sy, sw, sh);
    // Screen inner
    ctx.globalAlpha = 0.15;
    ctx.fillRect(sx + 3, sy + 3, sw - 6, sh - 6);
    ctx.globalAlpha = 1;
    // Stand
    const cx = x + w / 2;
    ctx.beginPath();
    ctx.moveTo(cx, sy + sh);
    ctx.lineTo(cx, sy + sh + h * 0.15);
    ctx.stroke();
    // Base
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.2, sy + sh + h * 0.15);
    ctx.lineTo(cx + w * 0.2, sy + sh + h * 0.15);
    ctx.stroke();
  },

  phone: (ctx, x, y, w, h) => {
    const pad = w * 0.2;
    const pw = w - pad * 2;
    const ph = h * 0.85;
    const px = x + pad;
    const py = y + h * 0.075;
    const r = pw * 0.15;
    // Body
    roundRect(ctx, px, py, pw, ph, r);
    ctx.stroke();
    // Screen
    ctx.globalAlpha = 0.15;
    roundRect(ctx, px + 3, py + ph * 0.12, pw - 6, ph * 0.76, r * 0.5);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Notch
    const nx = x + w / 2;
    ctx.beginPath();
    ctx.moveTo(nx - pw * 0.15, py + 4);
    ctx.lineTo(nx + pw * 0.15, py + 4);
    ctx.stroke();
  },

  database: (ctx, x, y, w, h) => {
    const cx = x + w / 2;
    const ew = w * 0.8;
    const eh = h * 0.18;
    const bx = cx - ew / 2;
    const by = y + h * 0.1;
    const bh = h * 0.7;
    // Top ellipse
    ctx.beginPath();
    ctx.ellipse(cx, by, ew / 2, eh / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.1;
    ctx.fill();
    ctx.globalAlpha = 1;
    // Sides
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx, by + bh);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx + ew, by);
    ctx.lineTo(bx + ew, by + bh);
    ctx.stroke();
    // Bottom ellipse
    ctx.beginPath();
    ctx.ellipse(cx, by + bh, ew / 2, eh / 2, 0, 0, Math.PI);
    ctx.stroke();
    // Middle lines
    ctx.beginPath();
    ctx.ellipse(cx, by + bh * 0.35, ew / 2, eh / 2, 0, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, by + bh * 0.65, ew / 2, eh / 2, 0, 0, Math.PI);
    ctx.stroke();
  },

  server: (ctx, x, y, w, h) => {
    const pad = w * 0.1;
    const sw = w - pad * 2;
    const unitH = h * 0.25;
    const gap = h * 0.05;
    const sx = x + pad;
    for (let i = 0; i < 3; i++) {
      const sy = y + h * 0.08 + i * (unitH + gap);
      roundRect(ctx, sx, sy, sw, unitH, 3);
      ctx.stroke();
      // Status light
      ctx.beginPath();
      ctx.arc(sx + sw - unitH * 0.4, sy + unitH / 2, 3, 0, Math.PI * 2);
      ctx.fill();
      // Vent lines
      for (let j = 0; j < 3; j++) {
        const lx = sx + unitH * 0.3 + j * 8;
        ctx.beginPath();
        ctx.moveTo(lx, sy + unitH * 0.3);
        ctx.lineTo(lx, sy + unitH * 0.7);
        ctx.stroke();
      }
    }
  },

  cloud: (ctx, x, y, w, h) => {
    const cx = x + w / 2;
    const cy = y + h * 0.55;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.25, cy + h * 0.15);
    ctx.arc(x + w * 0.25, cy - h * 0.05, w * 0.18, Math.PI * 0.7, Math.PI * 1.9);
    ctx.arc(x + w * 0.42, cy - h * 0.2, w * 0.17, Math.PI * 1.1, Math.PI * 1.85);
    ctx.arc(cx + w * 0.05, cy - h * 0.18, w * 0.2, Math.PI * 1.2, Math.PI * 0.2);
    ctx.arc(x + w * 0.72, cy, w * 0.15, Math.PI * 1.5, Math.PI * 0.5);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 0.1;
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  user: (ctx, x, y, w, h) => {
    const cx = x + w / 2;
    // Head
    const headR = Math.min(w, h) * 0.18;
    ctx.beginPath();
    ctx.arc(cx, y + h * 0.3, headR, 0, Math.PI * 2);
    ctx.stroke();
    // Body
    ctx.beginPath();
    ctx.arc(cx, y + h * 0.95, w * 0.35, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  },

  lock: (ctx, x, y, w, h) => {
    const cx = x + w / 2;
    const bw = w * 0.6;
    const bh = h * 0.45;
    const bx = cx - bw / 2;
    const by = y + h * 0.45;
    // Body
    roundRect(ctx, bx, by, bw, bh, 3);
    ctx.stroke();
    ctx.globalAlpha = 0.1;
    roundRect(ctx, bx, by, bw, bh, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Shackle
    ctx.beginPath();
    ctx.arc(cx, by, bw * 0.35, Math.PI, 0);
    ctx.stroke();
    // Keyhole
    ctx.beginPath();
    ctx.arc(cx, by + bh * 0.4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, by + bh * 0.4 + 3);
    ctx.lineTo(cx, by + bh * 0.7);
    ctx.stroke();
  },

  api: (ctx, x, y, w, h) => {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const bw = w * 0.3;
    const bh = h * 0.5;
    // Left bracket
    ctx.beginPath();
    ctx.moveTo(cx - bw * 0.3, cy - bh);
    ctx.lineTo(cx - bw, cy - bh);
    ctx.lineTo(cx - bw, cy + bh);
    ctx.lineTo(cx - bw * 0.3, cy + bh);
    ctx.stroke();
    // Right bracket
    ctx.beginPath();
    ctx.moveTo(cx + bw * 0.3, cy - bh);
    ctx.lineTo(cx + bw, cy - bh);
    ctx.lineTo(cx + bw, cy + bh);
    ctx.lineTo(cx + bw * 0.3, cy + bh);
    ctx.stroke();
    // Slash
    ctx.beginPath();
    ctx.moveTo(cx + bw * 0.15, cy - bh * 0.6);
    ctx.lineTo(cx - bw * 0.15, cy + bh * 0.6);
    ctx.stroke();
  },

  aws: (ctx, x, y, w, h) => {
    const cx = x + w / 2;
    const pad = Math.min(w, h) * 0.15;
    // Arrow/smile shape
    ctx.beginPath();
    ctx.moveTo(x + pad, y + h * 0.3);
    ctx.lineTo(cx, y + pad);
    ctx.lineTo(x + w - pad, y + h * 0.3);
    ctx.stroke();
    // Smile
    ctx.beginPath();
    ctx.moveTo(x + w * 0.25, y + h * 0.55);
    ctx.quadraticCurveTo(cx, y + h * 0.75, x + w * 0.75, y + h * 0.55);
    ctx.stroke();
    // Arrow tip on smile
    ctx.beginPath();
    ctx.moveTo(x + w * 0.65, y + h * 0.5);
    ctx.lineTo(x + w * 0.75, y + h * 0.55);
    ctx.lineTo(x + w * 0.65, y + h * 0.6);
    ctx.stroke();
  },

  cloudflare: (ctx, x, y, w, h) => {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) * 0.4;
    // Hexagonal shield
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 0.1;
    ctx.fill();
    ctx.globalAlpha = 1;
    // CF text
    ctx.font = `bold ${r * 0.5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CF', cx, cy);
  },

  gcp: (ctx, x, y, w, h) => {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) * 0.35;
    // Hexagon
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 0.1;
    ctx.fill();
    ctx.globalAlpha = 1;
    // Inner triangle
    const ir = r * 0.45;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (Math.PI * 2 / 3) * i - Math.PI / 2;
      const px = cx + ir * Math.cos(a);
      const py = cy + ir * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  },

  datacenter: (ctx, x, y, w, h) => {
    const pad = w * 0.1;
    const bw = w - pad * 2;
    const bh = h * 0.8;
    const bx = x + pad;
    const by = y + h * 0.1;
    // Building outline
    ctx.strokeRect(bx, by, bw, bh);
    // Roof triangle
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(x + w / 2, by - h * 0.08);
    ctx.lineTo(bx + bw, by);
    ctx.stroke();
    // Rack slots
    const slotH = bh * 0.12;
    const slotPad = bw * 0.1;
    for (let i = 0; i < 4; i++) {
      const sy = by + bh * 0.1 + i * (slotH + bh * 0.08);
      ctx.strokeRect(bx + slotPad, sy, bw - slotPad * 2, slotH);
      // LED
      ctx.beginPath();
      ctx.arc(bx + bw - slotPad - 6, sy + slotH / 2, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

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

export const iconLabels: Record<IconType, string> = {
  computer: 'Computer',
  phone: 'Phone',
  database: 'Database',
  server: 'Server',
  cloud: 'Cloud',
  user: 'User',
  lock: 'Lock',
  api: 'API',
  aws: 'AWS',
  cloudflare: 'Cloudflare',
  gcp: 'GCP',
  datacenter: 'Data Center',
};

export const allIconTypes: IconType[] = [
  'computer', 'phone', 'database', 'server',
  'cloud', 'user', 'lock', 'api',
  'aws', 'cloudflare', 'gcp', 'datacenter',
];
