import { describe, expect, it } from 'vitest';
import { auditActionLabel } from './audit';

describe('재난 · 진단 행동 문구 (11/7 리허설)', () => {
  it('재난 선언 · 종료와 AI 진단 요청을 코드가 아니라 문구로 보인다', () => {
    expect(auditActionLabel('DISASTER_DECLARED')).toBe('declared disaster');
    expect(auditActionLabel('DISASTER_ENDED')).toBe('ended disaster');
    expect(auditActionLabel('DIAGNOSIS_REQUESTED')).toBe('requested AI diagnosis');
    expect(auditActionLabel('SERVICE_VARIABLE_COPIED')).toBe('copied app variable');
    expect(auditActionLabel('DISASTER_EVACUATION_SKIPPED')).toBe(
      'skipped evacuation (no safe standby)',
    );
  });
});
