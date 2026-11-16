// Private photos are fetched once per app session into memory as object URLs.
// Nothing is written to disk, and logging out revokes every cached image.
const urls = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

export function cachedPhotoUrl(src: string): string | undefined { return urls.get(src); }

/** Bind a freshly uploaded local image to its server URL so the first re-render never refetches it. */
export function rememberPhoto(src: string, dataUrl: string) { if (src && dataUrl && !urls.has(src)) urls.set(src, dataUrl); }

export function loadPhoto(src: string): Promise<string> {
  if (src.startsWith('data:') || src.startsWith('blob:')) return Promise.resolve(src);
  const ready = urls.get(src);
  if (ready) return Promise.resolve(ready);
  const running = pending.get(src);
  if (running) return running;
  const task = fetch(src, { credentials: 'same-origin', cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('图片暂时无法加载');
      return response.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      urls.set(src, url);
      return url;
    })
    .finally(() => { pending.delete(src); });
  pending.set(src, task);
  return task;
}

export function releasePhotos() {
  for (const url of urls.values()) if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  urls.clear();
  pending.clear();
}
