import { Link } from 'react-router';
import { AuditRow } from '@/components/AuditRow';
import { ErrorState } from '@/components/ErrorState';
import { Panel } from '@/components/Panel';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceActivity } from '@/lib/api/audit';
import { t } from '@/lib/i18n';

/** 이 서비스 이름이 들어간 최근 감사 줄(Railway Activity). 읽기 줄은 뺀다 */
export function ServiceActivity({
  orgId,
  orgSlug,
  serviceName,
}: {
  orgId: string;
  orgSlug: string;
  serviceName: string;
}) {
  const activity = useServiceActivity(orgId, serviceName);
  return (
    <Panel
      title={t('Activity')}
      action={
        <Link
          to={`/o/${orgSlug}/audit?q=${encodeURIComponent(serviceName)}`}
          className="text-small text-fg-secondary hover:underline"
        >
          {t('View all')}
        </Link>
      }
    >
      {activity.isError ? (
        <ErrorState error={activity.error} onRetry={() => activity.refetch()} />
      ) : activity.isPending ? (
        <Skeleton className="h-40" />
      ) : activity.data.items.length === 0 ? (
        <p className="text-small text-fg-muted">{t('No activity yet.')}</p>
      ) : (
        <ul className="divide-y divide-line">
          {activity.data.items.map((log) => (
            <AuditRow key={log.id} log={log} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
