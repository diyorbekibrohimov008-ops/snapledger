import { NextResponse } from 'next/server';
import { formatQuickBooksCsv, formatXeroCsv } from '@/lib/export';
import { loadWorkspace, saveWorkspace } from '@/lib/store';
import { getOrCreateWorkspaceId } from '@/lib/workspace-cookie';

export async function GET(req: Request) {
  const { workspaceId } = await getOrCreateWorkspaceId();
  const state = await loadWorkspace(workspaceId);
  const url = new URL(req.url);
  const format = url.searchParams.get('format') || 'quickbooks';

  if (format === 'xero') {
    const csv = formatXeroCsv(state);
    await saveWorkspace({
      ...state,
      accounting: state.accounting.map((a) =>
        a.provider === 'xero' ? { ...a, lastExportAt: new Date().toISOString() } : a
      ),
    });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="snapledger-xero-export.csv"',
      },
    });
  }

  if (format === 'json') {
    return new NextResponse(JSON.stringify(state, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="snapledger-audit-pack.json"',
      },
    });
  }

  const csv = formatQuickBooksCsv(state);
  await saveWorkspace({
    ...state,
    accounting: state.accounting.map((a) =>
      a.provider === 'quickbooks'
        ? { ...a, lastExportAt: new Date().toISOString() }
        : a
    ),
  });
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="snapledger-quickbooks-export.csv"',
    },
  });
}
