// 初见专属版 sw.js：
// 1) 保持原桩行为：装上就接管、清掉旧缓存
// 2) 拦截发往 Scratch 素材 CDN 的请求，改从本地 library-assets/ 取，
//    让官方素材库（角色/造型/声音/背景）在离线时也能打开。
self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  try {
    var url = new URL(e.request.url);
    if (url.hostname === "extensions.turbowarp.org") {
      var localExt = new URL("extensions-mirror" + url.pathname, self.location.href).href;
      e.respondWith(
        fetch(localExt).then((r) => {
          if (!r.ok) return fetch(e.request);
          var headers = new Headers(r.headers);
          headers.set("Access-Control-Allow-Origin", "*");
          return r.blob().then((b) => new Response(b, { status: 200, headers: headers }));
        }).catch(() => fetch(e.request))
      );
      return;
    }
    if (url.hostname.indexOf("scratch.mit.edu") !== -1) {
      var m = url.pathname.match(/\/internalapi\/asset\/([^/]+)\/get\/?$/);
      if (m) {
        var local = new URL("library-assets/" + m[1], self.location.href).href;
        e.respondWith(
          fetch(local).then((r) => {
            if (!r.ok) return fetch(e.request);
            var headers = new Headers(r.headers);
            headers.set("Access-Control-Allow-Origin", "*");
            return r.blob().then((b) => new Response(b, { status: 200, headers: headers }));
          }).catch(() => fetch(e.request))
        );
      }
    }
  } catch (err) { /* 不是素材请求就放行 */ }
});
