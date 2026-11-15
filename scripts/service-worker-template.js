// UsFirst shell-only cache, inspired by MOJI's installed-shell-first startup.
// Build replaces tokens; never cache sessions, requests, private photos or POSTs.
const VERSION = __SHELL_VERSION__;
const ASSETS = __SHELL_ASSETS__;
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
async function fetchBounded(url) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 12000);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: abort.signal });
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
      const shell = await fetchBounded(SHELL_URL);
      if (!shell.ok || !(await shell.clone().text()).includes('content="' + VERSION + '"')) throw new Error('Shell version mismatch');
      // Commit a usable version only after every build asset is present.
    for (const url of assetUrls) {
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
    // No runtime caching of unknown/personal data or failed HTML masquerading as JS.
    return response;
  })());
});
