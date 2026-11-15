// Saving files from the browser: a file name part made from a place name, and a blob saved with a link click.

/** "Central Kalimantan, Indonesia" → "central_kalimantan_indonesia". */
export function fileSlug(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'area';
}

/** Save a blob as a file (the URL is released a little later). */
export function saveFile(blob: Blob, file: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---- KalenderApi (addition): text files and PNG figures for the Indonesia record's downloads ----

/** Save text as a file (CSV: UTF-8 with a byte order mark, so a spreadsheet reads the names right). */
export function saveText(text: string, file: string, type = 'text/csv;charset=utf-8'): void {
  saveFile(new Blob([type.startsWith('text/csv') ? '﻿' : '', text], { type }), file);
}

/** An SVG drawn into an image (the SVG must carry its own colours: no page CSS reaches it). */
function svgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('the browser could not draw the chart as an image'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** A chart's SVG element as a string that stands alone: a copy with its size and namespace written in. */
export function svgString(el: SVGSVGElement): { svg: string; width: number; height: number } {
  const box = el.getBoundingClientRect();
  const width = Math.round(Number(el.getAttribute('width')) || box.width), height = Math.round(Number(el.getAttribute('height')) || box.height);
  const copy = el.cloneNode(true) as SVGSVGElement;
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('width', String(width));
  copy.setAttribute('height', String(height));
  if (!copy.getAttribute('viewBox')) copy.setAttribute('viewBox', `0 0 ${width} ${height}`);
  // the page's colour for currentColor, in case the chart leaves it to the page
  if (!copy.style.color) copy.style.color = getComputedStyle(el).color;
  return { svg: new XMLSerializer().serializeToString(copy), width, height };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > max) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

export interface FigurePng {
  title: string;
  subtitle?: string;
  svg: string; width: number; height: number;       // the chart, in CSS pixels
  key?: { label: string; color: string }[];         // the legend, when the chart has none inside
  foot: string[];                                   // source and notes, one paragraph each
  colors: { bg: string; text: string; text2: string };
  font?: string;
}

/** A figure as a PNG: title, what is plotted, the chart, its key, then the source lines; drawn at twice the size. */
export async function figurePng(f: FigurePng): Promise<Blob> {
  const pad = 24, scale = 2;
  const W = Math.max(480, f.width + pad * 2), inner = W - pad * 2;
  const font = f.font || 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) throw new Error('this browser has no canvas');
  const blocks: { lines: string[]; font: string; lh: number; color: string; gap: number }[] = [];
  const add = (text: string | undefined, fnt: string, lh: number, color: string, gap: number) => {
    if (!text) return;
    probe.font = fnt;
    blocks.push({ lines: wrap(probe, text, inner), font: fnt, lh, color, gap });
  };
  add(f.title, `600 17px ${font}`, 23, f.colors.text, 4);
  add(f.subtitle, `400 12px ${font}`, 17, f.colors.text2, 12);
  const head = blocks.splice(0);
  for (const line of f.foot) add(line, `400 11px ${font}`, 16, f.colors.text2, 4);
  const foot = blocks.splice(0);
  const hOf = (bs: typeof head) => bs.reduce((s, b) => s + b.lines.length * b.lh + b.gap, 0);
  const keyH = f.key?.length ? 26 : 0;
  const H = pad + hOf(head) + f.height + 10 + keyH + hOf(foot) + pad - 4;

  const canvas = document.createElement('canvas');
  canvas.width = W * scale; canvas.height = Math.ceil(H) * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('this browser has no canvas');
  ctx.scale(scale, scale);
  ctx.fillStyle = f.colors.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'top';
  let y = pad;
  const draw = (bs: typeof head) => {
    for (const b of bs) {
      ctx.font = b.font; ctx.fillStyle = b.color;
      for (const l of b.lines) { ctx.fillText(l, pad, y + (b.lh - parseInt(b.font.split(' ')[1]!, 10)) / 2); y += b.lh; }
      y += b.gap;
    }
  };
  draw(head);
  ctx.drawImage(await svgImage(f.svg), pad, y, f.width, f.height);
  y += f.height + 10;
  if (f.key?.length) {
    ctx.font = `400 12px ${font}`;
    let x = pad;
    for (const k of f.key) {
      ctx.fillStyle = k.color; ctx.fillRect(x, y + 7, 22, 3);
      ctx.fillStyle = f.colors.text2; ctx.fillText(k.label, x + 28, y + 2);
      x += 28 + ctx.measureText(k.label).width + 20;
    }
    y += keyH;
  }
  draw(foot);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('the image could not be made'))), 'image/png'));
}
