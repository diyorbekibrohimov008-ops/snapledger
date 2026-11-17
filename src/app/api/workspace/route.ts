import { NextResponse } from 'next/server';
import { loadWorkspace, resetWorkspace } from '@/lib/store';
import { attachWorkspaceCookie, getOrCreateWorkspaceId } from '@/lib/workspace-cookie';

export async function GET() {
  const { workspaceId, isNew } = await getOrCreateWorkspaceId();
  const state = await loadWorkspace(workspaceId);
  const res = NextResponse.json(state);
  return attachWorkspaceCookie(res, workspaceId, isNew);
}

export async function POST(req: Request) {
  const { workspaceId, isNew } = await getOrCreateWorkspaceId();
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action === 'reset') {
    const fresh = await resetWorkspace(workspaceId);
    const res = NextResponse.json(fresh);
    return attachWorkspaceCookie(res, workspaceId, isNew);
  }
  const current = await loadWorkspace(workspaceId);
  const res = NextResponse.json(current);
  return attachWorkspaceCookie(res, workspaceId, isNew);
}
