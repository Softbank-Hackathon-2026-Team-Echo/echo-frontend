import { type MouseEvent, useMemo } from 'react';
import type { EnvironmentSummary } from '@/lib/api/types';
import { environmentCoordinates, type LatLng, MAP_CITIES } from '@/lib/geo';
import { t } from '@/lib/i18n';
import {
  circlePath,
  graticule,
  MAP_HEIGHT,
  MAP_WIDTH,
  mapPath,
  project,
  projection,
  useLand,
} from './map-base';

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
  const radiusPath = useMemo(() => circlePath(epicenter, radiusKm), [epicenter, radiusKm]);
  const placed = useMemo(() => stackLabels(environments), [environments]);

  function handleClick(event: MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * MAP_WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * MAP_HEIGHT;
    const picked = projection.invert?.([x, y]);
    if (picked) onPick({ lat: picked[1], lng: picked[0] });
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: 진원지는 지도 아래 선택 상자로도 고를 수 있다
    <svg
      role="img"
      aria-label={t('Map. Click to set the epicenter.')}
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      className="w-full cursor-crosshair rounded-md bg-globe-sphere"
      onClick={handleClick}
    >
      <title>{t('Disaster map')}</title>
      <path d={graticule} className="fill-none stroke-globe-grid" />
      {land && (
        <>
          <path d={mapPath(land.countries) ?? ''} className="fill-globe-land stroke-globe-coast" />
          <path
            d={mapPath(land.borders) ?? ''}
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
