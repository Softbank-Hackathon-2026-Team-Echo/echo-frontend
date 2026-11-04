import { describe, expect, it } from 'vitest';
import { replicationPath } from './topology-path';

describe('replicationPath', () => {
  it('두 환경 아래로 돌아 양 끝에서 끝난다', () => {
    const { path } = replicationPath(100, 200, 400, 200);
    expect(path.startsWith('M 100,200')).toBe(true);
    expect(path.endsWith('400,200')).toBe(true);
  });

  it('멀리 있는 환경일수록 깊게 돌고 글자는 가운데 아래에 있다', () => {
    const near = replicationPath(100, 200, 300, 200);
    const far = replicationPath(100, 200, 700, 200);
    expect(far.labelY).toBeGreaterThan(near.labelY);
    expect(far.labelX).toBe(400);
  });
});
