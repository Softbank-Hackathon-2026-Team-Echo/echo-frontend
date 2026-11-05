import { describe, expect, it } from 'vitest';
import { configValue, isActivePrecheck, parseDiff } from './prechecks';

describe('isActivePrecheck', () => {
  it('끝나지 않은 상태만 진행 중이다', () => {
    expect(isActivePrecheck('QUEUED')).toBe(true);
    expect(isActivePrecheck('RUNNING')).toBe(true);
    expect(isActivePrecheck('TIMED_OUT')).toBe(false);
    expect(isActivePrecheck(undefined)).toBe(false);
  });
});

describe('parseDiff', () => {
  it('통합 diff 를 줄 종류로 나누고 파일 머리줄은 뺀다', () => {
    const diff = '--- a/app.yaml\n+++ b/app.yaml\n@@ -1 +1 @@\n keep\n-old\n+new\n';
    expect(parseDiff(diff)).toEqual([
      { kind: 'context', text: '@@ -1 +1 @@' },
      { kind: 'context', text: 'keep' },
      { kind: 'removed', text: 'old' },
      { kind: 'added', text: 'new' },
    ]);
  });
});

describe('configValue', () => {
  it('문자열은 그대로, 값이 없으면 —, 그 밖은 JSON 이다', () => {
    expect(configValue('ap-northeast-1')).toBe('ap-northeast-1');
    expect(configValue(null)).toBe('—');
    expect(configValue(undefined)).toBe('—');
    expect(configValue({ a: 1 })).toBe('{"a":1}');
  });
});
