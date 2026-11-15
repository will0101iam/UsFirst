// UsFirst shell-only cache, inspired by MOJI's installed-shell-first startup.
// Build replaces tokens; never cache sessions, requests, private photos or POSTs.
const VERSION = __SHELL_VERSION__;
const ASSETS = __SHELL_ASSETS__;
const REQUIRED = __SHELL_REQUIRED__;
const CACHE_PREFIX = 'usfirst-shell-';
const CACHE = CACHE_PREFIX + VERSION;
const SHELL_URL = new URL('./', self.registration.scope).href;
const assetUrls = ASSETS.map(path => new URL(path, self.registration.scope).href);
function valid(response, path) {
  if (!response || !response.ok || response.type === 'opaque') return false;
  const type = response.headers.get('content-type') || '';
  if (path.endsWith('.js')) return /javascript/.test(type);
  if (path.endsWith('.css')) return /text\/css/.test(type);
  return !/text\/html/.test(type);
}
async function fetchBounded(url, fresh = false) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 30000);
  try {
    const response = await fetch(url, { cache: fresh ? 'no-store' : 'default', signal: abort.signal });
    const body = await response.arrayBuffer();
    const headers = new Headers(response.headers);
    headers.delete('content-encoding'); headers.delete('content-length');
    return new Response(body, { status: response.status, headers });
  } finally { clearTimeout(timer); }
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      const shell = await fetchBounded(SHELL_URL, true);
      if (!shell.ok || !(await shell.clone().text()).includes('content="' + VERSION + '"')) throw new Error('Shell version mismatch');
      // Commit once the real startup dependency graph is present; optional dialogs must not block it.
      for (const asset of REQUIRED) {
        const url = new URL(asset, self.registration.scope).href;
        const response = await fetchBounded(url);
        if (!valid(response, new URL(url).pathname)) throw new Error('Invalid shell asset');
        await cache.put(url, response);
      }
      await cache.put(SHELL_URL, shell);
      await self.skipWaiting();
    } catch (error) { await caches.delete(CACHE); throw error; }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Keep the immediately previous build for tabs still loading its hashed chunks.
    const old = (await caches.keys()).filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE);
    await Promise.all(old.slice(0, -1).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
// Only generic text is carried by a push; no request data or photos are cached here.
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let data;
    try { data = event.data?.json(); } catch { return; }
    if (!data || !/^[a-f0-9-]{36}$/.test(data.requestId)) return;
    await self.registration.showNotification('一起花', {
      body: data.body === '收到一笔新申请，点开查看。' ? data.body : '你的申请有了审批结果，点开查看。',
      icon: '/app-icon-192.png', badge: '/app-icon-192.png', tag: 'usfirst-' + data.requestId,
      data: { requestId: data.requestId },
    });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const id = event.notification.data?.requestId;
  if (!/^[a-f0-9-]{36}$/.test(id || '')) return;
  const target = new URL('/#request=' + id, self.registration.scope).href;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin && ['/', '/index.html'].includes(new URL(client.url).pathname));
    if (existing) { await existing.navigate(target); await existing.focus(); }
    else await self.clients.openWindow(target);
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  const navigation = request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html');
  const oldAsset = /^\/assets\/[A-Za-z0-9_.-]+\.(js|css|woff2?|png|svg)$/.test(url.pathname);
  if (!navigation && !assetUrls.includes(url.href) && !oldAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    let cached = await cache.match(navigation ? SHELL_URL : url.href);
    if (!cached && oldAsset) {
      const owned = (await caches.keys()).filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE);
      for (const name of owned) { cached = await (await caches.open(name)).match(url.href); if (cached) break; }
    }
    if (cached) return cached;
    const response = await fetchBounded(request.url);
    // Runtime-cache only this version's immutable build resources, not private APIs or unknown paths.
    if (assetUrls.includes(url.href) && valid(response, url.pathname)) {
      try { await cache.put(url.href, response.clone()); } catch { /* Storage failure must not break a successful online response. */ }
    }
    return response;
  })());
});
