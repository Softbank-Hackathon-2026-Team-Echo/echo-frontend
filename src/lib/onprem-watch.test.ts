import { describe, expect, it } from 'vitest';
import {
  EMPTY_WATCH,
  hostOf,
  recordSample,
  WATCH_STRIP_SIZE,
  type WatchSample,
  watchKind,
} from './onprem-watch';

const ok = (at: number, environment: string): WatchSample => ({
  at,
  environment,
  status: 200,
  ms: 30,
});
const fail = (at: number): WatchSample => ({ at, environment: null, status: 530, ms: 3000 });

describe('onprem-watch', () => {
  it('환경 이름을 데모 앱과 같은 색 묶음으로 나눈다', () => {
    expect(watchKind('onprem')).toBe('onprem');
    expect(watchKind('onprem-laptop')).toBe('onprem');
    expect(watchKind('aws-tokyo')).toBe('aws');
    expect(watchKind('gcp-seoul')).toBe('gcp');
    expect(watchKind('somewhere')).toBe('other');
  });

  it('실패를 세고, 옛 환경 마지막 응답부터 새 환경 첫 응답까지를 전환 소요로 잰다', () => {
    let state = EMPTY_WATCH;
    state = recordSample(state, ok(0, 'onprem'));
    state = recordSample(state, ok(2000, 'onprem'));
    state = recordSample(state, fail(4000));
    state = recordSample(state, fail(7000));
    state = recordSample(state, ok(12500, 'aws-tokyo'));

    expect(state.total).toBe(5);
    expect(state.failures).toBe(2);
    expect(state.current).toBe('aws-tokyo');
    expect(state.lastSwitch).toEqual({ from: 'onprem', to: 'aws-tokyo', at: 12500, seconds: 10.5 });
  });

  it('첫 응답은 전환이 아니고, 실패 뒤 같은 환경이 다시 답해도 전환이 아니다', () => {
    let state = recordSample(EMPTY_WATCH, ok(0, 'onprem'));
    state = recordSample(state, fail(2000));
    state = recordSample(state, ok(4000, 'onprem'));
    expect(state.lastSwitch).toBeNull();
  });

  it('복귀하면 마지막 전환이 새 방향으로 바뀐다', () => {
    let state = recordSample(EMPTY_WATCH, ok(0, 'onprem'));
    state = recordSample(state, ok(2000, 'aws-tokyo'));
    state = recordSample(state, ok(60000, 'aws-tokyo'));
    state = recordSample(state, ok(63000, 'onprem'));
    expect(state.lastSwitch).toMatchObject({ from: 'aws-tokyo', to: 'onprem', seconds: 3 });
  });

  it('띠는 최근 60건만 남기고 합계는 계속 센다', () => {
    let state = EMPTY_WATCH;
    for (let i = 0; i < WATCH_STRIP_SIZE + 5; i += 1) state = recordSample(state, ok(i, 'onprem'));
    expect(state.samples).toHaveLength(WATCH_STRIP_SIZE);
    expect(state.total).toBe(WATCH_STRIP_SIZE + 5);
  });

  it('붙여 넣은 주소에서 호스트만 꺼낸다', () => {
    expect(hostOf(' https://Demo-Laptop-x.echoport.uk/api/info?x=1 ')).toBe(
      'demo-laptop-x.echoport.uk',
    );
  });
});
