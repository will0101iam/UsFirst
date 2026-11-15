// Run before the main application: shell recovery must not depend on its bundle.
(function () {
  var boot = document.getElementById('boot-shell');
  var status = document.getElementById('boot-status');
  var retry = document.getElementById('boot-retry');
  var timer;
  function failed() {
    if (!document.getElementById('boot-shell')) return;
    if (status) status.textContent = navigator.onLine === false ? '当前离线，请联网后重试。' : '页面加载较慢，请重试。';
    if (retry) retry.hidden = false;
  }
  if (retry) retry.addEventListener('click', function () { location.reload(); });
  timer = setTimeout(failed, 12000);
  window.addEventListener('usfirst:mounted', function () { clearTimeout(timer); });
  window.addEventListener('error', function (event) {
    if (event.target && event.target.tagName === 'SCRIPT' && event.target.type === 'module') failed();
  }, true);
  window.addEventListener('online', function () {
    if (boot && document.getElementById('boot-shell') && status) status.textContent = '网络已恢复，请重试。';
  });
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
    update();
    window.addEventListener('online', update);
    window.addEventListener('pageshow', update);
    document.addEventListener('visibilitychange', update);
  }
})();
