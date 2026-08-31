/* YJ BaseBall Note — 오프라인 서비스워커
   앱 껍데기(HTML·아이콘·글꼴)를 기기에 캐시해 두고,
   인터넷이 없어도 앱이 그대로 열리게 합니다.
   기록 자체는 원래부터 기기 안(localStorage·IndexedDB)에만 저장됩니다.
   ------------------------------------------------------------------
   앱을 고쳐 올릴 때마다 아래 VERSION 숫자를 1 올려 주세요.
   그래야 사용자 기기가 새 버전을 받아 갑니다. */
const VERSION = "v1";
const CACHE   = "bb-note-" + VERSION;

// 미리 받아 둘 파일 (없는 파일이 섞여 있어도 설치는 계속됩니다)
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", e=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>
      // 하나씩 담아서, 실패한 파일이 있어도 설치가 깨지지 않게 합니다
      Promise.all(SHELL.map(u=> c.add(new Request(u, {cache:"reload"})).catch(()=>{})))
    ).then(()=> self.skipWaiting())
  );
});

self.addEventListener("activate", e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=> Promise.all(ks.filter(k=> k.startsWith("bb-note-") && k!==CACHE).map(k=> caches.delete(k))))
      .then(()=> self.clients.claim())
  );
});

self.addEventListener("message", e=>{ if(e.data==="skipWaiting") self.skipWaiting(); });

self.addEventListener("fetch", e=>{
  const req = e.request;
  if(req.method !== "GET") return;                 // 저장·업로드 요청은 건드리지 않습니다

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // 1) 화면 이동(주소창·앱 실행) — 온라인이면 최신을 받고, 안 되면 캐시로 엽니다
  if(req.mode === "navigate"){
    e.respondWith(
      fetch(req).then(res=>{
        const copy = res.clone();
        caches.open(CACHE).then(c=> c.put("./index.html", copy)).catch(()=>{});
        return res;
      }).catch(()=>
        caches.match(req).then(r=> r || caches.match("./index.html")).then(r=> r || caches.match("./"))
      )
    );
    return;
  }

  // 2) 같은 주소의 파일(아이콘 등) — 캐시 우선, 없으면 받아서 캐시에 저장
  if(sameOrigin){
    e.respondWith(
      caches.match(req).then(hit=>{
        const net = fetch(req).then(res=>{
          if(res && res.status===200){ const copy=res.clone(); caches.open(CACHE).then(c=> c.put(req, copy)).catch(()=>{}); }
          return res;
        }).catch(()=> hit);
        return hit || net;
      })
    );
    return;
  }

  // 3) 바깥 주소(구글 글꼴 등) — 한 번 받아 두면 그다음부터는 오프라인에서도 씁니다.
  //    못 받아도 앱은 기기 기본 글꼴로 정상 동작합니다.
  if(/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    e.respondWith(
      caches.match(req).then(hit=> hit || fetch(req).then(res=>{
        if(res && (res.status===200 || res.type==="opaque")){
          const copy=res.clone(); caches.open(CACHE).then(c=> c.put(req, copy)).catch(()=>{});
        }
        return res;
      }).catch(()=> hit))
    );
  }
  // 그 밖의 바깥 주소(유튜브 등)는 그대로 둡니다 — 인터넷이 있어야 재생됩니다.
});
