import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, ImagePlus, X, LoaderCircle, ArrowRight, Plus, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Image } from '@/components/ui/image';
import AppSheet from '@/components/AppSheet';
import { categories, people, otherPerson } from '@/lib/oa-types';
import type { IRequestInput, IPicture, Person } from '@/lib/oa-types';
import { preparePhoto } from '@/lib/oa-storage';
import { parseRecognitionResult } from '@/lib/image-recognition-contract';
import { recognitionConfig } from '@/lib/recognition-config';
import { ApiError } from '@/lib/api';
import type { ImageRecognizer, RecognitionState } from '@/lib/image-recognition-contract';

const schema = z.object({
  title: z.string().trim().min(1, '写一下想买什么').max(60, '最多 60 个字'),
  amount: z.string().regex(/^\d{1,6}(\.\d{1,2})?$/, '填写正数金额，最多两位小数').refine(v => Number(v) > 0, '金额需要大于 0'),
  category: z.enum(['网购', '外卖', '其他', '']).superRefine((value, context) => { if (value === '') context.addIssue({ code: 'custom', message: '请选择消费类型' }); }), reason: z.string().trim().max(300, '最多 300 个字'),
});
type FormValues = z.infer<typeof schema>;
interface RequestFormProps { open: boolean; person: Person; onClose(): void; onCreate(input: IRequestInput): Promise<void>; recognize?: ImageRecognizer; partnerName?: string }
// Each open is a fresh form session. Returning to image selection stays in this session.
export default function RequestForm(props: RequestFormProps) {
  return props.open ? <RequestFormSession {...props}/> : null;
}
function RequestFormSession({ open, person, onClose, onCreate, recognize, partnerName }: RequestFormProps) {
  const [stage, setStage] = useState<'entry' | 'confirm'>('entry');
  const [photos, setPhotos] = useState<IPicture[]>([]);
  const [processing, setProcessing] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [recognition, setRecognition] = useState<RecognitionState>('idle');
  const [recognitionNote, setRecognitionNote] = useState('');
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const { register, handleSubmit, reset, setValue, getValues, getFieldState, control, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema), defaultValues: { title: '', amount: '', category: '网购', reason: '' },
  });
  const category = useWatch({ control, name: 'category' });
  const busy = processing || recognition === 'reading' || isSubmitting;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  async function readPhotos(next: IPicture[]) {
    if (!recognize) {
      setRecognition('unavailable'); setRecognitionNote('自动识别尚未配置，请手动填写名称和金额。'); return;
    }
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    setRecognition('reading'); setRecognitionNote('正在识别图片，请稍候…');
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; abort.abort(); }, recognitionConfig.timeoutMs);
    const cancelled = new Promise<never>((_, reject) => {
      abort.signal.addEventListener('abort', () => reject(new DOMException('已停止识别', 'AbortError')), { once: true });
    });
    try {
      const result = parseRecognitionResult(await Promise.race([recognize(next, abort.signal), cancelled]));
      if (abort.signal.aborted || !mounted.current) return;
      // Fill only empty fields: never overwrite user edits, invent a price or submit.
      if (!getValues('title').trim() && result.title) setValue('title', result.title, { shouldValidate: true });
      if (!getValues('amount') && result.amountCents !== null) setValue('amount', (result.amountCents / 100).toFixed(2), { shouldValidate: true });
      if (!getFieldState('category').isDirty) setValue('category', result.category || '', { shouldValidate: true });
      setRecognition('ready');
      setRecognitionNote(['请核对名称和金额。', ...result.warnings].join(' '));
    } catch (error) {
      if (abort.signal.aborted && !timedOut) return;
      setRecognition('failed');
      setRecognitionNote(timedOut ? '识别超时，请重试或手动填写。' : error instanceof ApiError ? error.message : error instanceof TypeError ? '网络连接失败，请检查网络后重试。' : '识别结果无法解析，请重试或手动填写。');
    } finally {
      window.clearTimeout(timeout);
      if (controller.current === abort) controller.current = null;
    }
  }
  async function addPhotos(files: FileList | null) {
    if (!files?.length || busy) return;
    if (files.length + photos.length > 3) { toast.error('最多 3 张照片，请减少后再试。'); return; }
    setProcessing(true);
    try {
      const added = await Promise.all(Array.from(files).map(preparePhoto));
      if (!mounted.current) return;
      const next = [...photos, ...added]; setPhotos(next); setStage('confirm');
      if (!getFieldState('category').isDirty) setValue('category', '');
      await readPhotos(next);
    } catch (error) { if (mounted.current) toast.error(error instanceof Error ? error.message : '照片读取失败。'); }
    finally { if (mounted.current) { setProcessing(false); if (camera.current) camera.current.value = ''; if (gallery.current) gallery.current.value = ''; } }
  }
  async function submit(values: FormValues) {
    if (!values.category) return;
    const [yuan, decimals = ''] = values.amount.split('.');
    try {
      await onCreate({ title: values.title, amountCents: Number(yuan) * 100 + Number(decimals.padEnd(2, '0')), category: values.category, reason: values.reason, photos });
      reset(); setPhotos([]); setReasonOpen(false); setRecognition('idle'); setRecognitionNote(''); setStage('entry'); onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : '保存失败，请重试。'); }
  }
  function close() { if (!busy) onClose(); }
  function cancelReading() { controller.current?.abort(); setRecognition('failed'); setRecognitionNote('已停止识别，可手动填写。'); }
  return <AppSheet open={open} onClose={close} busy={busy} title={stage === 'entry' ? '这次想买什么？' : '确认这笔申请'} description={stage === 'entry' ? '拍一张或选张截图，再交给对方。' : `核对后交给${partnerName || people[otherPerson(person)]}审批。`} footer={stage === 'confirm' ? <>
    <Button type="submit" form="purchase-form" className="primary-action press-button" disabled={busy}>{isSubmitting ? <LoaderCircle size={18} className="animate-spin"/> : null}交给对方审批<ArrowRight size={18}/></Button>
  </> : undefined}>
    <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => void addPhotos(e.target.files)}/>
    <input ref={gallery} type="file" accept="image/*" multiple className="hidden" onChange={e => void addPhotos(e.target.files)}/>
    {stage === 'entry' ? <div className="capture-entry"><div className="capture-options"><button onClick={() => camera.current?.click()} disabled={busy}><Camera size={28} strokeWidth={1.6}/><strong>拍照</strong><span>拍下想买的东西</span></button><button onClick={() => gallery.current?.click()} disabled={busy}><ImagePlus size={28} strokeWidth={1.6}/><strong>上传图片</strong><span>商品、购物车或订单截图</span></button></div>
      {processing && <p className="capture-loading" role="status"><LoaderCircle size={17} className="animate-spin"/>正在处理照片…</p>}
      <button className="capture-manual" onClick={() => setStage('confirm')} disabled={busy}>手动填写<ArrowRight size={16}/></button>
      {recognize && <p className="capture-privacy">选择图片会发送给 OpenRouter · Qwen3.7 Flash 识别，核对后再提交。</p>}
    </div> : <form id="purchase-form" onSubmit={handleSubmit(submit)} noValidate className="minimal-form">
      <button type="button" className="capture-back" onClick={() => setStage('entry')} disabled={busy}><ArrowLeft size={15}/>返回图片选择</button>
      {photos.length > 0 && <section className="photo-field"><div className="field-heading"><span>申请图片</span><small>{photos.length} / 3</small></div><div className="photo-grid">{photos.map((photo, index) => <div key={`${photo.name}-${index}`} className="relative"><Image src={photo.dataUrl} alt={`申请照片 ${index + 1}`} className="photo-thumb"/><button type="button" className="remove-photo" aria-label={`删除照片 ${index + 1}`} disabled={busy} onClick={() => { setPhotos(previous => previous.filter((_, i) => i !== index)); setRecognition('idle'); setRecognitionNote('图片已移除，请重新核对名称和金额。'); }}><span><X size={13}/></span></button></div>)}</div>
        <div className="recognition-message" role="status">{recognition === 'reading' && <LoaderCircle size={16} className="animate-spin"/>}<span>{recognitionNote}</span></div>
        {recognition === 'reading' && <button type="button" className="capture-manual" onClick={cancelReading}>停止识别，手动填写</button>}
        {recognition === 'failed' && recognize && <button type="button" className="capture-manual" onClick={() => void readPhotos(photos)}>重新识别</button>}
      </section>}
      <div className="title-field"><label htmlFor="purchase-title">想买什么</label><input id="purchase-title" {...register('title')} placeholder="一件毛衣，或今晚的晚餐" maxLength={60} autoComplete="off" disabled={busy} aria-invalid={!!errors.title} aria-describedby={errors.title ? 'title-error' : undefined}/>{errors.title && <p id="title-error" className="field-error">{errors.title.message}</p>}</div>
      <div className="amount-field"><label htmlFor="purchase-amount">预计金额 · 人民币</label><div><span>¥</span><input id="purchase-amount" {...register('amount')} inputMode="decimal" placeholder="0.00" autoComplete="off" disabled={busy} aria-invalid={!!errors.amount} aria-describedby={errors.amount ? 'amount-error' : undefined}/></div>{errors.amount && <p id="amount-error" className="field-error">{errors.amount.message}</p>}</div>
      <fieldset className="category-options"><legend className="sr-only">消费类型</legend>{categories.map(value => <button type="button" key={value} aria-pressed={category === value} className={category === value ? 'selected' : ''} disabled={busy} onClick={() => setValue('category', value, { shouldDirty: true })}>{value}</button>)}</fieldset>{errors.category && <p className="field-error">{errors.category.message}</p>}
      <div className="photo-actions"><button type="button" onClick={() => camera.current?.click()} disabled={busy || photos.length >= 3}><Camera size={19}/>拍照</button><button type="button" onClick={() => gallery.current?.click()} disabled={busy || photos.length >= 3}>{processing ? <LoaderCircle size={19} className="animate-spin"/> : <ImagePlus size={19}/>}添加图片</button></div>
      <section className="reason-field">{!reasonOpen ? <button type="button" onClick={() => setReasonOpen(true)} className="add-reason"><Plus size={17}/>补充一句理由<span>选填</span></button> : <><label htmlFor="purchase-reason">补充理由 <small>选填</small></label><textarea id="purchase-reason" {...register('reason')} placeholder="为什么想买？一句就好。" maxLength={300} rows={2}/>{errors.reason && <p className="field-error">{errors.reason.message}</p>}</>}</section>
    </form>}
  </AppSheet>;
}
