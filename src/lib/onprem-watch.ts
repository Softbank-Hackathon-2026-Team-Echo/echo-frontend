// 노트북 온프레 감시 화면의 기록 계산(순수 함수). 2초마다 받은 응답을 최근 60건 · 실패 수 · 마지막 전환으로 접는다.

export const WATCH_STRIP_SIZE = 60;
export const WATCH_INTERVAL_MS = 2000;
export const DEFAULT_GUEST_HOST = 'demo-laptop-nwjs7inr.echoport.uk';
export const DEFAULT_WATCHER_HOST = 'watch-laptopdr-nwjs7inr.echoport.uk';

/** 응답 환경 이름 → 색 묶음. 데모 앱 화면(envClass)과 같은 규칙이다 */
export type WatchKind = 'onprem' | 'aws' | 'gcp' | 'other';

export function watchKind(environment: string): WatchKind {
  if (environment === 'aws' || environment.startsWith('aws-')) return 'aws';
  if (environment === 'gcp' || environment.startsWith('gcp-')) return 'gcp';
  if (environment.startsWith('onprem')) return 'onprem';
  return 'other';
}

/** 한 번 부른 결과. 실패면 environment 가 null 이다 */
export type WatchSample = {
  at: number;
  environment: string | null;
  status: number | null;
  ms: number;
};

export type WatchSwitch = {
  from: string;
  to: string;
  /** 새 환경이 처음 답한 시각 */
  at: number;
  /** 옛 환경의 마지막 응답 → 새 환경의 첫 응답(초). 그 사이 실패 시간이 들어 있다 */
  seconds: number;
};

export type WatchState = {
  samples: WatchSample[];
  total: number;
  failures: number;
  current: string | null;
  lastOk: WatchSample | null;
  lastSwitch: WatchSwitch | null;
};

export const EMPTY_WATCH: WatchState = {
  samples: [],
  total: 0,
  failures: 0,
  current: null,
  lastOk: null,
  lastSwitch: null,
};

export function recordSample(state: WatchState, sample: WatchSample): WatchState {
  const samples = [...state.samples, sample].slice(-WATCH_STRIP_SIZE);
  const total = state.total + 1;
  if (sample.environment === null) {
    return { ...state, samples, total, failures: state.failures + 1 };
  }
  const previous = state.lastOk;
  const switched =
    previous?.environment != null && previous.environment !== sample.environment
      ? {
          from: previous.environment,
          to: sample.environment,
          at: sample.at,
          seconds: Math.max(0, (sample.at - previous.at) / 1000),
        }
      : state.lastSwitch;
  return {
    samples,
    total,
    failures: state.failures,
    current: sample.environment,
    lastOk: sample,
    lastSwitch: switched,
  };
}

/** 주소 칸에 붙여 넣은 값에서 호스트만 꺼낸다(https:// · 경로 · 공백 제거) */
export function hostOf(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase();
}
