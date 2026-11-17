import { NextResponse } from 'next/server';
import { loadReceiptImage } from '@/lib/store';
import { getOrCreateWorkspaceId } from '@/lib/workspace-cookie';

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { workspaceId } = await getOrCreateWorkspaceId();
  const img = await loadReceiptImage(workspaceId, id);
  if (!img) {
    return NextResponse.json({ error: 'Receipt image not found' }, { status: 404 });
  }

  const body: BodyInit =
    img.stream instanceof Uint8Array
      ? new Blob([Uint8Array.from(img.stream)], { type: img.contentType })
      : img.stream;
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': img.contentType,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
