import { describe, expect, it } from 'vitest';
import { radiusForMagnitude, withEpicenterLabel } from './disasters';
import type { Disaster } from './types';

describe('radiusForMagnitude', () => {
  it('서버와 같은 식이다', () => {
    expect(radiusForMagnitude(7.2)).toBe(302);
    expect(radiusForMagnitude(7)).toBe(253);
  });

  it('규모가 클수록 반경이 넓다', () => {
    expect(radiusForMagnitude(8)).toBeGreaterThan(radiusForMagnitude(6));
  });
});

describe('withEpicenterLabel', () => {
  it('서버가 주지 않는 진원지 이름을 좌표로 만든다', () => {
    const disaster = { epicenter: { lat: 35.2, lng: 139.4 } } as Disaster;
    expect(withEpicenterLabel(disaster).epicenterLabel).toBe('near Tokyo');
  });
});
