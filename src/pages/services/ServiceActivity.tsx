import { History } from 'lucide-react';
import { AuditRow } from '@/components/AuditRow';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuditLogs } from '@/lib/api/audit';
import type { AuditLog, ServiceDetail } from '@/lib/api/types';
import { t } from '@/lib/i18n';

/** 줄을 누르면 그 일이 일어난 곳으로 간다. 갈 곳이 없는 줄은 글자만 둔다 */
function activityLink(log: AuditLog, orgSlug: string, serviceId: string) {
  if (log.target?.type === 'deploy_request')
    return `/o/${orgSlug}/services/${serviceId}/deploys/${log.target.id}`;
  if (log.target?.type === 'migration_plan') return `/o/${orgSlug}/migrations/${log.target.id}`;
  return undefined;
}

/** 이 서비스의 변경 · 배포 · 이전을 한 줄기로 본다. 서버 검색이 이름표를 본다 */
export function ServiceActivity({
  open,
  onOpenChange,
  orgId,
  orgSlug,
  service,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgSlug: string;
  service: ServiceDetail;
}) {
  const activity = useAuditLogs(open ? orgId : undefined, { q: service.name, includeReads: false });
  const logs = activity.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-3 overflow-y-auto p-4">
        <SheetHeader className="p-0">
          <SheetTitle>{t('Activity')}</SheetTitle>
          <SheetDescription>{service.name}</SheetDescription>
        </SheetHeader>
        {activity.isError ? (
          <ErrorState error={activity.error} onRetry={() => activity.refetch()} />
        ) : activity.isPending ? (
          <Skeleton className="h-32" />
        ) : logs.length === 0 ? (
          <EmptyState
            icon={History}
            title={t('No activity yet')}
            description={t('Changes to this service will show here.')}
          />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {logs.map((log) => (
              <AuditRow
                key={log.id}
                log={log}
                to={activityLink(log, orgSlug, service.id)}
                onNavigate={() => onOpenChange(false)}
              />
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
