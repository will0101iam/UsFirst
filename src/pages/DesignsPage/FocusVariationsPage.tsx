import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Maximize2, RotateCcw, X, ArrowUpRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import IosFrame from '@/components/IosFrame';
import DemoPhone from './DemoPhone';
import type { DemoScreen } from './design-data';
import './designs.css';
import './focus-variations.css';

const concepts = [
  { id:'electric', code:'C1', title:'电光蓝 × 酸柠', subtitle:'高饱和，有行动感', description:'大面积电光蓝，酸柠金额与主按钮。方切申请票据，清晰、鲜明，不靠渐变发光。', colors:['#1741e8','#cbef58','#f4f7ff'], background:'#1741e8', dark:true },
  { id:'vermilion', code:'C2', title:'朱红 × 纸白', subtitle:'有力度，也有留白', description:'红色外场、纸白申请单、黑色大金额。像一张醒目的消费凭证，按钮回归明确的红白对比。', colors:['#e23f32','#fffdf5','#25211e'], background:'#e23f32', dark:true },
  { id:'berry', code:'C3', title:'莓粉 × 青柠', subtitle:'大胆、亲密，不甜腻', description:'深莓色底与亮粉色申请面，青柠主行动。饱满圆角配轻微实底按压，和日常 OA 拉开距离。', colors:['#551e42','#f5aed2','#d6f56a'], background:'#551e42', dark:true },
  { id:'glacier', code:'C4', title:'冰川青 × 深海', subtitle:'清透、冷静，更适合常用', description:'冰川青底，白色内容面，深海色大数字。保留 C 的聚焦感，但整体明亮，主按钮有足够存在感。', colors:['#c1eee6','#ffffff','#123d48'], background:'#c1eee6', dark:false },
] as const;
type ConceptId = typeof concepts[number]['id'];
const scenarios: { id:DemoScreen; label:string }[] = [{id:'home',label:'首页审批'},{id:'new',label:'填写申请'},{id:'detail',label:'申请详情'}];
export default function FocusVariationsPage() {
  const [scenario,setScenario] = useState<DemoScreen>('home');
  const [generation,setGeneration] = useState(0);
  const [filter,setFilter] = useState<ConceptId | 'all'>('all');
  const [expanded,setExpanded] = useState<ConceptId | null>(null);
  const [preferred,setPreferred] = useState<ConceptId | null>(null);
  const expandedConcept = concepts.find(item => item.id === expanded);
  return <main className="design-gallery focus-gallery">
    <header className="gallery-heading"><div><Link to="/designs" className="gallery-back"><ArrowLeft size={15}/>返回上一轮 A / B / C</Link><span className="gallery-eyebrow">一起花 / C 的视觉延展</span><h1>喜欢的操作留下。<br/>颜色，再大胆一点。</h1><p>四套都保留 C 的聚焦审批、金额优先与底部直接决定。可点开完整体验。</p></div><span className="gallery-version">02 / 四套大胆视觉</span></header>
    <div className="gallery-tools"><div className="gallery-scenarios" aria-label="统一预览场景">{scenarios.map(item => <button key={item.id} className={scenario === item.id ? 'active' : ''} aria-pressed={scenario === item.id} onClick={() => { setScenario(item.id); setGeneration(previous => previous + 1); }}>{item.label}</button>)}</div><button className="gallery-reset" onClick={() => setGeneration(previous => previous + 1)}><RotateCcw size={15}/>重置演示</button></div>
    <nav className="concept-selector" aria-label="选择配色方案"><button aria-pressed={filter === 'all'} className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>全部比较</button>{concepts.map(item => <button key={item.id} className={filter === item.id ? 'active' : ''} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}><i style={{ background:item.colors[0] }}/>{item.code}</button>)}</nav>
    <div className={`focus-concepts-grid ${filter !== 'all' ? 'single-concept' : ''}`}>
      {concepts.filter(item => filter === 'all' || filter === item.id).map(item => <section key={item.id} className={`design-option focus-concept concept-${item.id}`}>
        <header className="option-heading"><span>{item.code}</span><div><h2>{item.title}</h2><p>{item.subtitle}</p></div><button onClick={() => setExpanded(item.id)} aria-label={`放大${item.code}`}><Maximize2 size={18}/></button></header>
        <div className="gallery-phone-stage"><div className="gallery-phone-scale"><IosFrame darkMode={item.dark} screenBackground={item.background}><DemoPhone key={`${item.id}-${scenario}-${generation}`} variant="focus" initial={scenario}/></IosFrame></div></div>
        <div className="option-description"><p>{item.description}</p><div className="option-bottom"><div className="palette-swatches" aria-label={`${item.code}配色`}>{item.colors.map(color => <i key={color} style={{ background:color }}/>)}</div><button className={preferred === item.id ? 'chosen' : ''} onClick={() => setPreferred(item.id)}>{preferred === item.id ? <><Check size={15}/>已标记 {item.code}</> : <>喜欢 {item.code}<ArrowUpRight size={15}/></>}</button></div></div>
      </section>)}
    </div>
    <footer className="gallery-footer"><p>{preferred ? `已标记 ${concepts.find(item => item.id === preferred)?.code} 为本页偏好，还未应用到原型。` : '先试同意购买，再看看填写申请。选喜欢的 C1 / C2 / C3 / C4 即可。'}</p><small>四套均为独立内存演示；不更改旧方案或真实申请。照片识别、账号登录与双手机同步仍未接入。</small></footer>
    <Dialog open={!!expandedConcept} onOpenChange={open => { if (!open) setExpanded(null); }}><DialogContent className={`design-expanded focus-concept concept-${expandedConcept?.id ?? 'electric'}`} showCloseButton={false}><DialogTitle className="sr-only">{expandedConcept?.code} 单独体验</DialogTitle><DialogDescription className="sr-only">仅示例数据，可体验申请和审批。</DialogDescription><button className="expanded-close" onClick={() => setExpanded(null)} aria-label="关闭放大预览"><X size={20}/></button>{expandedConcept && <DemoPhone key={`${expandedConcept.id}-${scenario}-${generation}-expanded`} variant="focus" initial={scenario}/>}</DialogContent></Dialog>
  </main>;
}
