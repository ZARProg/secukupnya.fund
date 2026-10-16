import type { StoryCard } from './recapCards';
import { THEMES } from './recapTheme';

export const CARD_W = 1080;
export const CARD_H = 1350;
const PAD = 90;
const FONT = '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif';

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/.{0,2}$/, '…');
    return kept;
  }
  return lines;
}

async function ensureFont() {
  try {
    await Promise.all([
      document.fonts.load(`800 80px ${FONT}`),
      document.fonts.load(`500 40px ${FONT}`),
      document.fonts.load(`700 40px ${FONT}`),
    ]);
  } catch {
    // Pakai font cadangan.
  }
}

export async function renderCard(card: StoryCard, footerRight: string): Promise<HTMLCanvasElement> {
  await ensureFont();
  const c = document.createElement('canvas');
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas');
  const th = THEMES[card.theme];

  const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  g.addColorStop(0, th.from);
  g.addColorStop(1, th.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.arc(CARD_W - 60, 120, 320, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(80, CARD_H - 80, 260, 0, Math.PI * 2); ctx.fill();

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  ctx.fillStyle = th.muted;
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText(card.eyebrow.toUpperCase(), PAD, 170);

  let y = 290;
  if (card.title) {
    ctx.fillStyle = th.text;
    ctx.font = `800 72px ${FONT}`;
    for (const line of wrap(ctx, card.title, CARD_W - PAD * 2, 2)) {
      ctx.fillText(line, PAD, y);
      y += 86;
    }
  }

  // Angka besar: kecilkan sampai muat.
  let size = 220;
  ctx.fillStyle = th.text;
  do {
    ctx.font = `800 ${size}px ${FONT}`;
    size -= 8;
  } while (ctx.measureText(card.big).width > CARD_W - PAD * 2 && size > 60);
  const bigY = Math.max(y + 220, 640);
  ctx.fillText(card.big, PAD, bigY);

  ctx.fillStyle = th.muted;
  ctx.font = `500 44px ${FONT}`;
  let sy = bigY + 80;
  for (const line of wrap(ctx, card.sub, CARD_W - PAD * 2, 3)) {
    ctx.fillText(line, PAD, sy);
    sy += 58;
  }

  let ry = Math.max(sy + 70, 900);
  for (const row of card.rows.slice(0, 3)) {
    ctx.fillStyle = th.text;
    ctx.font = `500 40px ${FONT}`;
    ctx.textAlign = 'left';
    const valueW = (() => { ctx.font = `800 40px ${FONT}`; return ctx.measureText(row.value).width; })();
    ctx.font = `500 40px ${FONT}`;
    const label = wrap(ctx, row.label, CARD_W - PAD * 2 - valueW - 30, 1)[0] ?? '';
    ctx.fillText(label, PAD, ry);
    ctx.font = `800 40px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(row.value, CARD_W - PAD, ry);
    ctx.textAlign = 'left';
    if (row.pct !== undefined) {
      const w = CARD_W - PAD * 2;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath(); ctx.roundRect(PAD, ry + 18, w, 14, 7); ctx.fill();
      ctx.fillStyle = th.accent;
      ctx.beginPath(); ctx.roundRect(PAD, ry + 18, Math.max(14, (w * Math.min(100, row.pct)) / 100), 14, 7); ctx.fill();
      ry += 82;
    } else {
      ry += 66;
    }
  }

  ctx.fillStyle = th.muted;
  ctx.font = `700 30px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('secukupnya.fund', PAD, CARD_H - 70);
  ctx.textAlign = 'right';
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText(footerRight, CARD_W - PAD, CARD_H - 70);
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/png'));
}
