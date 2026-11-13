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
  // A quoted amount is required; it checks numeric consistency, NOT truthfulness of OCR.
  // Caller must still show the original image and require user confirmation.
  const quotedAmounts: string[] = Array.from((result.amountEvidence || '').match(/(?<![\d.,])\d+(?:,\d{3})*(?:\.\d{1,2})?(?![\d.,])/g) || []);
  const evidenceMatches = quotedAmounts.some(value => {
    const [yuan, decimal = ''] = value.replaceAll(',', '').split('.');
    return Number(yuan) * 100 + Number(decimal.padEnd(2, '0')) === result.amountCents;
  });
  if (raw.currency !== 'CNY' || result.amountSource === 'unknown' || !result.amountEvidence || !evidenceMatches) {
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
