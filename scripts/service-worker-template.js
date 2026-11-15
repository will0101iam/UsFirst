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

function recoveryPage() {
  // Available even if browser evicted every shell cache and the network is unavailable.
  const html = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#551e42"><title>一起花</title><style>html,body{margin:0;background:#551e42;color:#fff2fa;font-family:-apple-system,sans-serif}main{padding:calc(32px + env(safe-area-inset-top)) 24px;line-height:1.8}h1{font-size:24px}a{display:inline-block;padding:12px 24px;border-radius:18px;background:#d6f56a;color:#2c3317;text-decoration:none}p{color:#efc9dd}</style><main><h1>一起花.</h1><h2>暂时无法加载页面</h2><p>页面资源暂不可用，请联网后重新打开。服务器上的申请记录不会被删除。</p><a href="/">重新打开</a></main></html>';
  return new Response(html, { headers: { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store', 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" } });
}
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  const navigation = request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html');
  const freshNavigation = navigation && url.searchParams.has('__usfirst_reload');
  const oldAsset = /^\/assets\/[A-Za-z0-9_.-]+\.(js|css|woff2?|png|svg)$/.test(url.pathname);
  if (!navigation && !assetUrls.includes(url.href) && !oldAsset) return;
  event.respondWith((async () => {
    let cache, cached;
    try {
      cache = await caches.open(CACHE);
      cached = await cache.match(navigation ? SHELL_URL : url.href);
      if (!cached && oldAsset) {
        const owned = (await caches.keys()).filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE);
        for (const name of owned) { cached = await (await caches.open(name)).match(url.href); if (cached) break; }
      }
    } catch { /* Cache read failure is not a network failure. Continue online. */ }
    if (cached && !freshNavigation) return cached;
    try {
      const response = await fetchBounded(freshNavigation ? SHELL_URL : request.url, freshNavigation);
      if (navigation && (!response.ok || !/text\/html/.test(response.headers.get('content-type') || ''))) throw new Error('Invalid navigation');
      if (cache && assetUrls.includes(url.href) && valid(response, url.pathname)) {
        try { await cache.put(url.href, response.clone()); } catch { /* A successful network response is still usable. */ }
      }
      return response;
    } catch (error) {
      if (!navigation) throw error;
      if (cached) return cached;
      // Prefer an intact previous HTML+entry pair after eviction; never mix a new shell with old JS.
      try {
        const owned = (await caches.keys()).filter(key => key.startsWith(CACHE_PREFIX)).reverse();
        for (const name of owned) {
          const previous = await caches.open(name), shell = await previous.match(SHELL_URL);
          if (!shell) continue;
          const text = await shell.clone().text();
          const entries = [...text.matchAll(/<script\b[^>]*src="([^\"]+)"[^>]*>/g)].map(match => new URL(match[1],SHELL_URL).href);
          if (!entries.length) continue;
          const complete = await Promise.all(entries.map(entry => previous.match(entry)));
          if (complete.every(Boolean)) return shell;
        }
      } catch { /* Recovery below needs no cache, JavaScript or network. */ }
      return recoveryPage();
    }
  })());
});
