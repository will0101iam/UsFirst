import { z } from 'zod';
import type { IPicture } from './oa-types';

// Shared result validation. Production uses the authenticated same-origin Worker recognizer.
export type RecognitionState = 'idle' | 'reading' | 'ready' | 'failed' | 'unavailable';
export type ImageRecognizer = (photos: readonly IPicture[], signal: AbortSignal) => Promise<unknown>;
const titleSchema = z.string().trim().min(1).max(60).nullable();
const amountSchema = z.number().int().positive().max(99999999).nullable();
const categorySchema = z.enum(['网购', '外卖', '其他']).nullable();
const sourceSchema = z.enum(['payable', 'listed', 'unknown']);
const evidenceSchema = z.string().trim().min(1).max(80).nullable();
const candidateSchema = z.object({
  amountCents: z.number().int().positive().max(99999999),
  currency: z.literal('CNY'),
  kind: z.enum(['payable', 'listed', 'discounted', 'range', 'starting']),
  amountEvidence: z.string().trim().min(1).max(80),
});
function quotedCents(evidence: string): number[] {
  return Array.from(evidence.match(/(?<![\d.,])\d+(?:,\d{3})*(?:\.\d{1,2})?(?![\d.,])/g) || []).map(value => {
    const [yuan, decimal = ''] = value.replaceAll(',', '').split('.');
    return Number(yuan) * 100 + Number(decimal.padEnd(2, '0'));
  });
}
function minimumPurchasePrice(input: unknown) {
  if (!Array.isArray(input) || input.length > 8) return null;
  const valid = input.flatMap(value => {
    const parsed = candidateSchema.safeParse(value);
    if (!parsed.success) return [];
    const price = parsed.data;
    // Defense in depth; OCR/context classification is still probabilistic.
    if (/(划线|原价|参考价|分期|每期|月供|首付|定金|订金|运费|配送费|优惠券|优惠额|减免|立减|满\s*\d.*减)/.test(price.amountEvidence)) return [];
    const amounts = quotedCents(price.amountEvidence);
    if (!amounts.includes(price.amountCents)) return [];
    if (price.kind === 'range' && (amounts.length !== 2 || price.amountCents !== Math.min(...amounts))) return [];
    return [price];
  });
  return valid.reduce<(typeof valid)[number] | null>((lowest, price) => !lowest || price.amountCents < lowest.amountCents ? price : lowest, null);
}
export interface ImageRecognitionResult {
  title: string | null;
  amountCents: number | null;
  currency: 'CNY';
  category: '网购' | '外卖' | '其他' | null;
  amountSource: 'payable' | 'listed' | 'unknown';
  amountEvidence: string | null;
  warnings: string[];
}
export function parseRecognitionResult(input: unknown): ImageRecognitionResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('识别返回不是有效对象。');
  const raw = input as Record<string, unknown>;
  const warnings: string[] = [];
  // Only keep bounded text warnings. Never render them as HTML.
  if (Array.isArray(raw.warnings)) for (const warning of raw.warnings) {
    if (typeof warning === 'string' && warning.trim()) warnings.push(warning.trim().slice(0, 120));
    if (warnings.length === 3) break;
  }
  const title = titleSchema.safeParse(raw.title);
  const category = categorySchema.safeParse(raw.category);
  const amount = amountSchema.safeParse(raw.amountCents);
  const source = sourceSchema.safeParse(raw.amountSource);
  const evidence = evidenceSchema.safeParse(raw.amountEvidence);
  const result: ImageRecognitionResult = {
    title: title.success ? title.data : null,
    category: category.success ? category.data : null,
    amountCents: amount.success ? amount.data : null,
    amountSource: source.success ? source.data : 'unknown',
    amountEvidence: evidence.success ? evidence.data : null,
    currency: 'CNY', warnings,
  };
  if (Object.hasOwn(raw, 'priceCandidates')) {
    const lowest = minimumPurchasePrice(raw.priceCandidates);
    result.amountCents = lowest?.amountCents ?? null;
    result.amountSource = lowest ? lowest.kind === 'payable' ? 'payable' : 'listed' : 'unknown';
    result.amountEvidence = lowest?.amountEvidence ?? null;
    if (lowest) result.warnings.push('已取图片最低购买价，请核对规格和优惠条件。');
  }
  // Legacy fields remain accepted for already-normalized API responses in the client.
  // A quoted amount is required; it checks numeric consistency, NOT truthfulness of OCR.
  // Caller must still show the original image and require user confirmation.
  const evidenceMatches = quotedCents(result.amountEvidence || '').includes(result.amountCents ?? -1);
  if ((!Object.hasOwn(raw, 'priceCandidates') && raw.currency !== 'CNY') || result.amountSource === 'unknown' || !result.amountEvidence || !evidenceMatches) {
    result.amountCents = null;
  }
  if (result.amountCents === null) {
    result.amountSource = 'unknown'; result.amountEvidence = null;
    result.warnings.push('金额未确定，请手动填写。');
  } else if (result.amountSource === 'listed') {
    result.warnings.push('商品现价可能不含运费，请核对应付金额。');
  }
  if (result.title === null) result.warnings.push('商品名称未确定，请手动填写。');
  result.warnings = [...new Set(result.warnings)].slice(0, 8);
  return result;
}
