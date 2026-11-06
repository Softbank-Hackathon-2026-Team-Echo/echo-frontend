import { Link } from 'react-router';
import { ProviderLabel } from '@/components/ProviderLabel';
import { StatusBadge } from '@/components/StatusBadge';
import type { DeployRequestSummary, ServiceDetail } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { deployStatusView } from '@/lib/status';

/** 조직 개요의 서비스 카드. 누르면 그 서비스의 Overview 로 간다 */
export function ServiceCard({
  orgSlug,
  service,
  latest,
  changes,
  migrating,
  atRisk,
}: {
  orgSlug: string;
  service: ServiceDetail;
  latest: DeployRequestSummary | undefined;
  changes: number;
  migrating: boolean;
  atRisk: boolean;
}) {
  const serving = service.environments.find((link) => link.role === 'SERVING');
  return (
    <Link
      to={`/o/${orgSlug}/services/${service.id}`}
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-xs hover:bg-subtle"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-title">{service.name}</span>
        {latest && <StatusBadge {...deployStatusView(latest.status)} />}
      </span>
      {serving ? (
        <span className="flex items-center justify-between gap-2 text-small text-fg-secondary">
          <span className="flex min-w-0 items-center gap-2">
            <ProviderLabel kind={serving.environment.kind} showLocation={false} />
            <span className="truncate">{serving.environment.name}</span>
          </span>
          <span className="font-mono text-mono tabular-nums">{serving.trafficWeight}%</span>
        </span>
      ) : (
        <span className="text-small text-fg-muted">{t('Not serving traffic')}</span>
      )}
      {(migrating || atRisk || changes > 0) && (
        <span className="flex flex-wrap items-center gap-1.5">
          {migrating && <StatusBadge label={t('Migrating')} tone="migrating" />}
          {atRisk && <StatusBadge label={t('At risk')} tone="danger" />}
          {changes > 0 && (
            <StatusBadge
              label={
                changes === 1 ? t('1 change to apply') : t('{{n}} changes to apply', { n: changes })
              }
              tone="warning"
            />
          )}
        </span>
      )}
    </Link>
  );
}
