import { describe, expect, it } from 'vitest';
import { type Precheck, viewPrecheck } from './prechecks';

const STARTED = Date.parse('2026-11-04T03:00:00Z');

function precheck(extra: Partial<Precheck> = {}): Precheck {
  return {
    id: 'p1',
    serviceId: 's1',
    targetEnvironmentId: 'e2',
    sandboxId: 'sbx-7f3c',
    startedAt: new Date(STARTED).toISOString(),
    stoppedAt: null,
    decisions: {},
    simulated: true,
    ...extra,
  };
}

const at = (seconds: number) => STARTED + seconds * 1000;

describe('viewPrecheck', () => {
  it('처음에는 샌드박스 단계만 진행 중이고 패치가 없다', () => {
    const view = viewPrecheck(precheck(), 'aws-tokyo-prod', at(0));
    expect(view.steps[0]?.state).toBe('RUNNING');
    expect(view.patches).toEqual([]);
    expect(view.ready).toBe(false);
  });

  it('검증에 실패한 패치는 막히고, 통과한 패치는 사람 승인을 기다린다', () => {
    const view = viewPrecheck(precheck(), 'aws-tokyo-prod', at(11));
    expect(view.patches.map((patch) => [patch.number, patch.status])).toEqual([
      [2, 'BLOCKED'],
      [3, 'PROPOSED'],
    ]);
    expect(view.blockedAttempts[0]?.target).toBe('aws-tokyo-prod');
    expect(view.ready).toBe(false);
  });

  it('통과한 패치를 승인하면 계획 단계로 넘어갈 수 있다', () => {
    const view = viewPrecheck(
      precheck({ decisions: { 'patch-3': 'APPROVED' } }),
      'aws-tokyo-prod',
      at(11),
    );
    expect(view.steps.at(-1)?.state).toBe('DONE');
    expect(view.ready).toBe(true);
  });

  it('멈춘 점검은 넘어갈 수 없다', () => {
    const stopped = precheck({
      stoppedAt: new Date(at(4)).toISOString(),
      decisions: { 'patch-3': 'APPROVED' },
    });
    expect(viewPrecheck(stopped, 'aws-tokyo-prod', at(30)).ready).toBe(false);
  });
});
