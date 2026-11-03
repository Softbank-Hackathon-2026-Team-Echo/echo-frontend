import { describe, expect, it } from 'vitest';
import { routePattern } from './route-pattern';

describe('routePattern', () => {
  it('조직 slug 와 id 를 이름으로 바꾼다', () => {
    expect(routePattern('/o/kimdoyoung1110')).toBe('/o/:slug');
    expect(routePattern('/o/acme/migrations/plan-1234abcd')).toBe('/o/:slug/migrations/:id');
    expect(
      routePattern(
        '/o/acme/services/9ec33784-5d6c-4b05-8337-c6feb2f136e1/deploys/0a1b2c3d-1111-2222-3333-444455556666',
      ),
    ).toBe('/o/:slug/services/:id/deploys/:id');
  });

  it('고정 경로는 그대로 둔다', () => {
    expect(routePattern('/')).toBe('/');
    expect(routePattern('/login')).toBe('/login');
    expect(routePattern('/o/acme/evacuation/plan')).toBe('/o/:slug/evacuation/plan');
  });
});
