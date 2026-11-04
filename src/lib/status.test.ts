import { describe, expect, it } from 'vitest';
import { hasRole } from './roles';
import {
  clusterInfoErrorLabel,
  connectionStatusView,
  migrationModeLabel,
  planFailureLabel,
  securityCellLabel,
  securityCompareNote,
  securityResultView,
} from './status';

describe('connectionStatusView', () => {
  it('아는 값은 정해진 문구와 색으로 바꾼다', () => {
    expect(connectionStatusView('CONNECTED')).toEqual({ label: 'Connected', tone: 'success' });
  });

  it('모르는 값은 원래 값을 중립 색으로 보여 준다', () => {
    expect(connectionStatusView('DEGRADED')).toEqual({ label: 'DEGRADED', tone: 'neutral' });
  });
});

describe('clusterInfoErrorLabel', () => {
  it('접속이 됐는데 정보만 못 읽었으면 자격 증명 거부라고 하지 않는다', () => {
    expect(clusterInfoErrorLabel('CONNECTED', 'AUTH_FAILED')).toBe(
      'Connected, but the version and node count could not be read with this account.',
    );
  });

  it('접속 실패면 접속 오류 문구를 그대로 쓴다', () => {
    expect(clusterInfoErrorLabel('FAILED', 'AUTH_FAILED')).toBe(
      'The cluster rejected the credentials.',
    );
  });

  it('오류가 없으면 비운다', () => {
    expect(clusterInfoErrorLabel('CONNECTED', null)).toBeNull();
  });
});

describe('migrationModeLabel', () => {
  it('모르는 종류는 원래 값을 보여 준다', () => {
    expect(migrationModeLabel('FAILBACK')).toBe('Failback');
    expect(migrationModeLabel('DRILL')).toBe('DRILL');
  });
});

describe('보안 표시', () => {
  it('모르는 결과는 원래 값을 중립 색으로 보여 준다', () => {
    expect(securityResultView('PARTIAL')).toEqual({ label: 'PARTIAL', tone: 'neutral' });
  });

  it('문제가 있는 칸은 건수를 쓴다', () => {
    expect(securityCellLabel('WARN', 1)).toBe('1 issue');
    expect(securityCellLabel('FAIL', 2)).toBe('2 issues');
    expect(securityCellLabel('PASS', 0)).toBe('Pass');
  });

  it('비교 판정은 막힘을 가장 먼저 말한다', () => {
    const row = (source: string, target: string, blocksMigration = false) => ({
      source: { result: source },
      target: { result: target },
      blocksMigration,
    });
    expect(securityCompareNote(row('PASS', 'FAIL', true))).toBe('blocks migration');
    expect(securityCompareNote(row('PASS', 'UNKNOWN'))).toBe('not collected');
    expect(securityCompareNote(row('PASS', 'WARN'))).toBe('warning only');
    expect(securityCompareNote(row('PASS', 'PASS'))).toBe('same');
  });
});

describe('planFailureLabel', () => {
  const plan = (kind: string) => ({
    errorCode: 'METRICS_UNAVAILABLE',
    steps: [{ kind, result: { failureCode: 'METRICS_UNAVAILABLE' } }],
  });

  it('데이터 확인에서 지표를 못 받으면 DB 쓰기 전환을 안내한다', () => {
    expect(planFailureLabel(plan('DATA_SYNC_CHECK'))).toBe(
      'Replication lag could not be read. A failback needs the DB cutover first',
    );
  });

  it('다른 단계의 같은 코드는 일반 문구다', () => {
    expect(planFailureLabel(plan('SHIFT'))).toBe('Metrics were not available');
  });

  it('실패 코드가 없으면 비운다', () => {
    expect(planFailureLabel({ errorCode: null, steps: [] })).toBeNull();
  });
});

describe('hasRole', () => {
  it('역할 순서 VIEWER < DEVELOPER < ADMIN 을 따른다', () => {
    expect(hasRole('ADMIN', 'DEVELOPER')).toBe(true);
    expect(hasRole('DEVELOPER', 'DEVELOPER')).toBe(true);
    expect(hasRole('VIEWER', 'DEVELOPER')).toBe(false);
  });

  it('역할이 없거나 모르는 값이면 권한이 없다', () => {
    expect(hasRole(null, 'VIEWER')).toBe(false);
    expect(hasRole('OWNER', 'VIEWER')).toBe(false);
  });
});
