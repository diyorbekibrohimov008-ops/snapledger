import { get, put } from '@vercel/blob';
import { createInitialWorkspace } from './seed.ts';
import type { WorkspaceState } from './types.ts';

const globalStore = globalThis as unknown as {
  __snapledgerWorkspaces?: Map<string, WorkspaceState>;
  __snapledgerImages?: Map<string, { buffer: Buffer; contentType: string }>;
};

function getMemWorkspaces(): Map<string, WorkspaceState> {
  if (!globalStore.__snapledgerWorkspaces) {
    globalStore.__snapledgerWorkspaces = new Map();
  }
  return globalStore.__snapledgerWorkspaces;
}

function getMemImages(): Map<string, { buffer: Buffer; contentType: string }> {
  if (!globalStore.__snapledgerImages) {
    globalStore.__snapledgerImages = new Map();
  }
  return globalStore.__snapledgerImages;
}

function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function workspaceBlobPath(workspaceId: string): string {
  const safe = workspaceId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `workspaces/${safe || 'ws_demo'}.json`;
}

function imageBlobPath(workspaceId: string, receiptId: string): string {
  const safeWs = workspaceId.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeRcpt = receiptId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `receipts/${safeWs}/${safeRcpt}.img`;
}

export async function loadWorkspace(workspaceId: string): Promise<WorkspaceState> {
  const safeId = workspaceId.replace(/[^a-zA-Z0-9_-]/g, '') || 'ws_demo';

  if (hasBlobToken()) {
    try {
      const result = await get(workspaceBlobPath(safeId), {
        access: 'private',
        useCache: false,
      });
      if (result && result.statusCode === 200 && result.stream) {
        const text = await new Response(result.stream).text();
        const parsed = JSON.parse(text) as WorkspaceState;
        getMemWorkspaces().set(safeId, parsed);
        return parsed;
      }
    } catch {
      // Not found in Blob yet; initialize below
    }
  }

  const mem = getMemWorkspaces().get(safeId);
  if (mem) return mem;

  const initial = createInitialWorkspace(safeId);
  await saveWorkspace(initial);
  return initial;
}

export async function saveWorkspace(state: WorkspaceState): Promise<WorkspaceState> {
  const next: WorkspaceState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  getMemWorkspaces().set(next.workspaceId, next);

  if (hasBlobToken()) {
    try {
      await put(workspaceBlobPath(next.workspaceId), JSON.stringify(next), {
        access: 'private',
        allowOverwrite: true,
        addRandomSuffix: false,
        cacheControlMaxAge: 0,
        contentType: 'application/json',
      });
    } catch (err) {
      console.error('Blob saveWorkspace error:', err);
    }
  }

  return next;
}

export async function resetWorkspace(workspaceId: string): Promise<WorkspaceState> {
  const safeId = workspaceId.replace(/[^a-zA-Z0-9_-]/g, '') || 'ws_demo';
  const fresh = createInitialWorkspace(safeId);
  return saveWorkspace(fresh);
}

export async function saveReceiptImage(
  workspaceId: string,
  receiptId: string,
  dataUrl: string
): Promise<string | undefined> {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return undefined;

  const contentType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  const key = `${workspaceId}:${receiptId}`;
  getMemImages().set(key, { buffer, contentType });

  if (hasBlobToken()) {
    try {
      await put(imageBlobPath(workspaceId, receiptId), buffer, {
        access: 'private',
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType,
      });
    } catch (err) {
      console.error('Blob saveReceiptImage error:', err);
    }
  }

  return `/api/receipts/${encodeURIComponent(receiptId)}/image`;
}

export async function loadReceiptImage(
  workspaceId: string,
  receiptId: string
): Promise<{ stream: ReadableStream<Uint8Array> | Buffer; contentType: string } | null> {
  if (hasBlobToken()) {
    try {
      const res = await get(imageBlobPath(workspaceId, receiptId), {
        access: 'private',
      });
      if (res && res.statusCode === 200 && res.stream) {
        return {
          stream: res.stream,
          contentType: res.blob?.contentType || 'image/jpeg',
        };
      }
    } catch {
      // Fallback to in-memory cache
    }
  }

  const mem = getMemImages().get(`${workspaceId}:${receiptId}`);
  if (!mem) return null;
  return { stream: mem.buffer, contentType: mem.contentType };
}
