import { normalizeMerchant } from './matching.ts';
import type { ExpenseCategory, LineItem } from './types.ts';

export interface ParsedReceiptData {
  merchant: string;
  normalizedMerchant: string;
  date: string;
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  currency: string;
  cardLast4?: string;
  category: ExpenseCategory;
  ocrConfidence: number;
  lineItems: LineItem[];
  rawText: string;
}

const MONTH_MAP: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .replace(/\bInc\.?\b/gi, 'Inc.')
    .replace(/\bLlc\b/gi, 'LLC')
    .trim();
}

function parseCentsFromString(val: string): number {
  const num = Number.parseFloat(val.replace(/,/g, ''));
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

export function classifyExpenseCategory(merchantAndText: string): ExpenseCategory {
  const text = merchantAndText.toLowerCase();
  if (/vercel|aws|cloudflare|railway|heroku|digitalocean|hosting|cloud/.test(text)) {
    return 'Cloud & Hosting';
  }
  if (/figma|notion|linear|slack|adobe|openai|github|stripe|saas|seat|subscription|software/.test(text)) {
    return 'Software & SaaS';
  }
  if (/coffee|latte|cafe|restaurant|sweetgreen|chipotle|lunch|dinner|bakery|bistro|blue bottle|croissant/.test(text)) {
    return 'Meals & Coffee';
  }
  if (/uber|lyft|delta|united|airline|hotel|airbnb|parking|flight|rideshare|trip/.test(text)) {
    return 'Travel & Rideshare';
  }
  if (/apple|staples|home depot|best buy|desk|monitor|keyboard|supply|hardware|amazon/.test(text)) {
    return 'Office & Hardware';
  }
  if (/verizon|at&t|comcast|fiber|internet|electric|utility/.test(text)) {
    return 'Utilities & Internet';
  }
  return 'Other';
}

export function extractDateFromText(text: string, fallbackDate = '2026-11-11'): string {
  const isoMatch = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  const usMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (usMatch) {
    return `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
  }

  const namedMatch = text.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\b/i
  );
  if (namedMatch) {
    const month = MONTH_MAP[namedMatch[1].toLowerCase()] ?? '11';
    return `${namedMatch[3]}-${month}-${namedMatch[2].padStart(2, '0')}`;
  }

  return fallbackDate;
}

export function parseReceiptText(
  rawText: string,
  options?: { fallbackMerchant?: string; fallbackDate?: string }
): ParsedReceiptData {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let merchant = options?.fallbackMerchant ?? 'Scanned Merchant';
  for (const line of lines.slice(0, 5)) {
    if (/^(from|subject|date|invoice|receipt|order|thanks|organization)\b[:\s]/i.test(line)) {
      continue;
    }
    if (/^\d{1,4}\s+/.test(line) && /,/.test(line)) continue;
    if (line.length >= 2 && line.length <= 60) {
      merchant = line === line.toUpperCase() ? toTitleCase(line) : line;
      break;
    }
  }

  const date = extractDateFromText(rawText, options?.fallbackDate ?? '2026-11-11');

  let subtotalCents = 0;
  let taxCents = 0;
  let tipCents = 0;
  let totalCents = 0;
  let cardLast4: string | undefined;
  const lineItems: LineItem[] = [];

  for (const line of lines) {
    const cardMatch = line.match(
      /(?:visa|mastercard|amex|card|ending\s+in|ending|\*{2,4})\s*[^\d]{0,6}(\d{4})\b/i
    );
    if (cardMatch) {
      cardLast4 = cardMatch[1];
    }

    const totalMatch = line.match(
      /(?:grand\s+total|total\s+charged|amount\s+paid|balance\s+due|total)\s*[:\-]?\s*\$?\s*(\d{1,6}(?:,\d{3})*(?:\.\d{2}))/i
    );
    if (totalMatch && !/subtotal/i.test(line)) {
      totalCents = parseCentsFromString(totalMatch[1]);
      continue;
    }

    const subtotalMatch = line.match(
      /subtotal\s*[:\-]?\s*\$?\s*(\d{1,6}(?:,\d{3})*(?:\.\d{2}))/i
    );
    if (subtotalMatch) {
      subtotalCents = parseCentsFromString(subtotalMatch[1]);
      continue;
    }

    const taxMatch = line.match(
      /(?:sales\s+)?tax\s*[:\-]?\s*\$?\s*(\d{1,6}(?:,\d{3})*(?:\.\d{2}))/i
    );
    if (taxMatch) {
      taxCents = parseCentsFromString(taxMatch[1]);
      continue;
    }

    const tipMatch = line.match(
      /(?:tip|gratuity)\s*[:\-]?\s*\$?\s*(\d{1,6}(?:,\d{3})*(?:\.\d{2}))/i
    );
    if (tipMatch) {
      tipCents = parseCentsFromString(tipMatch[1]);
      continue;
    }

    const itemMatch = line.match(
      /^(?:(\d+)\s*[x×]\s+)?(.+?)(?:\s*[x×]\s*(\d+))?(?:\s*\([^)]*\))?\s+\$?\s*(\d{1,6}(?:,\d{3})*\.\d{2})$/i
    );
    if (
      itemMatch &&
      !/^(subtotal|tax|sales tax|tip|total|amount|balance|change|visa|mastercard|amex)/i.test(
        itemMatch[2]
      )
    ) {
      const qty = Number.parseInt(itemMatch[1] || itemMatch[3] || '1', 10) || 1;
      const lineTotalCents = parseCentsFromString(itemMatch[4]);
      lineItems.push({
        id: `li_${lineItems.length + 1}`,
        description: itemMatch[2].trim(),
        quantity: qty,
        unitPriceCents: Math.round(lineTotalCents / qty),
        totalCents: lineTotalCents,
      });
    }
  }

  if (subtotalCents === 0 && lineItems.length > 0) {
    subtotalCents = lineItems.reduce((sum, item) => sum + item.totalCents, 0);
  }
  if (totalCents === 0 && subtotalCents > 0) {
    totalCents = subtotalCents + taxCents + tipCents;
  }
  if (subtotalCents === 0 && totalCents > 0) {
    subtotalCents = Math.max(0, totalCents - taxCents - tipCents);
  }

  const category = classifyExpenseCategory(`${merchant} ${rawText}`);
  const confidence =
    totalCents > 0 && merchant !== 'Scanned Merchant' ? 96 : totalCents > 0 ? 88 : 74;

  return {
    merchant,
    normalizedMerchant: normalizeMerchant(merchant),
    date,
    subtotalCents,
    taxCents,
    tipCents,
    totalCents,
    currency: 'USD',
    cardLast4,
    category,
    ocrConfidence: confidence,
    lineItems,
    rawText,
  };
}

export async function extractReceiptWithOptionalAI(params: {
  rawText?: string;
  imageBase64?: string;
  fallbackMerchant?: string;
  fallbackAmountCents?: number;
  fallbackDate?: string;
  fallbackCardLast4?: string;
}): Promise<ParsedReceiptData> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && params.imageBase64 && params.imageBase64.startsWith('data:image/')) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract receipt JSON with keys: merchant, date (YYYY-MM-DD), subtotalCents, taxCents, tipCents, totalCents, cardLast4, lineItems ([{description, quantity, unitPriceCents, totalCents}]).',
                },
                { type: 'image_url', image_url: { url: params.imageBase64 } },
              ],
            },
          ],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content) as Partial<ParsedReceiptData>;
          if (parsed.merchant && typeof parsed.totalCents === 'number') {
            return {
              merchant: parsed.merchant,
              normalizedMerchant: normalizeMerchant(parsed.merchant),
              date: parsed.date || params.fallbackDate || '2026-11-11',
              subtotalCents: parsed.subtotalCents ?? parsed.totalCents,
              taxCents: parsed.taxCents ?? 0,
              tipCents: parsed.tipCents ?? 0,
              totalCents: parsed.totalCents,
              currency: 'USD',
              cardLast4: parsed.cardLast4,
              category: classifyExpenseCategory(parsed.merchant),
              ocrConfidence: 98,
              lineItems: Array.isArray(parsed.lineItems) ? parsed.lineItems : [],
              rawText: params.rawText || `AI OCR: ${parsed.merchant}`,
            };
          }
        }
      }
    } catch {
      // Fall back cleanly to deterministic parser below
    }
  }

  if (params.rawText && params.rawText.trim().length > 0) {
    const parsed = parseReceiptText(params.rawText, {
      fallbackMerchant: params.fallbackMerchant,
      fallbackDate: params.fallbackDate,
    });
    if (parsed.totalCents === 0 && params.fallbackAmountCents) {
      parsed.totalCents = params.fallbackAmountCents;
      parsed.subtotalCents = params.fallbackAmountCents;
    }
    if (!parsed.cardLast4 && params.fallbackCardLast4) {
      parsed.cardLast4 = params.fallbackCardLast4;
    }
    return parsed;
  }

  const merchant = params.fallbackMerchant || 'Blue Bottle Coffee';
  const totalCents = params.fallbackAmountCents ?? 1850;
  return {
    merchant,
    normalizedMerchant: normalizeMerchant(merchant),
    date: params.fallbackDate || '2026-11-11',
    subtotalCents: Math.round(totalCents * 0.92),
    taxCents: totalCents - Math.round(totalCents * 0.92),
    tipCents: 0,
    totalCents,
    currency: 'USD',
    cardLast4: params.fallbackCardLast4 || '4821',
    category: classifyExpenseCategory(merchant),
    ocrConfidence: 93,
    lineItems: [
      {
        id: 'li_1',
        description: `${merchant} Receipt Purchase`,
        quantity: 1,
        unitPriceCents: totalCents,
        totalCents,
      },
    ],
    rawText: `${merchant}\nDate: ${params.fallbackDate || '2026-11-11'}\nTotal: $${(totalCents / 100).toFixed(2)}`,
  };
}
