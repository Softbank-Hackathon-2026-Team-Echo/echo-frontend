import { describe, expect, it } from 'vitest';
import { cellFindingIds, cellIssueCount } from './security';
import type { SecurityMatrixCell } from './types';

const AT = '2026-11-04T03:00:00Z';

describe('서버 칸', () => {
  const check = (result: 'PASS' | 'WARN' | 'FAIL', findingIds: string[]) => ({
    controlId: 'C-IMG-1' as const,
    title: 'Image',
    result,
    isMandatory: true,
    reasons: [],
    findingIds,
    mode: 'REAL' as const,
    checkedAt: AT,
    expiresAt: AT,
    serviceId: null,
    gateStatus: 'PASS' as const,
    exception: null,
  });
  const cell: SecurityMatrixCell = {
    result: 'WARN',
    findingCount: 3,
    hasException: false,
    gateStatus: 'PASS',
    exception: null,
    mode: 'REAL',
    checkedAt: AT,
    expiresAt: AT,
    controls: [check('PASS', ['a', 'b']), check('WARN', ['b', 'c'])],
  };

  it('칸 건수는 증거 수가 아니라 문제 통제 수다', () => {
    expect(cellIssueCount(cell)).toBe(1);
  });

  it('칸의 증거 id 는 겹치지 않게 모은다', () => {
    expect(cellFindingIds(cell)).toEqual(['a', 'b', 'c']);
    expect(cellFindingIds(undefined)).toEqual([]);
  });
});
