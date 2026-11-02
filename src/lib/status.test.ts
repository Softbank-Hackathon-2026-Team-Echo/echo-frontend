import { describe, expect, it } from 'vitest';
import { hasRole } from './roles';
import { connectionStatusView } from './status';

describe('connectionStatusView', () => {
  it('아는 값은 정해진 문구와 색으로 바꾼다', () => {
    expect(connectionStatusView('CONNECTED')).toEqual({ label: 'Connected', tone: 'success' });
  });

  it('모르는 값은 원래 값을 중립 색으로 보여 준다', () => {
    expect(connectionStatusView('DEGRADED')).toEqual({ label: 'DEGRADED', tone: 'neutral' });
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
