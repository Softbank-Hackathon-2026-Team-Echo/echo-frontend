import { t } from '@/lib/i18n';
import type { WeightPoint } from '@/lib/migration-metrics';
import { monotonePath } from '@/lib/monotone-path';

const WIDTH = 560;
const HEIGHT = 180;
const PAD = { top: 12, right: 8, bottom: 20, left: 32 };

/** A(출발, 주황)·B(도착, 남색) 트래픽 비율. 두 선이 교차하는 장면이 무중단 이전의 증거다(F7) */
export function TrafficChart({
  points,
  sourceName,
  targetName,
}: {
  points: WeightPoint[];
  sourceName: string;
  targetName: string;
}) {
  const first = points[0]?.at ?? 0;
  const last = points.at(-1)?.at ?? first + 1;
  const span = Math.max(1, last - first);
  const x = (at: number) => PAD.left + ((at - first) / span) * (WIDTH - PAD.left - PAD.right);
  const y = (value: number) => PAD.top + (1 - value / 100) * (HEIGHT - PAD.top - PAD.bottom);
  const errors = points.filter((point) => point.errorRate !== null);
  const line = (value: (point: WeightPoint) => number) =>
    monotonePath(points.map((point) => ({ x: x(point.at), y: y(value(point)) })));
  const sourceLine = line((point) => point.source);
  const targetLine = line((point) => point.target);
  // 서버가 비율을 적용한 시각만 점으로 찍는다. 곡선은 이 점들을 이은 것이고 그 사이 값은 재지 않았다
  const applied = points.filter(
    (point, index) => index > 0 && point.target !== points[index - 1]?.target,
  );

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-center gap-3 text-caption text-fg-secondary">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-xs bg-chart-3" />
          {sourceName}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-xs bg-chart-1" />
          {targetName}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-xs bg-danger-solid" />
          {t('Error rate (judged)')}
        </span>
        <span className="text-fg-muted">{t('Dots mark applied steps')}</span>
      </figcaption>
      {points.length < 2 ? (
        <p className="flex h-44 items-center justify-center text-small text-fg-muted">
          {t('The graph starts when the first traffic step is applied.')}
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-44 w-full"
          role="img"
          aria-label={t('Traffic share moving from {{source}} to {{target}}', {
            source: sourceName,
            target: targetName,
          })}
        >
          {[0, 50, 100].map((value) => (
            <g key={value}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(value)}
                y2={y(value)}
                className="stroke-line"
              />
              <text
                x={PAD.left - 6}
                y={y(value) + 3}
                textAnchor="end"
                className="fill-fg-muted text-caption"
              >
                {value}%
              </text>
            </g>
          ))}
          <path
            d={`${targetLine} V${y(0)} H${x(first)} Z`}
            className="fill-chart-1 stroke-none"
            fillOpacity={0.08}
          />
          <path
            d={sourceLine}
            className="fill-none stroke-chart-3"
            strokeWidth={2.5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={targetLine}
            className="fill-none stroke-chart-1"
            strokeWidth={2.5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {applied.map((point) => (
            <g key={point.at}>
              <circle cx={x(point.at)} cy={y(point.source)} r={3} className="fill-chart-3" />
              <circle cx={x(point.at)} cy={y(point.target)} r={3} className="fill-chart-1" />
            </g>
          ))}
          {errors.map((point) => (
            <circle
              key={point.at}
              cx={x(point.at)}
              cy={y(Math.min(100, point.errorRate ?? 0))}
              r={3}
              className="fill-danger-solid"
            >
              <title>{t('error rate {{rate}}%', { rate: point.errorRate ?? 0 })}</title>
            </circle>
          ))}
        </svg>
      )}
    </figure>
  );
}
