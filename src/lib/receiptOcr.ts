/**
 * OCR struk di browser (tesseract.js). Foto TIDAK dikirim ke server mana pun: mesin dan data bahasa disajikan dari situs ini
 * (public/ocr, disalin oleh scripts/copy-ocr-assets.mjs) dan semua pemrosesan terjadi di perangkat.
 * Modul ini dimuat malas (dynamic import) supaya unduhan ±5 MB hanya terjadi saat fitur dipakai.
 */

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_SIDE = 2400;
const MIN_WIDTH = 1100;

export type OcrStage = 'prepare' | 'engine' | 'read';
export interface OcrProgress { stage: OcrStage; progress: number }

export type OcrErrorCode = 'type' | 'size' | 'decode' | 'engine' | 'read' | 'cancelled';
export class OcrError extends Error {
  code: OcrErrorCode;
  constructor(code: OcrErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

export function checkImageFile(file: { type: string; size: number }): OcrErrorCode | null {
  if (!/^image\/(jpeg|png|webp|gif|bmp)$/i.test(file.type)) return 'type';
  if (file.size > MAX_IMAGE_BYTES) return 'size';
  return null;
}

/** Ukuran hasil: sisi terpanjang dibatasi, foto kecil diperbesar supaya huruf cukup besar untuk dibaca. */
export function targetSize(w: number, h: number): { w: number; h: number } {
  let scale = 1;
  const longest = Math.max(w, h);
  if (longest > MAX_SIDE) scale = MAX_SIDE / longest;
  else if (w < MIN_WIDTH) scale = Math.min(2, MIN_WIDTH / w);
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

/** Regangkan kontras: abu-abu, lalu persentil 2% dan 98% dipetakan ke hitam dan putih. */
export function stretchContrast(gray: Uint8ClampedArray): void {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const lowCut = gray.length * 0.02;
  const highCut = gray.length * 0.98;
  let acc = 0, lo = 0, hi = 255;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= lowCut) { lo = v; break; } }
  acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= highCut) { hi = v; break; } }
  if (hi - lo < 16) return; // sudah rata/kosong: jangan memperkuat noise
  const range = hi - lo;
  for (let i = 0; i < gray.length; i++) gray[i] = Math.max(0, Math.min(255, ((gray[i] - lo) * 255) / range));
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  try {
    // imageOrientation: 'from-image' menghormati EXIF (foto HP yang dipotret miring).
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  } catch {
    // Cadangan untuk browser tanpa opsi di atas.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new OcrError('decode'));
        img.src = url;
      });
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e instanceof OcrError ? e : new OcrError('decode');
    }
  }
}

/** Foto → kanvas hitam-putih berkontras tinggi dengan ukuran yang cocok untuk OCR. */
export async function prepareImage(file: Blob): Promise<{ canvas: HTMLCanvasElement; preview: string }> {
  const img = await decode(file);
  try {
    if (!img.width || !img.height) throw new OcrError('decode');
    const { w, h } = targetSize(img.width, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new OcrError('decode');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img.source, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) gray[j] = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    stretchContrast(gray);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) { px[i] = px[i + 1] = px[i + 2] = gray[j]; px[i + 3] = 255; }
    ctx.putImageData(data, 0, 0);
    // Pratinjau kecil untuk layar pemeriksaan (bukan hasil kontras), supaya pengguna membandingkan dengan fotonya sendiri.
    const pv = document.createElement('canvas');
    const ps = Math.min(1, 900 / Math.max(img.width, img.height));
    pv.width = Math.max(1, Math.round(img.width * ps));
    pv.height = Math.max(1, Math.round(img.height * ps));
    pv.getContext('2d')?.drawImage(img.source, 0, 0, pv.width, pv.height);
    return { canvas, preview: pv.toDataURL('image/jpeg', 0.8) };
  } finally {
    img.close();
  }
}

// ---------- Mesin OCR ----------

type TessWorker = import('tesseract.js').Worker;
let workerPromise: Promise<TessWorker> | null = null;
let onProgress: ((p: OcrProgress) => void) | null = null;

/** Batas diam saat memuat mesin: unduhan lambat tetap aman selama masih ada kemajuan. */
const ENGINE_IDLE_MS = 45_000;

const base = () => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/ocr`;

async function getWorker(): Promise<TessWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const dir = base();
      // Mesin yang gagal berjalan (mis. WebAssembly diblokir browser lama) tidak selalu melempar error, kadang hanya diam.
      // Karena itu error dari worker ditangkap, dan tanpa kabar selama ENGINE_IDLE_MS dianggap gagal dengan pesan yang jelas.
      const worker = await new Promise<TessWorker>((resolve, reject) => {
        let settled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const fail = (e: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(e instanceof Error ? e : new Error(typeof e === 'string' ? e : JSON.stringify(e)));
        };
        const arm = () => {
          clearTimeout(timer);
          timer = setTimeout(() => fail(new Error('timeout: the engine did not respond')), ENGINE_IDLE_MS);
        };
        arm();
        createWorker('ind', 1, {
          workerPath: `${dir}/worker.min.js`,
          corePath: dir,
          langPath: dir,
          gzip: true,
          workerBlobURL: false,
          errorHandler: fail,
          logger: (m) => {
            arm();
            if (!onProgress) return;
            const p = typeof m.progress === 'number' ? m.progress : 0;
            if (m.status === 'recognizing text') onProgress({ stage: 'read', progress: p });
            else onProgress({ stage: 'engine', progress: p });
          },
        }).then(
          (w) => {
            if (settled) { void w.terminate(); return; } // sudah dianggap gagal: jangan biarkan mesin menggantung
            settled = true;
            clearTimeout(timer);
            resolve(w);
          },
          fail,
        );
      });
      await worker.setParameters({ tessedit_pageseg_mode: '4' as never, preserve_interword_spaces: '1' });
      return worker;
    })().catch((e) => {
      workerPromise = null;
      throw new OcrError('engine', e instanceof Error ? e.message : String(e));
    });
  }
  return workerPromise;
}

/** Hentikan mesin OCR dan bebaskan memori (dipanggil saat panel ditutup atau pengguna membatalkan). */
export async function stopOcr(): Promise<void> {
  const p = workerPromise;
  workerPromise = null;
  onProgress = null;
  if (p) {
    try { await (await p).terminate(); } catch { /* sudah berhenti */ }
  }
}

export interface OcrResult { text: string; confidence: number }

export async function recognizeCanvas(canvas: HTMLCanvasElement, progress: (p: OcrProgress) => void): Promise<OcrResult> {
  onProgress = progress;
  const worker = await getWorker();
  try {
    const r = await worker.recognize(canvas);
    return { text: r.data.text ?? '', confidence: Number.isFinite(r.data.confidence) ? r.data.confidence : 0 };
  } catch (e) {
    throw new OcrError('read', e instanceof Error ? e.message : String(e));
  } finally {
    onProgress = null;
  }
}
