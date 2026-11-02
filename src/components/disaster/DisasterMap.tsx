import type { MouseEvent } from 'react';
import type { EnvironmentSummary } from '@/lib/api/types';
import { environmentCoordinates, type LatLng, MAP_CITIES } from '@/lib/geo';

// 일본·한국을 덮는 단순 지도(정거원통 투영). 해안선 없이 격자와 도시만 그린다.
// 실제 지도 타일은 S01-D 화면 작업에서 붙인다
const BOUNDS = { north: 42, south: 30, west: 124, east: 146 };
const WIDTH = 440;
const KM_PER_DEG = 111;
const MID_LAT = (BOUNDS.north + BOUNDS.south) / 2;
const PX_PER_KM =
  WIDTH / ((BOUNDS.east - BOUNDS.west) * KM_PER_DEG * Math.cos((MID_LAT * Math.PI) / 180));
const HEIGHT = Math.round((BOUNDS.north - BOUNDS.south) * KM_PER_DEG * PX_PER_KM);

function project(point: LatLng) {
  return {
    x: (point.lng - BOUNDS.west) * KM_PER_DEG * Math.cos((MID_LAT * Math.PI) / 180) * PX_PER_KM,
    y: (BOUNDS.north - point.lat) * KM_PER_DEG * PX_PER_KM,
  };
}

function unproject(x: number, y: number): LatLng {
  return {
    lat: BOUNDS.north - y / (KM_PER_DEG * PX_PER_KM),
    lng: BOUNDS.west + x / (KM_PER_DEG * Math.cos((MID_LAT * Math.PI) / 180) * PX_PER_KM),
  };
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
  const center = project(epicenter);

  function handleClick(event: MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    onPick(unproject(x, y));
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: 진원지는 지도 아래 선택 상자로도 고를 수 있다
    <svg
      role="img"
      aria-label="Map. Click to set the epicenter."
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full cursor-crosshair rounded-md bg-globe-sphere"
      onClick={handleClick}
    >
      <title>Disaster map</title>
      {Array.from({ length: BOUNDS.east - BOUNDS.west + 1 }, (_, index) => BOUNDS.west + index)
        .filter((lng) => lng % 2 === 0)
        .map((lng) => {
          const { x } = project({ lat: BOUNDS.north, lng });
          return (
            <line
              key={`lng-${lng}`}
              x1={x}
              x2={x}
              y1={0}
              y2={HEIGHT}
              className="stroke-globe-grid"
            />
          );
        })}
      {Array.from({ length: BOUNDS.north - BOUNDS.south + 1 }, (_, index) => BOUNDS.south + index)
        .filter((lat) => lat % 2 === 0)
        .map((lat) => {
          const { y } = project({ lat, lng: BOUNDS.west });
          return (
            <line
              key={`lat-${lat}`}
              x1={0}
              x2={WIDTH}
              y1={y}
              y2={y}
              className="stroke-globe-grid"
            />
          );
        })}
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
      <circle
        cx={center.x}
        cy={center.y}
        r={radiusKm * PX_PER_KM}
        className="fill-danger-bg stroke-danger-solid"
        fillOpacity={0.6}
        strokeDasharray="4 3"
      />
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
