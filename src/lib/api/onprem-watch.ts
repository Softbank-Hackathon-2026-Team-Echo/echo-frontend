// 노트북 온프레 감시 화면 데이터. EchoPort API 가 아니라 같은 출처 프로브(functions/onprem-probe.js)를 부른다.
// 손님 주소 · 감시자 주소에 CORS 헤더가 없어 브라우저가 직접 읽지 못하기 때문이다.
import { useQuery } from '@tanstack/react-query';
import { useEffect, useReducer } from 'react';
import { useSearchParams } from 'react-router';
import { queryKeys } from '@/lib/api/query-keys';
import { liveStatus, liveTrafficOn } from '@/lib/onprem-live';
import {
  DEFAULT_GUEST_HOST,
  DEFAULT_WATCHER_HOST,
  EMPTY_WATCH,
  hostOf,
  recordSample,
  WATCH_INTERVAL_MS,
  type WatchSample,
  type WatchState,
} from '@/lib/onprem-watch';

export type ProbeResult = {
  ok: boolean;
  status: number | null;
  ms: number;
  body: unknown;
  error: string | null;
};

export const PROBE_PATH = '/onprem-probe';

export async function probe(
  host: string,
  path: string,
  signal?: AbortSignal,
): Promise<ProbeResult> {
  const query = new URLSearchParams({ host, path });
  const url = `${window.location.origin}${PROBE_PATH}?${query}`;
  const res = await fetch(url, { cache: 'no-store', signal });
  const body = (await res.json().catch(() => null)) as ProbeResult | null;
  if (!res.ok || !body) {
    return { ok: false, status: null, ms: 0, body: null, error: `PROBE_${res.status}` };
  }
  return body;
}

function environmentOf(result: ProbeResult): string | null {
  if (!result.ok || !result.body || typeof result.body !== 'object') return null;
  const value = (result.body as { environment?: unknown }).environment;
  return typeof value === 'string' && value ? value : null;
}

type Action = { type: 'sample'; sample: WatchSample } | { type: 'reset' };

function reducer(state: WatchState, action: Action): WatchState {
  return action.type === 'reset' ? EMPTY_WATCH : recordSample(state, action.sample);
}

/**
 * 손님 주소의 /api/info 를 직렬로 불러 기록을 쌓는다. 요청 시작 간격은 2초이고, 응답이 2초보다 늦으면 응답 직후 다음 요청을 보낸다.
 * 주소가 바뀌면 기록을 비운다
 */
export function useOnpremWatch(host: string): WatchState {
  const [state, dispatch] = useReducer(reducer, EMPTY_WATCH);
  useEffect(() => {
    dispatch({ type: 'reset' });
    if (!host) return;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const started = Date.now();
      let result: ProbeResult;
      try {
        result = await probe(host, '/api/info', ctrl.signal);
      } catch {
        result = {
          ok: false,
          status: null,
          ms: Date.now() - started,
          body: null,
          error: 'NETWORK',
        };
      }
      if (ctrl.signal.aborted) return;
      dispatch({
        type: 'sample',
        sample: {
          at: Date.now(),
          environment: environmentOf(result),
          status: result.status,
          ms: result.ms,
        },
      });
      timer = setTimeout(tick, Math.max(0, WATCH_INTERVAL_MS - (Date.now() - started)));
    };
    void tick();
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [host]);
  return state;
}

/** 감시자 /state 의 화면에 쓰는 칸만. 나머지 칸은 무시한다 */
export type WatcherState = {
  state: string | null;
  epoch: number | null;
  armed: boolean | null;
  promotedAt: string | null;
  normalSince: string | null;
  /** 감시자가 본 두 신호(노트북 심장 박동 · 복제). 모르면 null */
  hb: boolean | null;
  repl: boolean | null;
};

function watcherStateOf(result: ProbeResult): WatcherState | null {
  if (!result.ok || !result.body || typeof result.body !== 'object') return null;
  const body = result.body as Record<string, unknown>;
  const signals =
    body.signals && typeof body.signals === 'object'
      ? (body.signals as Record<string, unknown>)
      : {};
  return {
    state: typeof body.state === 'string' ? body.state : null,
    epoch: typeof body.epoch === 'number' ? body.epoch : null,
    armed: typeof body.armed === 'boolean' ? body.armed : null,
    promotedAt: typeof body.promoted_at === 'string' ? body.promoted_at : null,
    normalSince: typeof body.normal_since === 'string' ? body.normal_since : null,
    hb: typeof signals.hb === 'boolean' ? signals.hb : null,
    repl: typeof signals.repl === 'boolean' ? signals.repl : null,
  };
}

/**
 * 서비스 화면의 온프레 실시간 관측. enabled 가 거짓이면 아무것도 부르지 않는다.
 * 호스트는 기본값 상수이고 `?guest=` · `?watcher=` 쿼리가 있으면 그 값을 쓴다
 */
export function useOnpremLive(enabled: boolean) {
  const [params] = useSearchParams();
  const guestHost = enabled ? hostOf(params.get('guest') ?? DEFAULT_GUEST_HOST) : '';
  const watcherHost = enabled ? hostOf(params.get('watcher') ?? DEFAULT_WATCHER_HOST) : '';
  const watch = useOnpremWatch(guestHost);
  const watcher = useWatcherState(watcherHost);
  const state = watcher.data?.watcher?.state ?? null;
  return {
    enabled,
    watch,
    watcher,
    status: enabled ? liveStatus(state, watch.current) : null,
    trafficOn: enabled ? liveTrafficOn(state, watch.current) : null,
  };
}

/** 감시자 상태(선택). 주소가 비어 있으면 부르지 않는다 */
export function useWatcherState(host: string) {
  return useQuery({
    queryKey: queryKeys.onpremWatcher(host),
    queryFn: async ({ signal }) => {
      const result = await probe(host, '/state', signal);
      return { result, watcher: watcherStateOf(result) };
    },
    enabled: host !== '',
    refetchInterval: WATCH_INTERVAL_MS,
    retry: false,
  });
}
