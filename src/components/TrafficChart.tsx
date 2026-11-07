import { t } from '@/lib/i18n';
import type { WeightPoint } from '@/lib/migration-metrics';
import { spreadPositions } from '@/lib/monotone-path';

const WIDTH = 560;
const HEIGHT = 180;
const PAD = { top: 12, right: 8, bottom: 20, left: 32 };
// 시작 직후 첫 단계가 수직선처럼 꺾여 보이지 않게 구간마다 차지할 최소 폭. 가로축에 시간 눈금이 없어 비율 값은 그대로다
const MIN_SEGMENT_SHARE = 0.14;

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
  const chartWidth = WIDTH - PAD.left - PAD.right;
  const positions = spreadPositions(
    points.map((point) => point.at),
    MIN_SEGMENT_SHARE,
  );
  const xByTime = new Map(
    points.map((point, index) => [point.at, PAD.left + (positions[index] ?? 0) * chartWidth]),
  );
  const x = (at: number) => xByTime.get(at) ?? PAD.left;
  const y = (value: number) => PAD.top + (1 - value / 100) * (HEIGHT - PAD.top - PAD.bottom);
  const errors = points.filter((point) => point.errorRate !== null);
  const line = (value: (point: WeightPoint) => number) =>
    points
      .map((point, index) =>
        index === 0 ? `M${x(point.at)},${y(value(point))}` : `H${x(point.at)} V${y(value(point))}`,
      )
      .join(' ');
  const sourceLine = line((point) => point.source);
  const targetLine = line((point) => point.target);
  // 적용 시각 전까지 직전 비율을 유지한다. 막대·숫자와 달리 그래프는 보간하지 않는다
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
            d={`${targetLine} V${y(0)} H${PAD.left} Z`}
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
