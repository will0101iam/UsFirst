// Run before the main application: shell recovery must not depend on its bundle.
(function () {
  if ((location.pathname === '/recover.html' || location.pathname === '/recover') && typeof history !== 'undefined') history.replaceState(null, '', '/' + location.search + location.hash);
  var boot = document.getElementById('boot-shell');
  var status = document.getElementById('boot-status');
  var retry = document.getElementById('boot-retry');
  var timer;
  var mounted = false;
  var records = document.getElementById('boot-records');
  function paintLastHome() {
    if (records) records.replaceChildren();
    try {
      var store = window.localStorage;
      if ((store.getItem('usfirst:snapshot-generation:v1') || '').indexOf('logout:') === 0) return;
      var raw = store.getItem('usfirst:snapshot:v1');
      if (!raw || raw.length > 300000) return;
      var value = JSON.parse(raw), user = value.session && value.session.user, pair = value.session && value.session.pair;
      if (value.version !== 1 || !user || !pair || value.account !== user.username || !/^[a-z0-9_]{3,32}$/.test(user.username) || !Number.isFinite(value.savedAt) || value.savedAt > Date.now() + 60000 || Date.now() - value.savedAt > 86400000 || !Array.isArray(value.requests) || value.requests.length > 300) return;
      var labels = { pending:'待审批', approved:'已通过', rejected:'暂时不买', purchased:'已购买', cancelled:'已撤回' };
      var valid = value.requests.every(function (r) { return r && typeof r.title === 'string' && r.title.length <= 60 && typeof r.id === 'string' && r.id.length <= 64 && typeof r.reason === 'string' && r.reason.length <= 300 && ['me','partner'].indexOf(r.applicant) >= 0 && ['网购','外卖','其他'].indexOf(r.category) >= 0 && Object.prototype.hasOwnProperty.call(labels,r.status) && Number.isInteger(r.amountCents) && r.amountCents > 0 && r.amountCents <= 99999999 && Number.isFinite(Date.parse(r.createdAt)); });
      if (!valid || !records) return;
      value.requests.slice(0, 30).forEach(function (r) {
        var card = document.createElement('article'); card.setAttribute('class','boot-card');
        var who = document.createElement('small'); who.textContent = (r.applicant === 'me' ? '我的申请' : '对方申请') + ' · ' + r.category;
        var title = document.createElement('h2'); title.textContent = r.title;
        var money = document.createElement('p'); money.setAttribute('class','boot-money'); money.textContent = '¥' + (r.amountCents / 100).toFixed(2);
        var state = document.createElement('p'); state.textContent = '上次记录：' + labels[r.status];
        card.appendChild(who); card.appendChild(title); card.appendChild(money); card.appendChild(state); records.appendChild(card);
      });
      if (status) status.textContent = '上次同步的记录 · 正在打开，仅可查看';
    } catch (_) { /* Storage unavailable must not remove the visible shell. */ }
  }
  paintLastHome();
  function failed() {
    if (mounted || !boot) return;
    boot.hidden = false;
    if (status) status.textContent = navigator.onLine === false ? '当前离线，仅可查看上次记录。联网后可重新加载。' : '页面组件尚未加载完成，仅可查看上次记录。';
    if (retry) retry.hidden = false;
    window.dispatchEvent(new Event('usfirst:boot-failed'));
  }
  if (retry) retry.addEventListener('click', function () {
    var target = new URL(location.href);
    target.searchParams.set('__usfirst_reload', String(Date.now()));
    location.replace(target.href);
  });
  timer = setTimeout(failed, 12000);
  function acceptVisibleApp() {
    var root = document.getElementById('root');
    if (!root || !root.firstElementChild || !root.textContent.trim() || root.getBoundingClientRect().height < 40) { failed(); return; }
    mounted = true; clearTimeout(timer); if (boot) boot.hidden = true;
    if (document.documentElement) document.documentElement.classList.add('usfirst-app-ready');
  }
  window.addEventListener('usfirst:mounted', function () {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(acceptVisibleApp); else acceptVisibleApp();
  });
  window.addEventListener('usfirst:fatal', function () {
    mounted = false; paintLastHome();
    if (document.documentElement) document.documentElement.classList.remove('usfirst-app-ready');
    failed();
  });
  window.addEventListener('storage', function (event) {
    if (event.key === 'usfirst:snapshot-generation:v1' || event.key === null) { if (records) records.replaceChildren(); }
  });
  window.addEventListener('error', function (event) {
    if (event.target && event.target.tagName === 'SCRIPT' && event.target.type === 'module') failed();
  }, true);
  window.addEventListener('online', function () {
    if (boot && document.getElementById('boot-shell') && status) status.textContent = '网络已恢复，请重试。';
  });
  // Begin the authenticated read while the main bundle downloads; consume it once in React.
  var startupAbort = new AbortController();
  var startupTimer = setTimeout(function () { startupAbort.abort(); }, 25000);
  window.__usfirstStartup = fetch('/api/bootstrap', { credentials: 'same-origin', cache: 'no-store', signal: startupAbort.signal })
    .then(function (response) { return response.arrayBuffer().then(function (body) { var headers = new Headers(response.headers); headers.delete('content-encoding'); headers.delete('content-length'); return new Response(body, { status: response.status, headers: headers }); }); })
    .finally(function () { clearTimeout(startupTimer); });
  window.__usfirstStartup.catch(function () {});
  window.addEventListener('usfirst:connected', function () { clearTimeout(startupTimer); });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) {
    // Never wait for the SW before rendering. Failed installs leave the previous usable shell.
    var pending;
    function update() {
      if (document.hidden || pending) return;
      pending = navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then(function (registration) { return registration.update(); })
        .catch(function () {})
        .finally(function () { pending = null; });
    }
    var connected = false;
    var queued = false;
    var lastUpdate = 0;
    function scheduleUpdate() {
      if (!connected || document.hidden || pending || queued || Date.now() - lastUpdate < 60000) return;
      queued = true;
      setTimeout(function () {
        queued = false;
        if (document.hidden) return;
        lastUpdate = Date.now(); update();
      }, 6000);
    }
    window.addEventListener('usfirst:connected', function () { connected = true; scheduleUpdate(); });
    window.addEventListener('usfirst:boot-failed', function () { connected = true; update(); });
    window.addEventListener('online', scheduleUpdate);
    window.addEventListener('pageshow', scheduleUpdate);
    document.addEventListener('visibilitychange', scheduleUpdate);
  }
})();
