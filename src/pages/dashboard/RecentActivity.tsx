import { History } from 'lucide-react';
import { Link } from 'react-router';
import { AuditRow } from '@/components/AuditRow';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Panel } from '@/components/Panel';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecentActivity } from '@/lib/api/audit';
import { t } from '@/lib/i18n';

/** 대시보드 최근 활동: 감사 로그 최신 3줄 */
export function RecentActivity({
  orgId,
  orgSlug,
  className,
}: {
  orgId: string;
  orgSlug: string;
  className?: string;
}) {
  const activity = useRecentActivity(orgId);

  return (
    <Panel
      title={t('Recent activity')}
      className={className}
      action={
        <Link to={`/o/${orgSlug}/audit`} className="text-small text-brand hover:underline">
          {t('View all')}
        </Link>
      }
    >
      {activity.isError ? (
        <ErrorState error={activity.error} onRetry={() => activity.refetch()} />
      ) : activity.isPending ? (
        <Skeleton className="h-32" />
      ) : activity.data.items.length === 0 ? (
        <EmptyState
          icon={History}
          title={t('No activity yet')}
          description={t('Approvals, deploys and agent actions will show here.')}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {activity.data.items.map((log) => (
            <AuditRow key={log.id} log={log} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
