// 노트북 온프레 감시 화면(/o/:slug/remote/onprem)이 부르는 같은 출처 프로브(Cloudflare Pages Function).
// 데모 앱 손님 주소 · 감시자 주소는 CORS 헤더가 없어 브라우저가 직접 읽지 못한다.
// 아무 주소나 대신 부르는 프록시가 되지 않게 호스트 · 경로를 고정 목록으로만 받고, 쿠키 · 인증 헤더를 넘기지 않는다.

const HOST = /^(demo|hb|watch)-[a-z0-9-]{1,40}\.echoport\.uk$/;
const PATHS = new Set(['/api/info', '/hb', '/state', '/healthz']);
const TIMEOUT_MS = 3000;
const MAX_BODY_BYTES = 16384;

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/** 본문을 최대 maxBytes 까지만 읽는다. 넘으면(선언 길이 또는 실제로 받은 바이트) 읽기를 멈추고 null 을 돌려준다 */
export async function readCapped(res, maxBytes = MAX_BODY_BYTES) {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel();
    return null;
  }
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const host = url.searchParams.get('host') ?? '';
  const path = url.searchParams.get('path') ?? '/api/info';
  if (!HOST.test(host) || !PATHS.has(path)) return json(400, { error: 'TARGET_NOT_ALLOWED' });

  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // 쿼리를 붙이지 않는다: 감시자 · 노트북 guard 는 `/healthz` · `/hb` 를 경로 그대로 비교한다(쿼리가 붙으면 404).
    // 캐시는 요청 헤더로만 막는다. 이 주소들은 확장자 없는 JSON 이라 Cloudflare 기본 캐시 대상도 아니다
    const res = await fetch(`https://${host}${path}`, {
      // Cloudflare 가 빈 UA 를 브라우저 서명 검사(1010)로 막을 수 있어 이름을 붙인다
      headers: {
        'user-agent': 'echoport-onprem-watch/1',
        accept: 'application/json',
        'cache-control': 'no-cache',
      },
      redirect: 'manual',
      signal: ctrl.signal,
    });
    const text = await readCapped(res);
    if (text === null) {
      return json(200, {
        ok: false,
        status: res.status,
        ms: Date.now() - started,
        body: null,
        error: 'BODY_TOO_LARGE',
      });
    }
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return json(200, {
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      body,
      error: null,
    });
  } catch (error) {
    const name = error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK';
    return json(200, {
      ok: false,
      status: null,
      ms: Date.now() - started,
      body: null,
      error: name,
    });
  } finally {
    clearTimeout(timer);
  }
}
