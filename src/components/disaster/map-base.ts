import { geoCircle, geoGraticule10, geoMercator, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, MultiLineString } from 'geojson';
import { useEffect, useState } from 'react';
import type { LatLng } from '@/lib/geo';

// 일본·한국을 덮는 지도(메르카토르). 해안선은 world-atlas 50m 에서 이 둘레만 잘라 둔 것이다
const BOUNDS = { north: 42, south: 30, west: 124, east: 146 };
export const MAP_WIDTH = 440;
export const MAP_HEIGHT = 320;
const EARTH_RADIUS_KM = 6371;

export const projection = geoMercator().fitExtent(
  [
    [0, 0],
    [MAP_WIDTH, MAP_HEIGHT],
  ],
  // 폴리곤은 감는 방향에 따라 지구 전체로 읽히므로 네 모서리 점에 맞춘다
  {
    type: 'MultiPoint',
    coordinates: [
      [BOUNDS.west, BOUNDS.south],
      [BOUNDS.east, BOUNDS.south],
      [BOUNDS.east, BOUNDS.north],
      [BOUNDS.west, BOUNDS.north],
    ],
  },
);
export const mapPath = geoPath(projection);
export const graticule = mapPath(geoGraticule10()) ?? '';

export function project(point: LatLng) {
  const [x, y] = projection([point.lng, point.lat]) ?? [0, 0];
  return { x, y };
}

export function isInMapBounds(point: LatLng): boolean {
  return (
    point.lat >= BOUNDS.south &&
    point.lat <= BOUNDS.north &&
    point.lng >= BOUNDS.west &&
    point.lng <= BOUNDS.east
  );
}

/** 반경은 지구 표면 위의 원이라 메르카토르에서는 위도에 따라 살짝 늘어난다 */
export function circlePath(center: LatLng, radiusKm: number): string {
  return (
    mapPath(
      geoCircle()
        .center([center.lng, center.lat])
        .radius((radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI))() as Feature['geometry'],
    ) ?? ''
  );
}

type Land = { countries: FeatureCollection; borders: MultiLineString };

let landCache: Promise<Land> | undefined;

/** 해안선·국경. 지도 둘레만 잘라 둔 파일(scripts/trim-atlas.mjs)을 지도를 처음 열 때 한 번 불러온다 */
function loadLand(): Promise<Land> {
  landCache ??= import('@/assets/geo/east-asia-50m.json').then((module) => module.default as Land);
  return landCache;
}

export function useLand() {
  const [land, setLand] = useState<Land>();
  useEffect(() => {
    let alive = true;
    loadLand()
      .then((next) => {
        if (alive) setLand(next);
      })
      .catch(() => {
        // 해안선이 없어도 격자·도시·반경은 그릴 수 있다
      });
    return () => {
      alive = false;
    };
  }, []);
  return land;
}
