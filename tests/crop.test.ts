import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectReceiptBounds } from '../src/lib/canvas-crop.ts';

describe('Receipt auto-crop edge detector', () => {
  it('crops dark desk margin around a bright paper receipt', () => {
    const w = 100;
    const h = 100;
    const rgba = new Uint8ClampedArray(w * h * 4);
    // Dark desk background (RGB = 30, 35, 45)
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = 30;
      rgba[i + 1] = 35;
      rgba[i + 2] = 45;
      rgba[i + 3] = 255;
    }
    // White receipt paper centered at x=[25..75], y=[20..80]
    for (let y = 20; y < 80; y += 1) {
      for (let x = 25; x < 75; x += 1) {
        const idx = (y * w + x) * 4;
        rgba[idx] = 248;
        rgba[idx + 1] = 248;
        rgba[idx + 2] = 245;
      }
    }

    const bounds = detectReceiptBounds(rgba, w, h);
    assert.equal(bounds.autoCropped, true);
    assert.ok(bounds.x >= 20 && bounds.x <= 26);
    assert.ok(bounds.y >= 15 && bounds.y <= 21);
    assert.ok(bounds.width < 70 && bounds.width >= 48);
    assert.ok(bounds.height < 75 && bounds.height >= 58);
  });
});
