import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'snapledger',
    storage: process.env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : 'memory',
    plaidMode: process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET ? 'live' : 'sandbox',
    ocrMode: process.env.OPENAI_API_KEY ? 'vision-ai' : 'deterministic-ocr',
    timestamp: new Date().toISOString(),
  });
}
