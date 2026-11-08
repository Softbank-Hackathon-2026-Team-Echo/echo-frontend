import { memo } from 'react';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import type { ServiceMetricsStatus, ServiceMetricsSummary } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ServiceOnEnvironment } from './types';

function Tile({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface p-4',
        className,
      )}
    >
      <span className="text-small text-fg-secondary">{label}</span>
      {children}
    </div>
  );
}

function metricNote(status: ServiceMetricsStatus | undefined, empty: string) {
  if (status === 'UNAVAILABLE') return t('Metrics unavailable');
  if (status === 'NOT_CONFIGURED') return t('Metrics not configured');
  return status === 'OK' ? empty : t('Last 15 min');
}

/** 값이 없으면 지어내지 않고 — 와 이유를 보인다 */
function Metric({
  value,
  caption,
  empty,
  status,
  simulated,
}: {
  value: string | null;
  caption: string;
  empty: string;
  status: ServiceMetricsStatus | undefined;
  simulated: boolean;
}) {
  return (
    <>
      <span className="flex flex-wrap items-baseline gap-2">
        <span className={cn('text-metric-xl tabular-nums', !value && 'text-fg-muted')}>
          {value ?? '—'}
        </span>
        {value && simulated && <SimulatedBadge />}
      </span>
      <span className="text-caption text-fg-muted">
        {value ? caption : metricNote(status, empty)}
      </span>
    </>
  );
}

const percent = (ratio: number | null | undefined, digits: number) =>
  ratio == null ? null : `${(ratio * 100).toFixed(digits)}%`;
const milliseconds = (value: number | null | undefined) =>
  value == null ? null : `${Math.round(value)} ms`;

/** 이전 중이면 트래픽 칸이 도착 환경 비율을 보인다 */
export type TargetTraffic = { name: string; weight: number };

/**
 * S01 KPI 타일 5개(반분할 960 은 4개, 에러 버짓을 뺀다). 트래픽 비율은 서비스 연결 · 이전 단계, 나머지는 지표 API 값이다
 */
export const KpiTiles = memo(function KpiTiles({
  serving,
  target,
  observed,
  summary,
  status,
  simulated = false,
}: {
  serving: ServiceOnEnvironment | undefined;
  target?: TargetTraffic;
  /** 온프레 실시간 관측(노트북 감시자)이 등록값과 다를 때 지금 트래픽 쪽. 이전 중이면 쓰지 않는다 */
  observed?: TargetTraffic;
  summary?: ServiceMetricsSummary;
  status?: ServiceMetricsStatus;
  simulated?: boolean;
}) {
  const live = target ? undefined : observed;
  const weight = target?.weight ?? live?.weight ?? serving?.link.trafficWeight ?? 0;
  const envName = target?.name ?? live?.name ?? serving?.link.environment.name;
  const hasValue = Boolean(target || live || serving);
  const noRequests = t('No requests yet');
  const shared = { status, simulated };
  return (
    <div className="grid grid-cols-5 gap-4 max-wide:grid-cols-4 max-wide:gap-3 max-sm:grid-cols-2">
      <Tile label={t('Success rate')}>
        <Metric
          value={percent(summary?.successRate, 2)}
          caption={t('Last 15 min')}
          empty={noRequests}
          {...shared}
        />
      </Tile>
      <Tile label={t('p95 latency')}>
        <Metric
          value={milliseconds(summary?.p95Ms)}
          caption={t('Last 15 min')}
          empty={noRequests}
          {...shared}
        />
      </Tile>
      <Tile label={t('Replication lag')}>
        <Metric
          value={milliseconds(summary?.replicationLagMs)}
          caption={t('Latest check')}
          empty={t('No replication data')}
          {...shared}
        />
      </Tile>
      <Tile
        label={
          target
            ? t('Traffic on target')
            : live
              ? t('Traffic now (observed)')
              : t('Traffic on primary')
        }
      >
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="text-metric-xl tabular-nums">{hasValue ? `${weight}%` : '—'}</span>
          {envName && (
            <span className="rounded-sm bg-success-bg px-1.5 text-label text-success-fg">
              {envName}
            </span>
          )}
        </span>
        <span className="h-1.5 overflow-hidden rounded-full bg-subtle">
          <span className="block h-full rounded-full bg-brand" style={{ width: `${weight}%` }} />
        </span>
      </Tile>
      <Tile label={t('Error budget left')} className="max-wide:hidden">
        <Metric
          value={percent(summary?.errorBudgetLeft, 0)}
          caption={t('SLO {{target}}', { target: percent(summary?.sloTarget, 1) ?? '—' })}
          empty={noRequests}
          {...shared}
        />
      </Tile>
    </div>
  );
});
