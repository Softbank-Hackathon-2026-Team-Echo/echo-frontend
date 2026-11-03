import type { WeightPoint } from './run-metrics';

const WIDTH = 560;
const HEIGHT = 180;
const PAD = { top: 12, right: 8, bottom: 20, left: 32 };

function stepPath(
  points: WeightPoint[],
  value: (point: WeightPoint) => number,
  x: (at: number) => number,
  y: (v: number) => number,
) {
  return points
    .map((point, index) => {
      const px = x(point.at);
      const py = y(value(point));
      if (index === 0) return `M${px},${py}`;
      // 계단선: 이전 값으로 이 시각까지 간 뒤 새 값으로 바꾼다
      return `H${px} V${py}`;
    })
    .join(' ');
}

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
          Error rate (judged)
        </span>
      </figcaption>
      {points.length < 2 ? (
        <p className="flex h-44 items-center justify-center text-small text-fg-muted">
          The graph starts when the first traffic step is applied.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-44 w-full"
          role="img"
          aria-label={`Traffic share moving from ${sourceName} to ${targetName}`}
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
            d={stepPath(points, (point) => point.source, x, y)}
            className="fill-none stroke-chart-3"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={stepPath(points, (point) => point.target, x, y)}
            className="fill-none stroke-chart-1"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          {errors.map((point) => (
            <circle
              key={point.at}
              cx={x(point.at)}
              cy={y(Math.min(100, point.errorRate ?? 0))}
              r={3}
              className="fill-danger-solid"
            >
              <title>error rate {point.errorRate}%</title>
            </circle>
          ))}
        </svg>
      )}
    </figure>
  );
}
