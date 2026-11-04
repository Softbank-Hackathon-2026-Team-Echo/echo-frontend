import { describe, expect, it } from 'vitest';
import { compareCells, matrixRow, SECURITY_CONTROLS } from './security';
import type { EnvironmentSummary } from './types';

const AT = '2026-11-04T03:00:00Z';
const environment = (kind: string): EnvironmentSummary => ({
  id: `e-${kind}`,
  name: `${kind}-env`,
  kind,
  location: null,
  coordinates: null,
  config: {},
  secretRef: null,
  connectionStatus: 'CONNECTED',
  connectionCheckedAt: AT,
  connectionError: null,
  createdAt: AT,
  updatedAt: AT,
});

describe('matrixRow', () => {
  it('어떤 환경이든 네 칸을 모두 채운다', () => {
    for (const kind of ['aws', 'gcp', 'onprem', 'azure']) {
      const { cells } = matrixRow(environment(kind));
      expect(SECURITY_CONTROLS.every((control) => cells[control].result)).toBe(true);
    }
  });

  it('모르는 환경 종류는 지어내지 않고 UNKNOWN 이다', () => {
    expect(matrixRow(environment('azure')).cells.iam).toEqual({
      result: 'UNKNOWN',
      findingCount: 0,
    });
  });

  it('접속하지 못한 환경은 통과로 보이지 않는다', () => {
    const failed = { ...environment('aws'), connectionStatus: 'FAILED' as const };
    expect(matrixRow(failed).cells.iam.result).toBe('UNKNOWN');
  });

  it('시뮬레이션 값에는 이전을 막는 FAIL 이 없다', () => {
    for (const kind of ['aws', 'gcp', 'onprem']) {
      const { cells } = matrixRow(environment(kind));
      expect(SECURITY_CONTROLS.some((control) => cells[control].result === 'FAIL')).toBe(false);
    }
  });
});

describe('compareCells', () => {
  const pass = { result: 'PASS', findingCount: 0 } as const;

  it('도착 환경이 FAIL 이면 이전을 막는다', () => {
    const fail = { result: 'FAIL', findingCount: 1 } as const;
    expect(compareCells('auditLog', pass, fail).blocksMigration).toBe(true);
  });

  it('WARN 과 UNKNOWN 은 막지 않는다', () => {
    expect(compareCells('policy', pass, { result: 'WARN', findingCount: 2 }).blocksMigration).toBe(
      false,
    );
    expect(
      compareCells('encryption', pass, { result: 'UNKNOWN', findingCount: 0 }).blocksMigration,
    ).toBe(false);
  });
});
