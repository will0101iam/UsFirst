// EXPORTS: Person, Category, Status, IRequest{id,applicant,title,amountCents,category,reason,photos,status,createdAt,decidedAt,decisionNote,purchasedAt,sample}, IRequestInput{title,amountCents,category,reason,photos}, IPicture{dataUrl,name}
export type Person = 'me' | 'partner';
export type Category = '网购' | '外卖' | '其他';
export type Status = 'pending' | 'approved' | 'rejected' | 'purchased' | 'cancelled';
export interface IPicture { dataUrl: string; name: string }
export interface IRequestInput {
  title: string; amountCents: number; category: Category; reason: string; photos: IPicture[];
}
export interface IRequest extends IRequestInput {
  id: string; applicant: Person; status: Status; createdAt: string;
  decidedAt?: string; decisionNote?: string; purchasedAt?: string; sample?: boolean;
}
export const people: Record<Person, string> = { me: '我', partner: '女朋友' };
export const otherPerson = (person: Person): Person => person === 'me' ? 'partner' : 'me';
export const categories: Category[] = ['网购', '外卖', '其他'];
export const statusLabels: Record<Status, string> = {
  pending: '待审批', approved: '已通过 · 可购买', rejected: '未通过', purchased: '已购买', cancelled: '已撤回',
};
export function money(cents: number) { return (cents / 100).toFixed(2); }
export function timeLabel(iso: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
export const sampleRequests: IRequest[] = [
  { id: 'sample-1', applicant: 'partner', title: '今晚的双人晚餐', amountCents: 8600, category: '外卖', reason: '想点我们都喜欢的那家日料，一人一份。', photos: [], status: 'pending', createdAt: '2026-11-13T10:15:00+08:00', sample: true },
  { id: 'sample-2', applicant: 'me', title: '一件冬天穿的毛衣', amountCents: 26900, category: '网购', reason: '衣柜里缺一件厚一点的毛衣，想买这件。', photos: [], status: 'pending', createdAt: '2026-11-13T09:30:00+08:00', sample: true },
  { id: 'sample-3', applicant: 'me', title: '周末一起看电影', amountCents: 9800, category: '其他', reason: '两张电影票。', photos: [], status: 'approved', createdAt: '2026-11-12T19:00:00+08:00', decidedAt: '2026-11-12T19:10:00+08:00', decisionNote: '好呀，一起去。', sample: true },
];
