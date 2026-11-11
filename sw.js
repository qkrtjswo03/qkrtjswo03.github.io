/**
 * SunJae.Log 서비스 워커.
 * HTML은 네트워크를 먼저 보고, 실패하면 이 기기에 남은 페이지를 보여 줍니다.
 * 검색·kubectl 색인 JSON과 RSS도 네트워크를 먼저 봅니다. 배포 직후 옛 색인이 남으면 안 됩니다.
 * GoatCounter 조회수 API의 404(아직 집계 없음)는 0건으로 바꿔, 페이지 콘솔에 에러가 안 남게 합니다.
 * 페이지 이동(ClientRouter 의 fetch 포함)과 HTML·JSON 등은 네트워크를 먼저 보고, 오프라인일 때만 저장본을 씁니다.
 * 해시가 붙은 /_astro/ 파일만 저장본을 먼저 쓰고, 이미지·글꼴은 저장본을 보여 주면서 뒤에서 새로 받아 둡니다.
 * 캐시 이름에는 빌드 때 배포마다 다른 값이 들어가며(astro.config.ts), 새 워커가 켜지면 이전 캐시를 지웁니다.
 * api.github.com 과 GitHub 파일 응답은 절대 캐시하지 않습니다. 잠긴 글 본문이 여기 남으면 안 됩니다.
 */
const BUILD = '02855582dd3f';
const CACHE = 'sunjae-pwa-v19-' + BUILD;

const SHELL = ['/', '/favicon.svg', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'];

const OFFLINE_HTML = `<!doctype html>
<html lang="ko">
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#050b1f" />
<title>오프라인 · SunJae.Log</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#050b1f;color:#e7eefc;font-family:sans-serif">
  <main style="max-width:28rem;padding:1.5rem">
    <h1 style="font-size:1.25rem">오프라인입니다</h1>
    <p>이 주소는 아직 이 기기에 저장되지 않았습니다. 네트워크에 연결한 뒤 다시 열면, 그다음부터는 오프라인에서도 볼 수 있습니다.</p>
  </main>
</body>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(SHELL);
      await cache.put(
        new Request('/offline'),
        new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
      );
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isGithub(url) {
  return (
    url.hostname === 'api.github.com' ||
    url.hostname === 'github.com' ||
    url.hostname.endsWith('.github.com') ||
    url.hostname.endsWith('githubusercontent.com')
  );
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    if (fresh && fresh.ok && fresh.type === 'basic') {
      try {
        await cache.put(request, fresh.clone());
      } catch {
        /* 일부 이동 응답은 캐시에 넣지 않습니다. */
      }
    }
    return fresh;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match('/offline');
    if (offline) return offline;
    return new Response(OFFLINE_HTML, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

async function goatCounterCount(request) {
  try {
    const fresh = await fetch(request);
    if (fresh.status === 404) {
      return new Response(JSON.stringify({ count: '0' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return fresh;
  } catch {
    return new Response(JSON.stringify({ count: '0' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const refresh = fetch(request)
    .then(async (fresh) => {
      if (fresh && fresh.ok && fresh.type === 'basic') {
        const cache = await caches.open(CACHE);
        try {
          await cache.put(request, fresh.clone());
        } catch {
          /* ignore */
        }
      }
      return fresh;
    })
    .catch(() => undefined);
  if (cached) return cached;
  const fresh = await refresh;
  if (fresh) return fresh;
  return Response.error();
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok && fresh.type === 'basic') {
    const cache = await caches.open(CACHE);
    try {
      await cache.put(request, fresh.clone());
    } catch {
      /* ignore */
    }
  }
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (
    url.hostname.endsWith('.goatcounter.com') &&
    url.pathname.includes('/counter/')
  ) {
    event.respondWith(goatCounterCount(request));
    return;
  }

  if (isGithub(url)) return;
  if (
    url.hostname === 'pagead2.googlesyndication.com' ||
    url.hostname.endsWith('.googlesyndication.com') ||
    url.hostname.endsWith('.doubleclick.net') ||
    url.hostname === 'googleads.g.doubleclick.net'
  ) {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js') return;

  // 해시 파일은 내용이 바뀌면 이름도 바뀌므로 저장본을 먼저 씁니다.
  if (url.pathname.startsWith('/_astro/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  // 이미지·글꼴·영상은 저장본을 바로 보여 주고 뒤에서 새로 받아 다음에 반영합니다.
  if (/\.(?:png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|mp4|webm|pdf)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  // 그 밖의 모든 요청(페이지 이동, ClientRouter 의 페이지 fetch, 색인 JSON, RSS 등)은 네트워크 먼저.
  event.respondWith(networkFirst(request));
});
