import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet, readCapped } from '../../functions/onprem-probe.js';

const call = (query) =>
  onRequestGet({ request: new Request(`https://app.echoport.uk/onprem-probe?${query}`) });

const streamOf = (chunks) =>
  new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });

afterEach(() => vi.unstubAllGlobals());

describe('onprem-probe', () => {
  it('생산자 경로를 쿼리 없이 그대로 부른다(/healthz · /hb 는 경로를 정확히 비교한다)', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await call('host=watch-laptopdr-x.echoport.uk&path=%2Fhealthz');
    expect(await res.json()).toMatchObject({ ok: true, status: 200, body: { ok: true } });
    expect(fetchMock.mock.calls[0][0]).toBe('https://watch-laptopdr-x.echoport.uk/healthz');

    await call('host=hb-laptop-x.echoport.uk&path=%2Fhb');
    expect(fetchMock.mock.calls[1][0]).toBe('https://hb-laptop-x.echoport.uk/hb');
  });

  it('허용 목록 밖 호스트 · 경로는 부르지 않고 400 이다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect((await call('host=api.echoport.uk&path=%2Fapi%2Finfo')).status).toBe(400);
    expect((await call('host=demo-x.echoport.uk&path=%2Fapi%2Fwrites')).status).toBe(400);
    expect((await call('host=demo-x.evil.com&path=%2Fapi%2Finfo')).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('선언 길이가 상한을 넘으면 본문을 읽지 않는다', async () => {
    const res = new Response(streamOf(['x']), { headers: { 'content-length': '20000' } });
    expect(await readCapped(res, 16384)).toBeNull();
  });

  it('길이 선언이 없어도 받은 바이트가 상한을 넘는 순간 읽기를 멈춘다', async () => {
    let pulled = 0;
    const endless = new ReadableStream({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(4096));
      },
    });
    expect(await readCapped(new Response(endless), 16384)).toBeNull();
    expect(pulled).toBeLessThan(10);
  });

  it('상한 안의 여러 조각은 이어 붙여 그대로 돌려준다', async () => {
    const res = new Response(streamOf(['{"environment":', '"onprem"}']));
    expect(await readCapped(res, 16384)).toBe('{"environment":"onprem"}');
  });

  it('본문이 크면 BODY_TOO_LARGE 로 실패를 돌려준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(streamOf(['y'.repeat(20000)]))),
    );
    expect(await (await call('host=demo-x.echoport.uk&path=%2Fapi%2Finfo')).json()).toMatchObject({
      ok: false,
      error: 'BODY_TOO_LARGE',
    });
  });
});
