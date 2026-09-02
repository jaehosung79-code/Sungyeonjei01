/* YJ Baseball Note — 서비스 워커
   · 오프라인에서도 앱이 열립니다.
   · HTML 은 "네트워크 우선"이라 파일을 새로 올리면 바로 반영됩니다.
   · 크롬은 fetch 처리를 하는 서비스 워커가 있어야 '앱 설치' 신호(beforeinstallprompt)를 보냅니다. */
const CACHE  = "yj-baseball-v1";
const ASSETS = ["./", "./index.html", "./manifest.json",
                "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=> Promise.allSettled(ASSETS.map(u=> c.add(new Request(u, {cache:"reload"})))))
      .catch(()=>{})
      .then(()=> self.skipWaiting())
  );
});

self.addEventListener("activate", e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=> Promise.all(ks.filter(k=> k!==CACHE).map(k=> caches.delete(k))))
      .then(()=> self.clients.claim())
  );
});

self.addEventListener("fetch", e=>{
  const req = e.request;
  if(req.method !== "GET") return;
  let url; try{ url = new URL(req.url); }catch(_){ return; }
  if(url.origin !== location.origin) return;

  const isHTML = req.mode === "navigate"
    || (req.headers.get("accept")||"").includes("text/html");

  if(isHTML){                       // 최신 파일 우선, 오프라인이면 캐시
    e.respondWith(
      fetch(req).then(res=>{
        const cp = res.clone();
        caches.open(CACHE).then(c=> c.put(req, cp)).catch(()=>{});
        return res;
      }).catch(()=> caches.match(req).then(m=> m || caches.match("./index.html")))
    );
    return;
  }
                                     // 그 외(아이콘 등)는 캐시 우선
  e.respondWith(
    caches.match(req).then(m=> m || fetch(req).then(res=>{
      const cp = res.clone();
      caches.open(CACHE).then(c=> c.put(req, cp)).catch(()=>{});
      return res;
    }))
  );
});
