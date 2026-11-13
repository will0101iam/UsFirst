import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, X, Maximize2, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import IosFrame from '@/components/IosFrame';
import DemoPhone from './DemoPhone';
import { designOptions } from './design-data';
import type { DemoScreen, Variant } from './design-data';
import './designs.css';
const scenarios: { id:DemoScreen; label:string }[] = [{id:'home',label:'首页待办'},{id:'new',label:'填写申请'},{id:'detail',label:'审批详情'}];
export default function DesignsPage() {
  const [scenario,setScenario] = useState<DemoScreen>('home');
  const [generation,setGeneration] = useState(0);
  const [expanded,setExpanded] = useState<Variant | null>(null);
  const [preferred,setPreferred] = useState<Variant | null>(null);
  const expandedOption = designOptions.find(option => option.id === expanded);
  return <main className="design-gallery">
    <header className="gallery-heading"><div><Link to="/" className="gallery-back"><ArrowLeft size={15}/>当前原型保持不变</Link><span className="gallery-eyebrow">一起花 / UI EXPLORATION</span><h1>不止换色。<br className="gallery-mobile-break"/>三种不同的使用感受。</h1><p>同样的消费申请，不同的布局与操作方式。每台手机都能点。</p></div><span className="gallery-version">01 / 设计探索</span></header>
    <div className="gallery-tools"><div className="gallery-scenarios" aria-label="统一预览场景">{scenarios.map(item => <button key={item.id} className={scenario === item.id ? 'active' : ''} aria-pressed={scenario === item.id} onClick={() => { setScenario(item.id); setGeneration(value => value + 1); }}>{item.label}</button>)}</div><button className="gallery-reset" onClick={() => setGeneration(value => value + 1)}><RotateCcw size={15}/>重置演示</button></div>
    <div className="gallery-track">{designOptions.map(option => <section key={option.id} className={`design-option option-${option.id}`}>
      <header className="option-heading"><span>{option.letter}</span><div><h2>{option.title}</h2><p>{option.caption}</p></div><button onClick={() => setExpanded(option.id)} aria-label={`放大${option.title}`}><Maximize2 size={18}/></button></header>
      <div className="gallery-phone-stage"><div className="gallery-phone-scale"><IosFrame darkMode={option.id === 'focus'}><DemoPhone key={`${option.id}-${scenario}-${generation}`} variant={option.id} initial={scenario}/></IosFrame></div></div>
      <div className="option-description"><p>{option.idea}</p><div className="option-bottom"><div className="palette-swatches" aria-label={`${option.title}配色`}>{option.palette.map(color => <i key={color} style={{ background:color }}/>)}</div><button className={preferred === option.id ? 'chosen' : ''} onClick={() => setPreferred(option.id)}>{preferred === option.id ? <><Check size={15}/>已标记偏好</> : <>更喜欢这套<ArrowUpRight size={15}/></>}</button></div></div>
    </section>)}</div>
    <footer className="gallery-footer"><Link to="/designs/focus" className="gallery-back">C 的四套大胆视觉<ArrowUpRight size={15}/></Link><p>{preferred ? `已标记 ${designOptions.find(option => option.id === preferred)?.letter} 为偏好方向；告诉我选哪套，或想混合哪两套，我再深化。` : '先看，再选。可以只喜欢某套的布局，混合另一套的配色。'}</p><small>三套使用相同示例数据，仅内存演示；不更改当前原型的申请。照片识别、真实登录与双手机同步未接入。</small></footer>
    <Dialog open={!!expandedOption} onOpenChange={open => { if (!open) setExpanded(null); }}><DialogContent className={`design-expanded ${expanded === 'focus' ? 'dark-expanded' : ''}`} showCloseButton={false}><DialogTitle className="sr-only">{expandedOption?.title}单独体验</DialogTitle><DialogDescription className="sr-only">可体验申请、审批、身份切换；仅示例数据。</DialogDescription><button className="expanded-close" onClick={() => setExpanded(null)} aria-label="关闭放大预览"><X size={20}/></button>{expandedOption && <DemoPhone key={`${expandedOption.id}-${scenario}-${generation}-expanded`} variant={expandedOption.id} initial={scenario}/>}</DialogContent></Dialog>
  </main>;
}
