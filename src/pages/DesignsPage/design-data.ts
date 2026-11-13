// EXPORTS: Variant, DemoScreen, DemoView, IDesignOption{id,letter,title,caption,idea,palette}, designOptions
export type Variant = 'clear' | 'note' | 'focus';
export type DemoScreen = 'home' | 'new' | 'detail';
export type DemoView = 'inbox' | 'mine';
export interface IDesignOption { id: Variant; letter: string; title: string; caption: string; idea: string; palette: string[] }
export const designOptions: IDesignOption[] = [
  { id:'clear', letter:'A', title:'轻快清单', caption:'清爽、直接，像每天都在用的手机工具。', idea:'用紧凑清单代替大卡片。审批、申请、历史一眼可达，淡蓝主行动和清晰字号层级。', palette:['#f4f6fb','#ffffff','#2563eb','#182442'] },
  { id:'note', letter:'B', title:'两人便笺', caption:'更有温度，但不做幼稚的情侣装饰。', idea:'申请像递给对方的一张便笺。粉白纸面、深莓红墨色、金额如收据；靠版式建立亲密感。', palette:['#fff7f7','#ffffff','#92404f','#402b31'] },
  { id:'focus', letter:'C', title:'一事一页', caption:'深色、沉静，一次只决定一笔消费。', idea:'一张申请占据主要视野，金额与理由优先。底部明确同意或暂缓，用琥珀色指引主动作。', palette:['#171918','#242725','#e4b768','#f0f0e8'] },
];
