import { useState } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { IPicture } from '@/lib/oa-types';
export default function PhotoViewer({ photos, index, onClose }: { photos: IPicture[]; index: number; onClose(): void }) {
  const [current, setCurrent] = useState(index); const [zoom, setZoom] = useState(false);
  const photo = photos[current];
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="us-photo-viewer" aria-describedby={undefined} showCloseButton={false}><DialogTitle className="sr-only">申请照片 {current + 1}</DialogTitle><div className="photo-view-toolbar"><span>{current + 1} / {photos.length}</span><button aria-label={zoom ? '缩小图片' : '放大图片'} onClick={() => setZoom(!zoom)}>{zoom ? <ZoomOut/> : <ZoomIn/>}</button><button aria-label="关闭图片" onClick={onClose}><X/></button></div><div className={`photo-view-scroll ${zoom ? 'zoomed' : ''}`}><img src={photo.dataUrl} alt={`申请图片 ${current + 1}`} onClick={() => setZoom(!zoom)}/></div>{photos.length > 1 && <div className="photo-view-pager"><button disabled={current === 0} aria-label="上一张" onClick={() => { setCurrent(current - 1); setZoom(false); }}><ChevronLeft/></button><button disabled={current === photos.length - 1} aria-label="下一张" onClick={() => { setCurrent(current + 1); setZoom(false); }}><ChevronRight/></button></div>}</DialogContent></Dialog>;
}
