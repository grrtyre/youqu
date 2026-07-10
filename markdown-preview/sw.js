/* ==================== markdown-preview Service Worker ====================
 * 离线缓存策略：缓存优先（cache-first），使应用在离线状态下可用
 * 仅在 http/https 协议下注册（file:// 直接打开不生效，但应用本身纯前端可双击即用）
 */
var CACHE_NAME = 'markdown-preview-v2.2';
var CACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './renderer.js',
  './markdown-parser.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-256.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/favicon.ico'
];

// 安装：预缓存核心资源
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // 逐个缓存，避免单个失败导致整体 reject
      return Promise.all(
        CACHE_URLS.map(function (url) {
          return cache.add(url).catch(function () { /* 忽略单项失败 */ });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// 请求：缓存优先，回退网络
self.addEventListener('fetch', function (event) {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (resp) {
        // 动态缓存同源 GET 请求
        if (resp.ok && event.request.url.startsWith(self.location.origin)) {
          var respClone = resp.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, respClone).catch(function () {});
          });
        }
        return resp;
      }).catch(function () {
        // 离线且无缓存时返回主页兜底
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
