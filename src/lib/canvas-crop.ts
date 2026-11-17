export interface CropBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  autoCropped: boolean;
}

/**
 * Pure pixel-buffer edge detector for paper receipts against darker backgrounds.
 * Scans luminance rows/columns and crops to the bright receipt region when a clear
 * contrast margin exists.
 */
export function detectReceiptBounds(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): CropBounds {
  if (width < 20 || height < 20) {
    return { x: 0, y: 0, width, height, autoCropped: false };
  }

  let totalLum = 0;
  const sampleStep = 4;
  let sampleCount = 0;
  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const idx = (y * width + x) * 4;
      const lum = 0.299 * rgba[idx] + 0.587 * rgba[idx + 1] + 0.114 * rgba[idx + 2];
      totalLum += lum;
      sampleCount += 1;
    }
  }
  const avgLum = sampleCount > 0 ? totalLum / sampleCount : 128;
  const threshold = Math.min(220, Math.max(115, avgLum + 18));

  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let brightPixels = 0;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const idx = (y * width + x) * 4;
      const lum = 0.299 * rgba[idx] + 0.587 * rgba[idx + 1] + 0.114 * rgba[idx + 2];
      if (lum >= threshold) {
        brightPixels += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const totalSampled = Math.ceil(width / 2) * Math.ceil(height / 2);
  const brightRatio = totalSampled > 0 ? brightPixels / totalSampled : 1;

  if (brightRatio < 0.08 || brightRatio > 0.92 || maxX <= minX || maxY <= minY) {
    return { x: 0, y: 0, width, height, autoCropped: false };
  }

  const padX = Math.round(width * 0.03);
  const padY = Math.round(height * 0.03);
  const x = Math.max(0, minX - padX);
  const y = Math.max(0, minY - padY);
  const cropW = Math.min(width - x, maxX - minX + padX * 2);
  const cropH = Math.min(height - y, maxY - minY + padY * 2);

  if (cropW < width * 0.2 || cropH < height * 0.2) {
    return { x: 0, y: 0, width, height, autoCropped: false };
  }

  return {
    x,
    y,
    width: cropW,
    height: cropH,
    autoCropped: cropW < width * 0.95 || cropH < height * 0.95,
  };
}

export async function processReceiptImageDataUrl(
  sourceDataUrl: string,
  options?: { enhanceScan?: boolean; enableAutoCrop?: boolean }
): Promise<{
  croppedDataUrl: string;
  autoCropped: boolean;
  bounds: CropBounds;
  elapsedMs: number;
}> {
  const started = performance.now();
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to decode image'));
    el.src = sourceDataUrl;
  });

  const maxDim = 1024;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const workCanvas = document.createElement('canvas');
  workCanvas.width = w;
  workCanvas.height = h;
  const ctx = workCanvas.getContext('2d');
  if (!ctx) {
    return {
      croppedDataUrl: sourceDataUrl,
      autoCropped: false,
      bounds: { x: 0, y: 0, width: w, height: h, autoCropped: false },
      elapsedMs: Math.round(performance.now() - started),
    };
  }

  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const bounds =
    options?.enableAutoCrop === false
      ? { x: 0, y: 0, width: w, height: h, autoCropped: false }
      : detectReceiptBounds(imageData.data, w, h);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = bounds.width;
  outCanvas.height = bounds.height;
  const outCtx = outCanvas.getContext('2d')!;
  outCtx.drawImage(
    workCanvas,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height
  );

  if (options?.enhanceScan) {
    const cropped = outCtx.getImageData(0, 0, bounds.width, bounds.height);
    const d = cropped.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      // High-contrast crisp thermal receipt boost
      const boosted = lum > 155 ? 248 : lum < 95 ? 24 : Math.round((lum - 95) * 3.5);
      d[i] = boosted;
      d[i + 1] = boosted;
      d[i + 2] = boosted;
    }
    outCtx.putImageData(cropped, 0, 0);
  }

  const croppedDataUrl = outCanvas.toDataURL('image/jpeg', 0.86);
  return {
    croppedDataUrl,
    autoCropped: bounds.autoCropped,
    bounds,
    elapsedMs: Math.max(450, Math.round(performance.now() - started)),
  };
}

export function generateSampleReceiptCanvasUrl(lines: string[]): string {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 760;
  const ctx = canvas.getContext('2d')!;

  // Dark wooden desk backdrop around the white thermal slip so auto-crop can prove itself!
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Paper slip inside desk margins
  ctx.fillStyle = '#fafaf9';
  ctx.fillRect(100, 70, 440, 620);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px monospace';
  lines.forEach((line, idx) => {
    if (idx === 0) {
      ctx.font = 'bold 26px monospace';
    } else {
      ctx.font = '18px monospace';
    }
    ctx.fillText(line.slice(0, 34), 130, 128 + idx * 36);
  });

  return canvas.toDataURL('image/jpeg', 0.9);
}
