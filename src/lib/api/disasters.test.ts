import { describe, expect, it } from 'vitest';
import { distanceKm } from '../geo';
import {
  EVACUATION_MIN_MAGNITUDE,
  meetsEvacuationThreshold,
  previewDisaster,
  radiusForMagnitude,
} from './disasters';

const environments = [
  { id: 'tokyo', location: 'ap-northeast-1' },
  { id: 'seoul', location: 'asia-northeast3' },
  { id: 'fukuoka', location: 'fukuoka' },
  { id: 'nowhere', location: 'atlantis' },
];

describe('radiusForMagnitude', () => {
  it('계약 예시처럼 규모 7.2 는 약 300km 다', () => {
    expect(radiusForMagnitude(7.2)).toBeGreaterThanOrEqual(290);
    expect(radiusForMagnitude(7.2)).toBeLessThanOrEqual(310);
  });

  it('규모가 클수록 반경이 넓다', () => {
    expect(radiusForMagnitude(8)).toBeGreaterThan(radiusForMagnitude(6));
  });
});

describe('previewDisaster', () => {
  it('도쿄 근처 규모 7.2 는 도쿄만 위험하고 서울·후쿠오카는 안전하다', () => {
    const preview = previewDisaster(environments, {
      magnitude: 7.2,
      epicenter: { lat: 35.2, lng: 139.4 },
    });

    expect(preview.affected).toEqual(['tokyo']);
    expect(preview.safe).toEqual(['seoul', 'fukuoka']);
  });

  it('좌표를 모르는 환경은 판정하지 않고 따로 둔다', () => {
    const preview = previewDisaster(environments, { magnitude: 7, epicenter: { lat: 0, lng: 0 } });

    expect(preview.unknown).toEqual(['nowhere']);
  });
});

describe('distanceKm', () => {
  it('도쿄–서울은 약 1,150km 다', () => {
    const km = distanceKm({ lat: 35.68, lng: 139.69 }, { lat: 37.57, lng: 126.98 });
    expect(km).toBeGreaterThan(1100);
    expect(km).toBeLessThan(1200);
  });
});

describe('meetsEvacuationThreshold', () => {
  it('지진은 기준 규모 이상일 때만 이전 대상이다', () => {
    expect(
      meetsEvacuationThreshold({ type: 'EARTHQUAKE', magnitude: EVACUATION_MIN_MAGNITUDE }),
    ).toBe(true);
    expect(
      meetsEvacuationThreshold({ type: 'EARTHQUAKE', magnitude: EVACUATION_MIN_MAGNITUDE - 0.2 }),
    ).toBe(false);
  });

  it('태풍은 기준이 아직 없어 항상 대상이다', () => {
    expect(meetsEvacuationThreshold({ type: 'TYPHOON', magnitude: 1 })).toBe(true);
  });
});
