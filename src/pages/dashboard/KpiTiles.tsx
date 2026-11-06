import { memo } from 'react';
import { useServiceMetrics } from '@/lib/api/metrics';
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

/** 서비스 중 서비스의 진입점 지표(최근 15분). 못 읽거나 요청이 없으면 값을 지어내지 않고 — */
function Metric({ value, caption }: { value: string | null; caption: string }) {
  return (
    <>
      <span className={cn('text-metric-xl tabular-nums', value === null && 'text-fg-muted')}>
        {value ?? '—'}
      </span>
      <span className="truncate text-caption text-fg-muted">{caption}</span>
    </>
  );
}

const pct = (value: number | null | undefined, digits: number) =>
  value === null || value === undefined ? null : `${(value * 100).toFixed(digits)}%`;
const ms = (value: number | null | undefined) =>
  value === null || value === undefined ? null : `${Math.round(value)} ms`;

/** 이전 중이면 트래픽 칸이 도착 환경 비율을 보인다 */
export type TargetTraffic = { name: string; weight: number };

/**
 * S01 KPI 타일 5개(반분할 960 은 4개, 에러 버짓을 뺀다). 트래픽 비율만 지금 API(서비스 연결 · 이전 단계)로 채운다
 */
export const KpiTiles = memo(function KpiTiles({
  orgId,
  serving,
  target,
}: {
  orgId: string;
  serving: ServiceOnEnvironment | undefined;
  target?: TargetTraffic;
}) {
  const metrics = useServiceMetrics(orgId, serving?.service.id, '15m');
  const summary = metrics.data?.summary;
  const caption =
    metrics.data?.metricsStatus === 'NOT_CONFIGURED'
      ? t('Metrics not connected')
      : metrics.data?.metricsStatus === 'UNAVAILABLE'
        ? t("Couldn't read metrics")
        : serving
          ? t('{{name}} · last 15 min', { name: serving.service.name })
          : t('No serving service');
  const weight = target?.weight ?? serving?.link.trafficWeight ?? 0;
  const envName = target?.name ?? serving?.link.environment.name;
  const hasValue = Boolean(target || serving);
  return (
    <div className="grid grid-cols-5 gap-4 max-wide:grid-cols-4 max-wide:gap-3 max-sm:grid-cols-2">
      <Tile label={t('Success rate')}>
        <Metric value={pct(summary?.successRate, 2)} caption={caption} />
      </Tile>
      <Tile label={t('p95 latency')}>
        <Metric value={ms(summary?.p95Ms)} caption={caption} />
      </Tile>
      <Tile label={t('Replication lag')}>
        <Metric value={ms(summary?.replicationLagMs)} caption={caption} />
      </Tile>
      <Tile label={target ? t('Traffic on target') : t('Traffic on primary')}>
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
        <Metric value={pct(summary?.errorBudgetLeft, 0)} caption={t('SLO 99.9%')} />
      </Tile>
    </div>
  );
});
