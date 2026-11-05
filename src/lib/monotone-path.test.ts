import { describe, expect, it } from 'vitest';
import { monotonePath, spreadPositions } from './monotone-path';

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

describe('spreadPositions', () => {
  it('간격이 넉넉하면 시간 비율 그대로다', () => {
    expect(spreadPositions([0, 50, 100], 0.1)).toEqual([0, 0.5, 1]);
  });

  it('붙어 있는 시각은 최소 간격만큼 벌린다', () => {
    const [, second = 0] = spreadPositions([0, 2, 100], 0.12);
    expect(second).toBeGreaterThan(0.1);
  });

  it('순서를 지키고 0에서 1까지 간다', () => {
    const positions = spreadPositions([0, 1, 2, 90, 100], 0.12);
    expect(positions[0]).toBe(0);
    expect(positions.at(-1)).toBe(1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('같은 시각은 같은 위치다', () => {
    const positions = spreadPositions([0, 10, 10, 100], 0.05);
    expect(positions[1]).toBe(positions[2]);
  });

  it('시간 폭이 없으면 모두 0이다', () => {
    expect(spreadPositions([5, 5], 0.1)).toEqual([0, 0]);
  });
});
