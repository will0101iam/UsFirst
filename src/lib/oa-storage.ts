import { z } from 'zod';
import { sampleRequests } from './oa-types';
import type { IRequest, IPicture } from './oa-types';

const STORAGE_KEY = 'together-oa:requests:v1';
const pictureSchema = z.object({ name: z.string().max(255), dataUrl: z.string().regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/).max(1500000) });
const requestSchema = z.object({
  id: z.string().max(100), applicant: z.enum(['me', 'partner']), title: z.string().min(1).max(60),
  amountCents: z.number().int().positive().max(99999999), category: z.enum(['网购', '外卖', '其他']),
  reason: z.string().max(300), photos: z.array(pictureSchema).max(3),
  status: z.enum(['pending', 'approved', 'rejected', 'purchased', 'cancelled']),
  createdAt: z.string().datetime({ offset: true }), decidedAt: z.string().datetime({ offset: true }).optional(),
  decisionNote: z.string().max(200).optional(), purchasedAt: z.string().datetime({ offset: true }).optional(), sample: z.boolean().optional(),
});
export function loadRequests(): IRequest[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return structuredClone(sampleRequests);
    const parsed = z.array(requestSchema).safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : structuredClone(sampleRequests);
  } catch { return structuredClone(sampleRequests); }
}
export function saveRequests(requests: IRequest[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(requests)); }
  catch { throw new Error('当前浏览器无法保存，或照片占用过多空间。请减少照片后再试；申请尚未提交。'); }
}
export async function preparePhoto(file: File): Promise<IPicture> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) throw new Error('请选择 JPG、PNG、WebP 或 iPhone 照片，不支持其他文件。');
  if (file.size > 15 * 1024 * 1024) throw new Error('单张照片请小于 15 MB。');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => { throw new Error('这张照片暂时无法读取。请在 iPhone 中分享或导出为 JPG，再上传。'); });
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('照片处理失败，请换一张照片。');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
    if (dataUrl.length > 1500000) throw new Error('照片压缩后仍然过大，请换一张截图或较小的照片。');
    return { name: file.name.slice(0, 255), dataUrl };
  } finally { URL.revokeObjectURL(url); }
}
