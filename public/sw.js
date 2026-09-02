// عامل الخدمة — يستقبل الإشعار ويعرضه ولو كانت المنصة مغلقة.
// وهذا هو الفرق بين إشعارٍ يصل وأنت خارج المكتب، وبريدٍ تراه حين تفتح بريدك.

self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_) { d = {}; }

  const title = d.title || 'مُرضي';
  const options = {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    tag: d.tag || 'murdi',
    renotify: true,
    // الإشعار المهم لا يختفي وحده قبل أن يُقرأ
    requireInteraction: d.important === true,
    data: { url: d.url || '/admin/hot' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/admin/hot';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // إن كانت المنصة مفتوحة أصلاً لا نفتح نافذة ثانية — ننقلها للمكان
      for (const c of list) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
