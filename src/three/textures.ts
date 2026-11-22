import * as THREE from 'three';
import type { Card, Position, Suit } from '../poker/types';

export type FeltThemeId = 'emerald' | 'navy' | 'crimson';

const FELT_PALETTES: Record<
  FeltThemeId,
  {
    center: string;
    mid: string;
    edge: string;
    weaveLight: string;
    weaveDark: string;
    accentGold: string;
  }
> = {
  emerald: {
    center: '#145a40',
    mid: '#0c3f2c',
    edge: '#051f16',
    weaveLight: 'rgba(110, 231, 183, 0.055)',
    weaveDark: 'rgba(2, 16, 11, 0.22)',
    accentGold: 'rgba(218, 182, 102, 0.52)',
  },
  navy: {
    center: '#163c68',
    mid: '#0e2847',
    edge: '#061326',
    weaveLight: 'rgba(125, 200, 255, 0.055)',
    weaveDark: 'rgba(3, 10, 22, 0.24)',
    accentGold: 'rgba(218, 186, 118, 0.5)',
  },
  crimson: {
    center: '#6d1d2d',
    mid: '#4a121e',
    edge: '#22070d',
    weaveLight: 'rgba(255, 165, 180, 0.055)',
    weaveDark: 'rgba(20, 3, 7, 0.25)',
    accentGold: 'rgba(226, 190, 112, 0.54)',
  },
};

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bespoke 1024x640 casino speed-cloth baize layout projected 1:1 onto the oval playing felt:
 * - Warm radial spotlight vignette
 * - Authentic woven speed-cloth diamond & suited micro-pattern
 * - Double brushed-gold oval betting line
 * - Embossed FeltLab High Stakes center watermark & 5 subtle board card slots
 */
export function createFeltTextures(
  theme: FeltThemeId,
  maxAnisotropy: number
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const palette = FELT_PALETTES[theme];
  const w = 1024;
  const h = 640;
  const [canvas, ctx] = makeCanvas(w, h);
  const cx = w / 2;
  const cy = h / 2;

  // 1. Deep radial casino baize gradient (natural falloff under overhead pendant pool)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1.35, 0.88);
  const grad = ctx.createRadialGradient(0, -18, 28, 0, 0, 420);
  grad.addColorStop(0, palette.center);
  grad.addColorStop(0.58, palette.mid);
  grad.addColorStop(1, palette.edge);
  ctx.fillStyle = grad;
  ctx.fillRect(-w, -h, w * 2, h * 2);
  ctx.restore();

  // 2. Speed-cloth micro-woven cross-hatch + subtle suited diamond lattice
  const rand = mulberry32(theme === 'emerald' ? 101 : theme === 'navy' ? 202 : 303);
  ctx.fillStyle = palette.weaveDark;
  for (let y = 0; y < h; y += 3) {
    ctx.fillRect(0, y, w, 1);
  }
  ctx.fillStyle = palette.weaveLight;
  for (let x = 0; x < w; x += 4) {
    ctx.fillRect(x, 0, 1, h);
  }

  // Subtle suited casino speed-cloth pattern (faint diamonds & suit pips)
  ctx.strokeStyle = palette.weaveLight;
  ctx.lineWidth = 1;
  const step = 36;
  const glyphs = ['♠', '♥', '♦', '♣'];
  ctx.font = '11px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let gIdx = 0;
  for (let y = 18; y < h; y += step) {
    for (let x = 18; x < w; x += step) {
      const ox = ((y / step) % 2) * (step / 2);
      const px = x + ox;
      ctx.beginPath();
      ctx.moveTo(px, y - 10);
      ctx.lineTo(px + 10, y);
      ctx.lineTo(px, y + 10);
      ctx.lineTo(px - 10, y);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = palette.weaveLight;
      ctx.fillText(glyphs[gIdx++ % 4], px, y + 0.5);
    }
  }

  // Fine woolen felt grain noise
  for (let i = 0; i < 11000; i++) {
    const px = Math.floor(rand() * w);
    const py = Math.floor(rand() * h);
    ctx.fillStyle = rand() > 0.5 ? palette.weaveLight : palette.weaveDark;
    ctx.fillRect(px, py, 2, 2);
  }

  // 3. Double gold casino betting-line oval
  ctx.strokeStyle = palette.accentGold;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.375, h * 0.355, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(218, 182, 102, 0.22)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.365, h * 0.342, 0, 0, Math.PI * 2);
  ctx.stroke();

  // 4. Subtle embossed casino emblem & 5 community card slot hairlines (aligned 1:1 to 3D board at z = -0.08)
  ctx.fillStyle = 'rgba(225, 195, 125, 0.2)';
  ctx.font = '700 22px "Space Grotesk", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FELTLAB  ·  HIGH STAKES', cx, cy - 150);

  ctx.fillStyle = 'rgba(225, 195, 125, 0.14)';
  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.fillText('NO-LIMIT TEXAS HOLD’EM  ·  CASINO SALON', cx, cy + 148);

  // 5 faint gold-hairline community card outlines matching 3D board spacing (0.44u -> 77px)
  ctx.strokeStyle = 'rgba(225, 195, 125, 0.18)';
  ctx.lineWidth = 1.5;
  const slotW = 64;
  const slotH = 104;
  const slotGap = 13;
  const totalW = 5 * slotW + 4 * slotGap;
  const startX = cx - totalW / 2;
  const slotY = cy - 16 - slotH / 2;
  for (let i = 0; i < 5; i++) {
    const sx = startX + i * (slotW + slotGap);
    ctx.strokeRect(sx, slotY, slotW, slotH);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(8, maxAnisotropy);

  // Linear micro-baize bump map
  const [bCanvas, bCtx] = makeCanvas(256, 256);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  const randB = mulberry32(404);
  for (let i = 0; i < 8000; i++) {
    const v = Math.floor(102 + randB() * 52);
    bCtx.fillStyle = `rgb(${v},${v},${v})`;
    bCtx.fillRect(Math.floor(randB() * 256), Math.floor(randB() * 256), 2, 2);
  }
  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(9, 6);
  bumpMap.anisotropy = Math.min(4, maxAnisotropy);

  return { map, bumpMap };
}

/**
 * Rich lacquered dark mahogany / walnut wood grain for the casino racetrack ring
 */
export function createMahoganyWoodTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const w = 512;
  const h = 256;
  const [canvas, ctx] = makeCanvas(w, h);
  const [bCanvas, bCtx] = makeCanvas(w, h);

  ctx.fillStyle = '#3b190d';
  ctx.fillRect(0, 0, w, h);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, w, h);

  const rand = mulberry32(515);
  // Flowing rich burled mahogany / reddish-walnut grain bands
  for (let y = 0; y < h; y++) {
    const wave = Math.sin(y * 0.13) * 0.55 + Math.sin(y * 0.041 + 1.4) * 0.45;
    const r = Math.floor(66 + wave * 32 + rand() * 10);
    const g = Math.floor(26 + wave * 14 + rand() * 6);
    const b = Math.floor(13 + wave * 7 + rand() * 4);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, y, w, 1);

    const bv = Math.floor(120 + wave * 18 + (rand() - 0.5) * 14);
    bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bCtx.fillRect(0, y, w, 1);
  }

  // Dark walnut pores & warm amber highlights
  for (let i = 0; i < 480; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 18 + rand() * 96;
    ctx.fillStyle = rand() > 0.35 ? 'rgba(20, 7, 3, 0.42)' : 'rgba(148, 72, 32, 0.24)';
    ctx.fillRect(x, y, len, 1.4);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(4, 2);
  map.anisotropy = Math.min(8, maxAnisotropy);

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(4, 2);

  return { map, bumpMap };
}

/**
 * Supple deep charcoal-espresso casino armrest leather with fine pebbled grain
 */
export function createLeatherRailTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  ctx.fillStyle = '#0d0b0e';
  ctx.fillRect(0, 0, size, size);

  const rand = mulberry32(707);
  for (let i = 0; i < 3600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.9 + rand() * 2.4;
    const shade = Math.floor(10 + rand() * 14);
    ctx.fillStyle = `rgba(${shade + 4}, ${shade + 1}, ${shade + 2}, 0.55)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(10, 3);
  map.anisotropy = Math.min(4, maxAnisotropy);

  const [bCanvas, bCtx] = makeCanvas(256, 256);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  const randB = mulberry32(808);
  for (let i = 0; i < 3400; i++) {
    const v = Math.floor(92 + randB() * 72);
    bCtx.fillStyle = `rgb(${v},${v},${v})`;
    bCtx.beginPath();
    bCtx.arc(randB() * 256, randB() * 256, 1.4 + randB() * 2.2, 0, Math.PI * 2);
    bCtx.fill();
  }
  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(10, 3);

  return { map, bumpMap };
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const grad = ctx.createRadialGradient(size / 2, size / 2, 12, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.78)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.38)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Luxury dark Monte-Carlo / Bellagio Axminster casino salon carpet (subtle warm bronze diamond motif)
 */
export function createStudioFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size, size);

  ctx.fillStyle = '#0d0b10';
  ctx.fillRect(0, 0, size, size);

  // Subtle woven carpet fibers
  const rand = mulberry32(909);
  for (let i = 0; i < 9000; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    const v = Math.floor(12 + rand() * 16);
    ctx.fillStyle = `rgb(${v + 4}, ${v}, ${v + 5})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Ornate dark-gold geometric salon carpet diamond trellis
  const tile = 128;
  ctx.strokeStyle = 'rgba(180, 138, 72, 0.09)';
  ctx.lineWidth = 2;
  for (let y = 0; y < size; y += tile) {
    for (let x = 0; x < size; x += tile) {
      const mx = x + tile / 2;
      const my = y + tile / 2;
      ctx.beginPath();
      ctx.moveTo(mx, y + 10);
      ctx.lineTo(x + tile - 10, my);
      ctx.lineTo(mx, y + tile - 10);
      ctx.lineTo(x + 10, my);
      ctx.closePath();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(22, 92, 66, 0.1)';
      ctx.beginPath();
      ctx.arc(mx, my, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(180, 138, 72, 0.09)';
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 9);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

const SUIT_GLYPH: Record<Suit, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
};

function suitHex(suit: Suit, fourColor: boolean): string {
  if (fourColor) {
    switch (suit) {
      case 's':
        return '#131924';
      case 'h':
        return '#c81e34';
      case 'd':
        return '#1360ba';
      case 'c':
        return '#137a39';
    }
  }
  return suit === 'h' || suit === 'd' ? '#c81e34' : '#131924';
}

export function createCardFaceTexture(card: Card, fourColor: boolean): THREE.CanvasTexture {
  const w = 256;
  const h = 360;
  const [canvas, ctx] = makeCanvas(w, h);

  // Warm matte ivory Kem/Copag casino cardstock (calibrated against overhead spotlight glare)
  ctx.fillStyle = '#ebe6da';
  ctx.fillRect(0, 0, w, h);

  // Subtle inner card frame
  ctx.strokeStyle = '#cbc5b6';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  const color = suitHex(card.suit, fourColor);
  const rankDisplay = card.rank === 'T' ? '10' : card.rank;
  const glyph = SUIT_GLYPH[card.suit];

  ctx.fillStyle = color;
  ctx.textBaseline = 'top';

  // Top-left bold corner index
  ctx.font = '800 66px "JetBrains Mono", ui-monospace, sans-serif';
  ctx.fillText(rankDisplay, 20, 16);
  ctx.font = 'bold 54px Georgia, serif';
  ctx.fillText(glyph, 22, 82);

  // Center suit emblem
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '144px Georgia, serif';
  ctx.fillText(glyph, w / 2, h / 2 + 8);

  // Bottom-right inverted corner
  ctx.save();
  ctx.translate(w, h);
  ctx.rotate(Math.PI);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '800 66px "JetBrains Mono", ui-monospace, sans-serif';
  ctx.fillText(rankDisplay, 20, 16);
  ctx.font = 'bold 54px Georgia, serif';
  ctx.fillText(glyph, 22, 82);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createCardBackTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 360;
  const [canvas, ctx] = makeCanvas(w, h);

  ctx.fillStyle = '#f2efe6';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#150d1d';
  ctx.fillRect(14, 14, w - 28, h - 28);

  // Ornate crimson/gold casino diamond filigree
  ctx.strokeStyle = 'rgba(218, 178, 96, 0.36)';
  ctx.lineWidth = 2;
  for (let y = 26; y < h - 26; y += 22) {
    for (let x = 26; x < w - 26; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x + 8, y);
      ctx.lineTo(x, y + 8);
      ctx.lineTo(x - 8, y);
      ctx.closePath();
      ctx.stroke();
    }
  }

  ctx.strokeStyle = '#d4a94d';
  ctx.lineWidth = 4;
  ctx.strokeRect(22, 22, w - 44, h - 44);

  ctx.fillStyle = '#1c1126';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d4a94d';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#f5e6c4';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FL', w / 2, h / 2 + 1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createDealerPuckTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);

  const grad = ctx.createRadialGradient(size * 0.42, size * 0.4, 10, size / 2, size / 2, size / 2);
  grad.addColorStop(0, '#fffdf6');
  grad.addColorStop(0.75, '#ebe1c5');
  grad.addColorStop(1, '#c6ae70');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#7e6023';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#151820';
  ctx.font = 'bold 96px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('D', size / 2, size / 2 + 2);

  ctx.font = '700 18px "Space Grotesk", sans-serif';
  ctx.fillStyle = '#5a4419';
  ctx.fillText('DEALER', size / 2, size * 0.78);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Heavy brushed-gold casino card-protector medallion face with spade crest
 */
export function createCardProtectorTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const cx = size / 2;
  const cy = size / 2;

  const grad = ctx.createRadialGradient(cx - 22, cy - 22, 12, cx, cy, cx);
  grad.addColorStop(0, '#fae596');
  grad.addColorStop(0.55, '#d4a644');
  grad.addColorStop(1, '#7c5819');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Outer milled coin ring
  ctx.strokeStyle = '#5c3f0e';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.43, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 245, 200, 0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.37, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Deep obsidian inner medallion disc with golden spade crest
  ctx.fillStyle = '#18130e';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#efd079';
  ctx.font = 'bold 84px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('♠', cx, cy - 4);

  ctx.font = '700 16px "Space Grotesk", sans-serif';
  ctx.fillStyle = '#d7b25a';
  ctx.fillText('HIGH ROLLER', cx, cy + 52);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Paulson-style clay poker chip cylinder side wall with 6 crisp contrasting edge-spot stripes
 */
export function createChipSideTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 32;
  const [canvas, ctx] = makeCanvas(w, h);

  // Neutral white base so InstancedMesh setColorAt tints the clay body naturally
  ctx.fillStyle = '#dcdcdc';
  ctx.fillRect(0, 0, w, h);

  // 6 authentic vertical casino edge-spot stripes (bright ivory + subtle dark flank)
  const stripes = 6;
  for (let i = 0; i < stripes; i++) {
    const x = Math.round((i / stripes) * w);
    ctx.fillStyle = '#262626';
    ctx.fillRect(x, 0, 2, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 2, 0, 12, h);
    ctx.fillStyle = '#262626';
    ctx.fillRect(x + 14, 0, 2, h);
  }

  // Subtle horizontal clay mold groove along top/bottom rim
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, 0, w, 3);
  ctx.fillRect(0, h - 3, w, 3);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/**
 * High-contrast casino clay chip top face with 6 outer edge spots & brushed cream inlay
 */
export function createChipTopTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const cx = size / 2;
  const cy = size / 2;

  ctx.fillStyle = '#e6e6e6';
  ctx.fillRect(0, 0, size, size);

  // 6 bold outer edge spots matching side wall stripes
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillRect(-15, -cx, 30, 34);
    ctx.restore();
  }

  // Molded clay ring groove
  ctx.strokeStyle = 'rgba(15, 20, 28, 0.45)';
  ctx.lineWidth = 7;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.37, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Warm cream casino center inlay
  ctx.fillStyle = '#f5efe1';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.27, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#9e7c38';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Inner rosette dot
  ctx.strokeStyle = 'rgba(20, 24, 34, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.17, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSeatPlaqueTexture(
  position: Position,
  label: string,
  stackBb: number,
  isHero: boolean,
  isActive: boolean,
  folded: boolean,
  styleTag?: string,
  actionText?: string,
  isWinner?: boolean
): THREE.CanvasTexture {
  const w = 320;
  const h = 136;
  const [canvas, ctx] = makeCanvas(w, h);

  // Luxury dark espresso-obsidian casino nameplate
  ctx.fillStyle = folded
    ? '#0a0c10'
    : isWinner
      ? '#211909'
      : isHero
        ? '#0c1e18'
        : '#10141c';
  ctx.fillRect(0, 0, w, h);

  // Brushed brass/emerald border + fine inner pinstripe
  ctx.strokeStyle = isWinner
    ? '#f59e0b'
    : isActive
      ? '#34d399'
      : isHero
        ? '#c9a24b'
        : '#4b3f2b';
  ctx.lineWidth = isActive || isWinner ? 8 : 5;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  ctx.strokeStyle = 'rgba(212, 175, 95, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(11, 11, w - 22, h - 22);

  // Position badge text
  ctx.fillStyle = folded ? '#64748b' : isWinner ? '#fbbf24' : '#34d399';
  ctx.font = 'bold 34px "JetBrains Mono", monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(position, 20, 16);

  // Player label
  ctx.fillStyle = folded ? '#64748b' : '#f4efe6';
  ctx.font = '600 24px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(label.slice(0, 12), w - 20, 19);

  // Middle style/HUD metadata
  if (styleTag) {
    ctx.textAlign = 'right';
    ctx.fillStyle = folded ? '#475569' : '#c9b896';
    ctx.font = '600 18px "JetBrains Mono", monospace';
    ctx.fillText(styleTag.slice(0, 16), w - 20, 52);
  }

  // Bottom-left stack bb
  ctx.textAlign = 'left';
  ctx.fillStyle = folded ? '#475569' : '#fdfaf3';
  ctx.font = 'bold 28px "JetBrains Mono", monospace';
  ctx.fillText(`${stackBb.toFixed(1)} bb`, 20, 86);

  // Bottom-right live action tag or winner badge
  const badgeText = isWinner ? 'WINNER' : actionText ? actionText.slice(0, 13) : '';
  if (badgeText) {
    ctx.textAlign = 'right';
    ctx.fillStyle = isWinner
      ? '#fbbf24'
      : folded
        ? '#64748b'
        : badgeText.includes('Raise') || badgeText.includes('Bet') || badgeText.includes('All-In')
          ? '#34d399'
          : '#38bdf8';
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillText(badgeText, w - 20, 92);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
