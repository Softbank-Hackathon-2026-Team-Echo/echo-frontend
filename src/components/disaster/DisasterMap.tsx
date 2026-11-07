import { geoCircle, geoGraticule10, geoMercator, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, MultiLineString } from 'geojson';
import { type MouseEvent, useEffect, useMemo, useState } from 'react';
import type { EnvironmentSummary } from '@/lib/api/types';
import { environmentCoordinates, type LatLng, MAP_CITIES } from '@/lib/geo';
import { t } from '@/lib/i18n';

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

// 같은 도시에 있는 환경(서울의 GCP · 온프레)은 점이 겹친다. 이름은 한 줄씩 아래로 내려 겹치지 않게 한다
const LABEL_LINE = 13;
const SAME_PLACE_PX = 12;

function stackLabels(environments: EnvironmentSummary[]) {
  const placed: {
    environment: EnvironmentSummary;
    point: { x: number; y: number };
    stack: number;
  }[] = [];
  for (const environment of environments) {
    const coordinates = environmentCoordinates(environment);
    if (!coordinates) continue;
    const point = project(coordinates);
    const stack = placed.filter(
      (item) => Math.hypot(item.point.x - point.x, item.point.y - point.y) < SAME_PLACE_PX,
    ).length;
    placed.push({ environment, point, stack });
  }
  return placed;
}

type DisasterMapProps = {
  epicenter: LatLng;
  radiusKm: number;
  environments: EnvironmentSummary[];
  affected: Set<string>;
  onPick: (point: LatLng) => void;
};

const EARTH_RADIUS_KM = 6371;

/** 지도를 눌러 진원지를 정한다. 반경 안의 환경 점은 빨간색 */
export function DisasterMap({
  epicenter,
  radiusKm,
  environments,
  affected,
  onPick,
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
  const placed = useMemo(() => stackLabels(environments), [environments]);

  function handleClick(event: MouseEvent<SVGSVGElement>) {
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
      aria-label={t('Map. Click to set the epicenter.')}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full cursor-crosshair rounded-md bg-globe-sphere"
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
      {placed.map(({ environment, point, stack }) => {
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
            <text
              x={point.x + 8}
              y={point.y + 12 + stack * LABEL_LINE}
              className="fill-fg text-caption"
            >
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
