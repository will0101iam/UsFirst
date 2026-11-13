import { useState, useId } from 'react';
import { Camera, ImagePlus, X, ArrowRight, LoaderCircle } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { preparePhoto } from '@/lib/oa-storage';
import { categories } from '@/lib/oa-types';
import type { Category, IPicture, IRequestInput } from '@/lib/oa-types';
interface DemoFormProps { onCreate(input: IRequestInput): void }
export default function DemoForm({ onCreate }: DemoFormProps) {
  const id = useId();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('网购');
  const [reason, setReason] = useState('');
  const [photos, setPhotos] = useState<IPicture[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function photoChange(files: FileList | null) {
    if (!files?.length || busy) return;
    setError('');
    if (photos.length + files.length > 3) { setError('最多添加 3 张照片'); return; }
    setBusy(true);
    try { const added = await Promise.all(Array.from(files).map(preparePhoto)); setPhotos(previous => [...previous, ...added]); }
    catch (error) { setError(error instanceof Error ? error.message : '照片读取失败'); }
    finally { setBusy(false); }
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('先写一下想买什么'); return; }
    if (!/^\d{1,6}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) { setError('填写大于 0 的金额，最多两位小数'); return; }
    const [yuan, decimal = ''] = amount.split('.');
    onCreate({ title:title.trim(), amountCents:Number(yuan) * 100 + Number(decimal.padEnd(2,'0')), category, reason:reason.trim(), photos });
  }
  return <form className="demo-form" onSubmit={submit} noValidate>
    <div className="demo-form-fields"><label htmlFor={`${id}-title`}>想买什么</label><input id={`${id}-title`} value={title} onChange={e => setTitle(e.target.value)} placeholder="一件毛衣，或今晚的晚餐" maxLength={60} autoComplete="off"/>
      <label htmlFor={`${id}-amount`}>预计金额</label><div className="demo-amount-input"><span>¥</span><input id={`${id}-amount`} value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" autoComplete="off"/></div>
      <div className="demo-categories" aria-label="消费类别">{categories.map(value => <button type="button" key={value} aria-pressed={category === value} className={category === value ? 'selected' : ''} onClick={() => setCategory(value)}>{value}</button>)}</div>
      <div className="demo-field-line"><span>照片</span><small>选填 · {photos.length} / 3</small></div>
      {photos.length > 0 && <div className="demo-photo-grid">{photos.map((photo,i) => <div key={`${photo.name}-${i}`}><Image src={photo.dataUrl} alt={`申请照片 ${i + 1}`}/><button type="button" className="demo-remove-photo" aria-label={`删除照片 ${i + 1}`} onClick={() => setPhotos(previous => previous.filter((_,index) => index !== i))}><X size={14}/></button></div>)}</div>}
      <div className="demo-photo-actions"><label><Camera size={18}/>拍照<input type="file" accept="image/*" capture="environment" disabled={busy || photos.length >= 3} onChange={e => { void photoChange(e.target.files); e.target.value = ''; }}/></label><label>{busy ? <LoaderCircle size={18} className="animate-spin"/> : <ImagePlus size={18}/>}上传照片<input type="file" accept="image/*" multiple disabled={busy || photos.length >= 3} onChange={e => { void photoChange(e.target.files); e.target.value = ''; }}/></label></div>
      <p className="demo-ai-note">自动填单待接入，当前手动填写。</p>
      <label htmlFor={`${id}-reason`}>理由 <small>选填</small></label><textarea id={`${id}-reason`} value={reason} onChange={e => setReason(e.target.value)} placeholder="一句就好。" rows={2} maxLength={300}/>
    </div>
    <div className="demo-form-footer">{error && <p className="demo-error" role="alert">{error}</p>}<button type="submit" className="demo-primary" disabled={busy}>交给对方审批<ArrowRight size={18}/></button><small>仅示例演示 · 不会真实下单</small></div>
  </form>;
}
