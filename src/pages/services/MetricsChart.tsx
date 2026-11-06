import type { ServiceMetricsSeries } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const WIDTH = 640;
const HEIGHT = 160;
const PAD = { top: 12, right: 8, bottom: 20, left: 40 };

/** 그래프 위 세로 점선 (Railway 배포 시점 표시). 배포·이전·롤백 */
export type ChartMarker = { at: number; label: string; tone: 'deploy' | 'failed' | 'migration' };

const PROVIDER_STROKE: Record<string, string> = {
  aws: 'stroke-aws',
  gcp: 'stroke-gcp',
  onprem: 'stroke-onprem',
};
const PROVIDER_FILL: Record<string, string> = {
  aws: 'bg-aws',
  gcp: 'bg-gcp',
  onprem: 'bg-onprem',
};
const MARKER_STROKE: Record<ChartMarker['tone'], string> = {
  deploy: 'stroke-success-solid',
  failed: 'stroke-danger-solid',
  migration: 'stroke-migrating-solid',
};

/**
 * 환경별 시계열 한 칸. 값이 null 인 점은 끊어 그린다(지어내지 않는다).
 * 가로축은 [from, to] 시각, 세로축은 0 부터 최댓값까지
 */
export function MetricsChart({
  title,
  unit,
  series,
  value,
  from,
  to,
  markers,
}: {
  title: string;
  unit: string;
  series: ServiceMetricsSeries[];
  value: (point: ServiceMetricsSeries['points'][number]) => number | null;
  from: number;
  to: number;
  markers: ChartMarker[];
}) {
  const span = Math.max(1, to - from);
  const chartWidth = WIDTH - PAD.left - PAD.right;
  const chartHeight = HEIGHT - PAD.top - PAD.bottom;
  const values = series.flatMap((item) =>
    item.points.map(value).filter((v): v is number => v !== null),
  );
  const max = Math.max(1, ...values) * 1.1;
  const x = (at: number) => PAD.left + ((at - from) / span) * chartWidth;
  const y = (v: number) => PAD.top + (1 - v / max) * chartHeight;

  const pathOf = (points: ServiceMetricsSeries['points']) => {
    let d = '';
    let open = false;
    for (const point of points) {
      const v = value(point);
      if (v === null) {
        open = false;
        continue;
      }
      d += `${open ? 'L' : 'M'}${x(new Date(point.t).getTime()).toFixed(1)},${y(v).toFixed(1)}`;
      open = true;
    }
    return d;
  };
  const visible = markers.filter((marker) => marker.at >= from && marker.at <= to);
  const empty = values.length === 0;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex flex-wrap items-center gap-3 text-small text-fg-secondary">
        <span className="text-label text-fg">{title}</span>
        {series.map((item) => (
          <span key={item.environmentId} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                'size-2.5 rounded-xs',
                PROVIDER_FILL[item.cloudProvider] ?? 'bg-fg-muted',
              )}
            />
            {item.environmentName}
          </span>
        ))}
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-40 w-full"
        role="img"
        aria-label={t('{{title}} by environment', { title })}
      >
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={HEIGHT - PAD.bottom}
          y2={HEIGHT - PAD.bottom}
          className="stroke-line"
        />
        <text
          x={PAD.left - 6}
          y={PAD.top + 4}
          textAnchor="end"
          className="fill-fg-muted text-caption"
        >
          {max >= 10 ? Math.round(max) : max.toFixed(1)}
        </text>
        <text
          x={PAD.left - 6}
          y={HEIGHT - PAD.bottom}
          textAnchor="end"
          className="fill-fg-muted text-caption"
        >
          0 {unit}
        </text>
        {visible.map((marker) => (
          <g key={`${marker.at}-${marker.label}`}>
            <line
              x1={x(marker.at)}
              x2={x(marker.at)}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              strokeDasharray="4 3"
              className={MARKER_STROKE[marker.tone]}
            />
            <title>{marker.label}</title>
          </g>
        ))}
        {series.map((item) => (
          <path
            key={item.environmentId}
            d={pathOf(item.points)}
            fill="none"
            strokeWidth={2}
            className={PROVIDER_STROKE[item.cloudProvider] ?? 'stroke-fg-muted'}
          />
        ))}
        {empty && (
          <text
            x={WIDTH / 2}
            y={HEIGHT / 2}
            textAnchor="middle"
            className="fill-fg-muted text-small"
          >
            {t('No requests in this range')}
          </text>
        )}
      </svg>
      {visible.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-fg-muted">
          {visible.map((marker) => (
            <li key={`${marker.at}-${marker.label}`} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  'h-3 border-l-2 border-dashed',
                  marker.tone === 'failed'
                    ? 'border-danger-solid'
                    : marker.tone === 'migration'
                      ? 'border-migrating-solid'
                      : 'border-success-solid',
                )}
              />
              {marker.label} · {new Date(marker.at).toLocaleTimeString('en-GB')}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
