import { describe, expect, it } from 'vitest';
import { monotonePath } from './monotone-path';

/** path 의 제어점 y 값을 모두 꺼낸다. 곡선은 제어점이 만드는 범위를 벗어나지 않는다 */
function controlYs(path: string) {
  return [...path.matchAll(/[\d.-]+,([\d.-]+)/g)].map((match) => Number(match[1]));
}

describe('monotonePath', () => {
  it('점이 없으면 빈 경로다', () => {
    expect(monotonePath([])).toBe('');
  });

  it('모든 점을 지난다', () => {
    const path = monotonePath([
      { x: 0, y: 100 },
      { x: 10, y: 90 },
      { x: 30, y: 0 },
    ]);
    expect(path.startsWith('M0,100')).toBe(true);
    expect(path).toContain(' 10,90 ');
    expect(path.endsWith(' 30,0')).toBe(true);
  });

  it('값이 급하게 바뀌어도 양 끝 값을 넘지 않는다', () => {
    const ys = controlYs(
      monotonePath([
        { x: 0, y: 100 },
        { x: 50, y: 100 },
        { x: 51, y: 0 },
        { x: 100, y: 0 },
      ]),
    );
    expect(Math.max(...ys)).toBeLessThanOrEqual(100);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
  });

  it('되돌아가는 지점에서도 값을 넘지 않는다', () => {
    const ys = controlYs(
      monotonePath([
        { x: 0, y: 100 },
        { x: 10, y: 0 },
        { x: 20, y: 100 },
      ]),
    );
    expect(Math.max(...ys)).toBeLessThanOrEqual(100);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
  });

  it('x 가 같은 점은 나중 값만 쓴다', () => {
    const path = monotonePath([
      { x: 0, y: 100 },
      { x: 0, y: 50 },
      { x: 10, y: 0 },
    ]);
    expect(path.startsWith('M0,50')).toBe(true);
  });
});
