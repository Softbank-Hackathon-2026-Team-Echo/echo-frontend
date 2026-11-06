import { useState } from 'react';
import type { EnvironmentMetricsSeries } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { monotonePath } from '@/lib/monotone-path';

const WIDTH = 560;
const HEIGHT = 180;
const PAD = { top: 12, right: 8, bottom: 20, left: 32 };

const LINE: Record<string, string> = {
  aws: 'stroke-aws',
  gcp: 'stroke-gcp',
  onprem: 'stroke-onprem',
};
const FILL: Record<string, string> = { aws: 'fill-aws', gcp: 'fill-gcp', onprem: 'fill-onprem' };
const KEY: Record<string, string> = { aws: 'bg-aws', gcp: 'bg-gcp', onprem: 'bg-onprem' };

const clock = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** 선이 그래프 높이를 쓰도록 값 바로 위의 읽기 좋은 수로 올린다 */
function niceMax(value: number) {
  const unit = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 3, 4, 5, 6, 8, 10].find((item) => item * unit >= value) ?? 10;
  return step * unit;
}

const drawable = (series: EnvironmentMetricsSeries[]) =>
  series.filter((item) => item.points.length >= 2);

/** 대기 환경은 평소 점이 없고, 점이 있어도 전부 0 이면 그릴 것이 없다 */
export function hasRequests(series: EnvironmentMetricsSeries[]) {
  return drawable(series).some((item) => item.points.some((point) => point.rps > 0));
}

/** 환경별 초당 요청 수. 색은 순위가 아니라 환경 종류를 따른다 */
export function RequestsChart({ series }: { series: EnvironmentMetricsSeries[] }) {
  const [hoverAt, setHoverAt] = useState<number | null>(null);
  const lines = drawable(series).map((item) => ({
    ...item,
    samples: item.points.map((point) => ({ at: Date.parse(point.t), rps: point.rps })),
  }));
  const times = [...new Set(lines.flatMap((line) => line.samples.map((item) => item.at)))].sort(
    (a, b) => a - b,
  );
  const first = times[0] ?? 0;
  const span = (times.at(-1) ?? first) - first || 1;
  const top = niceMax(
    Math.max(1, ...lines.flatMap((line) => line.samples.map((item) => item.rps))),
  );
  const chartWidth = WIDTH - PAD.left - PAD.right;
  const x = (at: number) => PAD.left + ((at - first) / span) * chartWidth;
  const y = (value: number) => PAD.top + (1 - value / top) * (HEIGHT - PAD.top - PAD.bottom);

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const at = first + ((event.clientX - box.left) / box.width) * span;
    const nearest = times.reduce(
      (best, item) => (Math.abs(item - at) < Math.abs(best - at) ? item : best),
      first,
    );
    setHoverAt(nearest);
  }

  const hoverShare = hoverAt === null ? 0 : (x(hoverAt) / WIDTH) * 100;

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-center gap-3 text-caption text-fg-secondary">
        {lines.map((line) => (
          <span key={line.environmentId} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={`size-2.5 rounded-xs ${KEY[line.cloudProvider] ?? 'bg-chart-2'}`}
            />
            {line.environmentName}
          </span>
        ))}
        <span className="text-fg-muted">{t('Requests per second')}</span>
      </figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-44 w-full"
          role="img"
          aria-label={t('Requests per second by environment, last 15 minutes')}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverAt(null)}
        >
          {[0, top / 2, top].map((value) => (
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
                {value}
              </text>
            </g>
          ))}
          <text x={PAD.left} y={HEIGHT - 4} className="fill-fg-muted text-caption">
            {clock(first)}
          </text>
          <text
            x={WIDTH - PAD.right}
            y={HEIGHT - 4}
            textAnchor="end"
            className="fill-fg-muted text-caption"
          >
            {clock(first + span)}
          </text>
          {lines.map((line) => (
            <path
              key={line.environmentId}
              d={monotonePath(line.samples.map((item) => ({ x: x(item.at), y: y(item.rps) })))}
              className={`fill-none ${LINE[line.cloudProvider] ?? 'stroke-chart-2'}`}
              strokeWidth={2}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {hoverAt !== null && (
            <g>
              <line
                x1={x(hoverAt)}
                x2={x(hoverAt)}
                y1={PAD.top}
                y2={HEIGHT - PAD.bottom}
                className="stroke-line-strong"
              />
              {lines.map((line) => {
                const sample = line.samples.find((item) => item.at === hoverAt);
                return (
                  sample && (
                    <circle
                      key={line.environmentId}
                      cx={x(hoverAt)}
                      cy={y(sample.rps)}
                      r={4}
                      className={`stroke-surface ${FILL[line.cloudProvider] ?? 'fill-chart-2'}`}
                      strokeWidth={2}
                    />
                  )
                );
              })}
            </g>
          )}
        </svg>
        {hoverAt !== null && (
          <div
            className="pointer-events-none absolute top-0 flex flex-col gap-0.5 rounded-md border border-line bg-raised p-2 text-caption whitespace-nowrap shadow-md"
            style={
              hoverShare > 50
                ? { right: `${100 - hoverShare + 2}%` }
                : { left: `${hoverShare + 2}%` }
            }
          >
            <span className="text-fg-muted">{clock(hoverAt)}</span>
            {lines.map((line) => {
              const sample = line.samples.find((item) => item.at === hoverAt);
              return (
                <span key={line.environmentId} className="flex justify-between gap-3">
                  {line.environmentName}
                  <span className="font-mono tabular-nums">
                    {sample ? sample.rps.toFixed(1) : '—'}
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </figure>
  );
}
