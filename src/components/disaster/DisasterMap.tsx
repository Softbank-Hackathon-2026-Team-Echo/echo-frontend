import { geoCircle, geoGraticule10, geoMercator, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, MultiLineString } from 'geojson';
import { type MouseEvent, useEffect, useMemo, useState } from 'react';
import type { EnvironmentSummary } from '@/lib/api/types';
import { environmentCoordinates, type LatLng, MAP_CITIES } from '@/lib/geo';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// 일본·한국을 덮는 지도(메르카토르). 해안선은 world-atlas 50m 에서 이 둘레만 잘라 둔 것이다
const BOUNDS = { north: 42, south: 30, west: 124, east: 146 };
const WIDTH = 440;
const HEIGHT = 320;

const projection = geoMercator().fitExtent(
  [
    [0, 0],
    [WIDTH, HEIGHT],
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
const path = geoPath(projection);
const graticule = path(geoGraticule10()) ?? '';

function project(point: LatLng) {
  const [x, y] = projection([point.lng, point.lat]) ?? [0, 0];
  return { x, y };
}

type Land = { countries: FeatureCollection; borders: MultiLineString };

let landCache: Promise<Land> | undefined;

/** 해안선·국경. 지도 둘레만 잘라 둔 파일(scripts/trim-atlas.mjs)을 지도를 처음 열 때 한 번 불러온다 */
function loadLand(): Promise<Land> {
  landCache ??= import('@/assets/geo/east-asia-50m.json').then((module) => module.default as Land);
  return landCache;
}

function useLand() {
  const [land, setLand] = useState<Land>();
  useEffect(() => {
    let alive = true;
    loadLand()
      .then((next) => {
        if (alive) setLand(next);
      })
      .catch(() => {
        // 해안선이 없어도 격자·도시·반경으로 진원지를 고를 수 있다
      });
    return () => {
      alive = false;
    };
  }, []);
  return land;
}

type DisasterMapProps = {
  epicenter: LatLng;
  radiusKm: number;
  environments: EnvironmentSummary[];
  affected: Set<string>;
  /** 없으면 읽기 전용 지도다(재난 도착 연출) */
  onPick?: (point: LatLng) => void;
  /** 진원지에서 영향 반경까지 퍼지는 파동. 움직임 줄이기면 CSS 가 멈춘다 */
  ripple?: boolean;
};

const EARTH_RADIUS_KM = 6371;
/** 파동 세 겹. 한 겹이 1.8초에 반경까지 퍼진다 */
const RIPPLE_DELAYS_S = [0, 0.6, 1.2];

/** 지도를 눌러 진원지를 정한다(onPick 이 있을 때). 반경 안의 환경 점은 빨간색 */
export function DisasterMap({
  epicenter,
  radiusKm,
  environments,
  affected,
  onPick,
  ripple = false,
}: DisasterMapProps) {
  const land = useLand();
  const center = project(epicenter);
  // 반경은 지구 표면 위의 원이라 메르카토르에서는 위도에 따라 살짝 늘어난다
  const radiusPath = useMemo(
    () =>
      path(
        geoCircle()
          .center([epicenter.lng, epicenter.lat])
          .radius((radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI))() as Feature['geometry'],
      ) ?? '',
    [epicenter.lat, epicenter.lng, radiusKm],
  );

  function handleClick(event: MouseEvent<SVGSVGElement>) {
    if (!onPick) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    const picked = projection.invert?.([x, y]);
    if (picked) onPick({ lat: picked[1], lng: picked[0] });
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: 진원지는 지도 아래 선택 상자로도 고를 수 있다
    <svg
      role="img"
      aria-label={onPick ? t('Map. Click to set the epicenter.') : t('Map of the impact radius')}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={cn('w-full rounded-md bg-globe-sphere', onPick && 'cursor-crosshair')}
      onClick={handleClick}
    >
      <title>{t('Disaster map')}</title>
      <path d={graticule} className="fill-none stroke-globe-grid" />
      {land && (
        <>
          <path d={path(land.countries) ?? ''} className="fill-globe-land stroke-globe-coast" />
          <path
            d={path(land.borders) ?? ''}
            className="fill-none stroke-globe-coast"
            strokeDasharray="2 2"
          />
        </>
      )}
      {MAP_CITIES.map((city) => {
        const point = project(city.coordinates);
        return (
          <g key={city.key}>
            <circle cx={point.x} cy={point.y} r={2.5} className="fill-globe-land-far" />
            <text x={point.x + 5} y={point.y - 4} className="fill-fg-muted text-caption">
              {city.label}
            </text>
          </g>
        );
      })}
      <path
        d={radiusPath}
        className="fill-danger-bg stroke-danger-solid"
        fillOpacity={0.6}
        strokeDasharray="4 3"
      />
      {ripple &&
        RIPPLE_DELAYS_S.map((delay) => (
          <path
            key={delay}
            d={radiusPath}
            data-testid="disaster-ripple"
            className="disaster-ripple fill-none stroke-danger-solid"
            strokeWidth={2}
            style={{
              transformOrigin: `${center.x}px ${center.y}px`,
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      {environments.map((environment) => {
        const coordinates = environmentCoordinates(environment);
        if (!coordinates) return null;
        const point = project(coordinates);
        const risky = affected.has(environment.id);
        return (
          <g key={environment.id}>
            <circle
              cx={point.x}
              cy={point.y}
              r={5}
              className={
                risky ? 'fill-danger-solid stroke-surface' : 'fill-success-solid stroke-surface'
              }
              strokeWidth={1.5}
            />
            <text x={point.x + 8} y={point.y + 12} className="fill-fg text-caption">
              {environment.name}
            </text>
          </g>
        );
      })}
      <path
        d="M0,-7 L2,-2 L7,-2 L3,1 L4.5,6 L0,3 L-4.5,6 L-3,1 L-7,-2 L-2,-2 Z"
        transform={`translate(${center.x} ${center.y})`}
        className="fill-danger-solid"
      />
    </svg>
  );
}
