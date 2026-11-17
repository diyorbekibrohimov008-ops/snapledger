import { cookies } from 'next/headers';

export const WORKSPACE_COOKIE = 'sl_ws';

export async function getOrCreateWorkspaceId(): Promise<{
  workspaceId: string;
  isNew: boolean;
}> {
  const store = await cookies();
  const existing = store.get(WORKSPACE_COOKIE)?.value;
  if (existing && /^ws_[a-zA-Z0-9_-]{6,40}$/.test(existing)) {
    return { workspaceId: existing, isNew: false };
  }
  const fresh = `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return { workspaceId: fresh, isNew: true };
}

export function attachWorkspaceCookie<T extends Response>(
  response: T,
  workspaceId: string,
  isNew: boolean
): T {
  if (isNew) {
    response.headers.append(
      'Set-Cookie',
      `${WORKSPACE_COOKIE}=${workspaceId}; Path=/; Max-Age=2592000; SameSite=Lax; HttpOnly`
    );
  }
  return response;
}
