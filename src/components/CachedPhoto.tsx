import { useEffect, useState } from 'react';
import { cachedPhotoUrl, loadPhoto } from '@/lib/photo-cache';

interface CachedPhotoProps { src: string; alt: string; className?: string; eager?: boolean; defer?: number; onClick?(): void }

/** Renders a private photo from the session memory cache; never blocks layout while loading. */
export default function CachedPhoto({ src, alt, className, eager = false, defer = 0, onClick }: CachedPhotoProps) {
  const [url, setUrl] = useState(() => src.startsWith('data:') ? src : cachedPhotoUrl(src));
  useEffect(() => {
    let active = true;
    let timer = 0;
    if (!url) {
      const start = () => {
        void loadPhoto(src).then(value => { if (active) setUrl(value); }).catch(() => { /* Keep the placeholder; the retry path is the parent's concern. */ });
      };
      if (defer > 0) timer = window.setTimeout(start, defer); else start();
    }
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [src, url, defer]);
  return <img src={url} alt={alt} className={className ? 'photo-pending ' + className : 'photo-pending'} loading={eager ? 'eager' : 'lazy'} decoding="async" onClick={onClick}/>;
}
