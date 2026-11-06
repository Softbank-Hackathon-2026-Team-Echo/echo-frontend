import { Activity } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Panel } from '@/components/Panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { METRICS_RANGES, type MetricsRange, useServiceMetrics } from '@/lib/api/metrics';
import { useOrgMigrationPlans } from '@/lib/api/migrations';
import type { DeployRequestSummary, ServiceDetail } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { shortSha } from '@/lib/status';
import { cn } from '@/lib/utils';
import { type ChartMarker, MetricsChart } from './MetricsChart';

const RANGE_MS: Record<MetricsRange, number> = {
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '6h': 6 * 60 * 60_000,
};

function percent(value: number | null | undefined, digits = 2) {
  return value === null || value === undefined ? '—' : `${(value * 100).toFixed(digits)}%`;
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-line bg-surface p-4">
      <span className="text-small text-fg-secondary">{label}</span>
      <span className={cn('text-metric-xl tabular-nums', value === '—' && 'text-fg-muted')}>
        {value}
      </span>
      {hint && <span className="text-caption text-fg-muted">{hint}</span>}
    </div>
  );
}

/** 배포 끝 시각과 이전 시작·끝 시각을 그래프의 세로 점선으로 (Railway 배포 표시) */
export function chartMarkers(
  history: DeployRequestSummary[] | undefined,
  plans: { startedAt: string | null; finishedAt: string | null; status: string }[],
): ChartMarker[] {
  const markers: ChartMarker[] = [];
  for (const item of history ?? []) {
    const finishedAt = item.stageTimes.finishedAt;
    if (!finishedAt) continue;
    if (item.status !== 'SUCCEEDED' && item.status !== 'FAILED') continue;
    markers.push({
      at: new Date(finishedAt).getTime(),
      label: t('Deploy {{sha}} · {{env}}', {
        sha: shortSha(item.commitSha),
        env: item.environment.name,
      }),
      tone: item.status === 'FAILED' ? 'failed' : 'deploy',
    });
  }
  for (const plan of plans) {
    if (plan.startedAt) {
      markers.push({
        at: new Date(plan.startedAt).getTime(),
        label: t('Migration started'),
        tone: 'migration',
      });
    }
    if (plan.finishedAt && plan.startedAt) {
      markers.push({
        at: new Date(plan.finishedAt).getTime(),
        label: t('Migration finished'),
        tone: 'migration',
      });
    }
  }
  return markers.sort((a, b) => a.at - b.at);
}

/** 서비스 하나의 대시보드: 요약 KPI 와 환경별 요청 · p95 그래프 (진입점 Prometheus) */
export function ServiceMetrics({
  orgId,
  service,
  history,
}: {
  orgId: string;
  service: ServiceDetail;
  history: DeployRequestSummary[] | undefined;
}) {
  const [range, setRange] = useState<MetricsRange>('15m');
  const metrics = useServiceMetrics(orgId, service.id, range);
  const plans = useOrgMigrationPlans(orgId, [service.id]);
  const serving = service.environments.find((link) => link.role === 'SERVING');

  const picker = (
    <Tabs value={range} onValueChange={(value) => setRange(value as MetricsRange)}>
      <TabsList aria-label={t('Time range')}>
        {METRICS_RANGES.map((value) => (
          <TabsTrigger key={value} value={value}>
            {value}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  if (metrics.error) return <ErrorState error={metrics.error} onRetry={() => metrics.refetch()} />;
  const data = metrics.data;
  const summary = data?.summary;
  const to = data ? new Date(data.asOf).getTime() : Date.now();
  const from = to - RANGE_MS[range];
  const markers = chartMarkers(history, plans.data);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-5 gap-4 max-wide:grid-cols-3 max-sm:grid-cols-2">
        <Tile label={t('Success rate')} value={percent(summary?.successRate)} />
        <Tile
          label={t('p95 latency')}
          value={summary?.p95Ms == null ? '—' : `${Math.round(summary.p95Ms)} ms`}
        />
        <Tile
          label={t('Replication lag')}
          value={
            summary?.replicationLagMs == null ? '—' : `${Math.round(summary.replicationLagMs)} ms`
          }
        />
        <Tile
          label={t('Error budget left')}
          value={percent(summary?.errorBudgetLeft, 0)}
          hint={
            summary
              ? t('SLO {{target}} over {{range}}', { target: percent(summary.sloTarget, 1), range })
              : undefined
          }
        />
        <Tile
          label={t('Traffic on primary')}
          value={serving ? `${serving.trafficWeight}%` : '—'}
          hint={serving?.environment.name}
        />
      </div>
      <Panel title={t('Requests')} action={picker}>
        {metrics.isPending ? (
          <Skeleton className="h-48" />
        ) : data?.metricsStatus === 'NOT_CONFIGURED' ? (
          <EmptyState
            icon={Activity}
            title={t('Metrics are not connected')}
            description={t('The entrypoint Prometheus address is not set on the server.')}
          />
        ) : data?.metricsStatus === 'UNAVAILABLE' ? (
          <EmptyState
            icon={Activity}
            title={t("Couldn't read metrics")}
            description={t('Prometheus did not answer ({{code}}). Trying again in 15 seconds.', {
              code: data.metricsErrorCode ?? '—',
            })}
          />
        ) : (
          <div className="grid grid-cols-2 gap-6 max-wide:grid-cols-1">
            <MetricsChart
              title={t('Requests per second')}
              unit="rps"
              series={data?.series ?? []}
              value={(point) => point.rps}
              from={from}
              to={to}
              markers={markers}
            />
            <MetricsChart
              title={t('p95 latency')}
              unit="ms"
              series={data?.series ?? []}
              value={(point) => point.p95Ms}
              from={from}
              to={to}
              markers={markers}
            />
          </div>
        )}
      </Panel>
    </div>
  );
}
