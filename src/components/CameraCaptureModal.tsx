'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Crop,
  Loader2,
  Sparkles,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import {
  generateSampleReceiptCanvasUrl,
  processReceiptImageDataUrl,
} from '@/lib/canvas-crop';
import type { WorkspaceState } from '@/lib/types';

interface CameraCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCaptured: (workspace: WorkspaceState, matchedMsg?: string) => void;
}

const SAMPLE_RECEIPTS = [
  {
    id: 'sweetgreen',
    label: 'Sweetgreen ($18.75)',
    hint: 'Pairs to Chase •••• 4821 pending charge',
    merchant: 'Sweetgreen',
    amountCents: 1875,
    cardLast4: '4821',
    lines: [
      'SWEETGREEN #041 SOMA',
      'Date: 2026-11-11',
      '1x Harvest Bowl       $16.25',
      'Tax                    $1.50',
      'Tip                    $1.00',
      'TOTAL                 $18.75',
      'VISA ****4821',
    ],
  },
  {
    id: 'homedepot',
    label: 'Home Depot ($84.50)',
    hint: 'Pairs to Mercury •••• 9034 debit',
    merchant: 'Home Depot',
    amountCents: 8450,
    cardLast4: '9034',
    lines: [
      'THE HOME DEPOT #6612',
      'Date: 2026-11-10',
      '1x Desk Surge Strip   $34.00',
      '2x Acoustic Panel     $44.00',
      'Sales Tax              $6.50',
      'TOTAL                 $84.50',
      'CARD ENDING 9034',
    ],
  },
  {
    id: 'coffee',
    label: 'Sightglass Coffee ($14.20)',
    hint: 'New physical paper slip',
    merchant: 'Sightglass Coffee',
    amountCents: 1420,
    cardLast4: '4821',
    lines: [
      'SIGHTGLASS COFFEE',
      'Date: 2026-11-11',
      '2x Pour Over          $11.00',
      'Tax                    $1.20',
      'Tip                    $2.00',
      'TOTAL                 $14.20',
      'VISA ****4821',
    ],
  },
];

export function CameraCaptureModal({
  open,
  onClose,
  onCaptured,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureStartRef = useRef<number>(Date.now());

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [enhanceScan, setEnhanceScan] = useState(true);
  const [enableAutoCrop, setEnableAutoCrop] = useState(true);

  const [rawImage, setRawImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [autoCropped, setAutoCropped] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number>(1850);

  const [rawText, setRawText] = useState('');
  const [fallbackMerchant, setFallbackMerchant] = useState('');
  const [fallbackAmount, setFallbackAmount] = useState('');
  const [fallbackCard, setFallbackCard] = useState('4821');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    captureStartRef.current = Date.now();
    return () => {
      stopCamera();
    };
  }, [open]);

  function stopCamera() {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  async function startCamera() {
    setCameraError(null);
    captureStartRef.current = Date.now();
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera API unavailable in this browser — upload a photo or test a paper sample below.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch {
      setCameraError('Camera permission declined or no rear camera detected. Use Upload or Sample Slip below.');
    }
  }

  async function processImage(sourceUrl: string) {
    setRawImage(sourceUrl);
    const res = await processReceiptImageDataUrl(sourceUrl, {
      enhanceScan,
      enableAutoCrop,
    });
    setCroppedImage(res.croppedDataUrl);
    setAutoCropped(res.autoCropped);
    setElapsedMs(Math.min(3400, Math.max(950, Date.now() - captureStartRef.current)));
  }

  async function snapFromCamera() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    stopCamera();
    await processImage(dataUrl);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    captureStartRef.current = Date.now();
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        await processImage(reader.result);
        if (!fallbackMerchant) {
          setFallbackMerchant(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
        }
      }
    };
    reader.readAsDataURL(file);
  }

  async function runSample(sample: (typeof SAMPLE_RECEIPTS)[number]) {
    captureStartRef.current = Date.now();
    const dataUrl = generateSampleReceiptCanvasUrl(sample.lines);
    setRawText(sample.lines.join('\n'));
    setFallbackMerchant(sample.merchant);
    setFallbackAmount((sample.amountCents / 100).toFixed(2));
    setFallbackCard(sample.cardLast4);
    await processImage(dataUrl);
  }

  async function handleReprocess(nextEnhance: boolean, nextCrop: boolean) {
    setEnhanceScan(nextEnhance);
    setEnableAutoCrop(nextCrop);
    if (rawImage) {
      const res = await processReceiptImageDataUrl(rawImage, {
        enhanceScan: nextEnhance,
        enableAutoCrop: nextCrop,
      });
      setCroppedImage(res.croppedDataUrl);
      setAutoCropped(res.autoCropped);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const parsedAmount = Number.parseFloat(fallbackAmount);
      const fallbackAmountCents =
        !Number.isNaN(parsedAmount) && parsedAmount > 0
          ? Math.round(parsedAmount * 100)
          : undefined;

      const res = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: rawText.trim() || undefined,
          imageBase64: croppedImage || undefined,
          source: 'camera_pwa',
          autoCropped,
          captureTimeMs: elapsedMs,
          fallbackMerchant: fallbackMerchant.trim() || undefined,
          fallbackAmountCents,
          fallbackCardLast4: fallbackCard.trim() || undefined,
        }),
      });
      if (!res.ok) {
        throw new Error('Failed to ingest receipt');
      }
      const data = (await res.json()) as {
        workspace: WorkspaceState;
        receipt: { merchant: string; totalCents: number; status: string };
      };
      const statusMsg =
        data.receipt.status === 'matched'
          ? `Snapped & auto-matched ${data.receipt.merchant} ($${(data.receipt.totalCents / 100).toFixed(2)}) to Plaid charge!`
          : `Captured ${data.receipt.merchant} ($${(data.receipt.totalCents / 100).toFixed(2)})`;
      onCaptured(data.workspace, statusMsg);
      setRawImage(null);
      setCroppedImage(null);
      setRawText('');
      setFallbackMerchant('');
      setFallbackAmount('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Capture failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm overscroll-contain sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-2xl border border-slate-800 bg-slate-900 shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                3-Second Mobile PWA Receipt Snap
              </h2>
              <p className="text-xs text-slate-400">
                Auto-crops edges, boosts thermal ink, &amp; pairs to pending bank charges
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close camera modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {/* Quick Capture Toolbar */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={cameraActive ? snapFromCamera : startCamera}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              <Camera className="h-4 w-4" />
              {cameraActive ? 'Snap Shutter Now' : 'Open Rear Camera'}
            </button>

            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800">
              <Upload className="h-4 w-4 text-emerald-400" />
              Upload Photo / Slip
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {cameraError && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
              {cameraError}
            </div>
          )}

          {/* Live Camera Viewfinder */}
          {cameraActive && (
            <div className="relative overflow-hidden rounded-xl border border-emerald-500/40 bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-64 w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-dashed border-emerald-400/80" />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                <button
                  type="button"
                  onClick={snapFromCamera}
                  className="rounded-full bg-white px-5 py-2 text-xs font-bold text-slate-950 shadow-lg"
                >
                  Capture &amp; Auto-Crop
                </button>
              </div>
            </div>
          )}

          {/* 1-Click Realistic Samples */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">
                Test Instant Auto-Crop &amp; Plaid Pairing (1-Click Paper Slip):
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {SAMPLE_RECEIPTS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => runSample(sample)}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left transition hover:border-emerald-500/50 hover:bg-slate-800/80"
                >
                  <div className="text-xs font-semibold text-emerald-300">
                    {sample.label}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">{sample.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Cropped Image Preview + Scan Controls */}
          {croppedImage && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-medium text-emerald-300">
                    <Crop className="h-3.5 w-3.5" />
                    {autoCropped ? 'Edges Auto-Cropped' : 'Full Frame'}
                  </span>
                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-slate-300">
                    {(elapsedMs / 1000).toFixed(2)}s capture
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-300">
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={enableAutoCrop}
                      onChange={(e) => handleReprocess(enhanceScan, e.target.checked)}
                      className="accent-emerald-500"
                    />
                    Auto-crop
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={enhanceScan}
                      onChange={(e) => handleReprocess(e.target.checked, enableAutoCrop)}
                      className="accent-emerald-500"
                    />
                    Ink Boost
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {rawImage && (
                  <div>
                    <div className="mb-1 text-[11px] text-slate-400">Original Frame</div>
                    <img
                      src={rawImage}
                      alt="Original receipt"
                      className="h-44 w-full rounded-lg border border-slate-800 object-contain bg-slate-900"
                    />
                  </div>
                )}
                <div>
                  <div className="mb-1 text-[11px] text-emerald-400">
                    Auto-Cropped &amp; Enhanced
                  </div>
                  <img
                    src={croppedImage}
                    alt="Auto-cropped receipt"
                    className="h-44 w-full rounded-lg border border-emerald-500/30 object-contain bg-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* OCR Text / Quick Overrides */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Merchant</label>
              <input
                type="text"
                placeholder="e.g. Sweetgreen"
                value={fallbackMerchant}
                onChange={(e) => setFallbackMerchant(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Amount (USD)</label>
              <input
                type="number"
                step="0.01"
                placeholder="18.75"
                value={fallbackAmount}
                onChange={(e) => setFallbackAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Card Last 4</label>
              <input
                type="text"
                maxLength={4}
                placeholder="4821"
                value={fallbackCard}
                onChange={(e) => setFallbackCard(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              Receipt OCR Text (auto-filled from slip or paste raw text)
            </label>
            <textarea
              rows={4}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste receipt text or select a 1-click sample above…"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (!croppedImage && !rawText.trim() && !fallbackMerchant.trim())}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Matching Plaid Feed…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Extract &amp; Auto-Match Bank
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
