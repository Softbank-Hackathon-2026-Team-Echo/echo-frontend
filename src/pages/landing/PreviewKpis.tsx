import type { Tone } from '@/lib/status';
import { cn } from '@/lib/utils';

type Kpi = {
  label: string;
  value: string;
  chip: string;
  chipTone: Tone;
  trend:
    | { kind: 'line'; points: number[] }
    | { kind: 'bars'; points: number[] }
    | { kind: 'progress'; value: number };
};

const CHIP: Record<Tone, string> = {
  neutral: 'bg-subtle text-fg-muted',
  success: 'bg-success-bg text-success-fg',
  warning: 'bg-warning-bg text-warning-fg',
  danger: 'bg-danger-bg text-danger-fg',
  migrating: 'bg-migrating-bg text-migrating-fg',
  ai: 'bg-ai-bg text-ai-fg',
};

const LINE_A = [6, 5, 6, 4, 5, 3, 4, 5, 4, 3, 4, 3, 4, 2];
const LINE_B = [5, 6, 4, 5, 6, 4, 5, 3, 5, 4, 3, 4, 3, 3];
const BARS = [3, 5, 4, 6, 5, 7, 4, 6, 5, 8, 6, 9, 7, 10];

const PREVIEW_KPIS: Record<'alert' | 'evacuating', Kpi[]> = {
  alert: [
    {
      label: 'Success rate',
      value: '99.98%',
      chip: '+0.0%',
      chipTone: 'success',
      trend: { kind: 'line', points: LINE_A },
    },
    {
      label: 'p95 latency',
      value: '182 ms',
      chip: '−4 ms',
      chipTone: 'success',
      trend: { kind: 'line', points: LINE_B },
    },
    {
      label: 'Replication lag',
      value: '120 ms',
      chip: '+40 ms',
      chipTone: 'warning',
      trend: { kind: 'bars', points: BARS },
    },
    {
      label: 'Traffic on primary',
      value: '100%',
      chip: 'AWS Tokyo',
      chipTone: 'success',
      trend: { kind: 'progress', value: 100 },
    },
    {
      label: 'Error budget left',
      value: '72%',
      chip: '30 d',
      chipTone: 'success',
      trend: { kind: 'progress', value: 72 },
    },
  ],
  evacuating: [
    {
      label: 'Success rate',
      value: '99.97%',
      chip: '−0.01%',
      chipTone: 'success',
      trend: { kind: 'line', points: LINE_A },
    },
    {
      label: 'p95 latency',
      value: '196 ms',
      chip: '+14 ms',
      chipTone: 'success',
      trend: { kind: 'line', points: LINE_B },
    },
    {
      label: 'Replication lag',
      value: '160 ms',
      chip: '+40 ms',
      chipTone: 'warning',
      trend: { kind: 'bars', points: BARS },
    },
    {
      label: 'Traffic on target',
      value: '70%',
      chip: 'GCP Seoul',
      chipTone: 'success',
      trend: { kind: 'progress', value: 70 },
    },
    {
      label: 'Error budget left',
      value: '72%',
      chip: '30 d',
      chipTone: 'success',
      trend: { kind: 'progress', value: 72 },
    },
  ],
};

function Trend({ trend }: { trend: Kpi['trend'] }) {
  if (trend.kind === 'progress') {
    return (
      <span className="mt-auto h-1.5 overflow-hidden rounded-full bg-subtle">
        <span className="block h-full rounded-full bg-brand" style={{ width: `${trend.value}%` }} />
      </span>
    );
  }
  const max = Math.max(...trend.points);
  if (trend.kind === 'bars') {
    return (
      <span className="mt-auto flex h-6 items-end gap-0.5">
        {trend.points.map((point, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 예시 값이라 순서가 바뀌지 않는다
            key={index}
            className={cn(
              'flex-1 rounded-xs',
              index >= trend.points.length - 4 ? 'bg-chart-6' : 'bg-line',
            )}
            style={{ height: `${(point / max) * 100}%` }}
          />
        ))}
      </span>
    );
  }
  const step = 100 / (trend.points.length - 1);
  const path = trend.points
    .map((point, index) => `${index * step},${24 - (point / max) * 20}`)
    .join(' ');
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      className="mt-auto h-6 w-full"
    >
      <polyline
        points={path}
        fill="none"
        vectorEffect="non-scaling-stroke"
        className="stroke-chart-1"
        strokeWidth={1.5}
      />
    </svg>
  );
}

/** 제품 화면 그림의 KPI 칸 5개 (Figma Stat Tile) */
export function PreviewKpis({ variant }: { variant: 'alert' | 'evacuating' }) {
  return (
    <div className="grid grid-cols-5 gap-2 max-sm:grid-cols-2">
      {PREVIEW_KPIS[variant].map((kpi) => (
        <div
          key={kpi.label}
          className="flex min-h-24 flex-col gap-1 rounded-lg border border-line bg-surface p-2.5"
        >
          <span className="text-caption text-fg-secondary">{kpi.label}</span>
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-metric tabular-nums">{kpi.value}</span>
            <span className={cn('rounded-sm px-1 text-caption', CHIP[kpi.chipTone])}>
              {kpi.chip}
            </span>
          </span>
          <Trend trend={kpi.trend} />
        </div>
      ))}
    </div>
  );
}
