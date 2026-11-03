import { CircleCheck, CircleX, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ExternalLink } from '@/components/ExternalLink';
import { ProviderLabel } from '@/components/ProviderLabel';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { isTerminalStatus, useDeployRequests, useRollback, useService } from '@/lib/api/services';
import type { DeployRequestSummary, ServiceEnvironment } from '@/lib/api/types';
import { dateTime } from '@/lib/format';
import { deployErrorLabel, deployTriggerLabel, shortSha } from '@/lib/status';
import { DeployDialog } from './DeployDialog';

/** 연결 하나의 오른쪽 배지: Serving 100% · Standby 0% · Out of sync */
function linkBadge(link: ServiceEnvironment) {
  if (link.versionStatus === 'OUT_OF_SYNC')
    return <StatusBadge label="Out of sync" tone="warning" />;
  if (link.role === 'SERVING')
    return <StatusBadge label={`Serving ${link.trafficWeight}%`} tone="success" />;
  if (link.role === 'STANDBY')
    return <StatusBadge label={`Standby ${link.trafficWeight}%`} tone="neutral" />;
  return <StatusBadge label="Not deployed" tone="neutral" />;
}

function HistoryIcon({ request }: { request: DeployRequestSummary }) {
  if (request.status === 'SUCCEEDED')
    return <CircleCheck aria-hidden className="size-5 text-success-solid" />;
  if (request.status === 'FAILED')
    return <CircleX aria-hidden className="size-5 text-danger-solid" />;
  if (isTerminalStatus(request.status))
    return <CircleX aria-hidden className="size-5 text-fg-muted" />;
  return <Loader2 aria-hidden className="size-5 animate-spin text-migrating-solid" />;
}

/** SVC 목록 오른쪽 상세 패널: 환경별 연결 · 고정 주소 · 이력 · 되돌리기 */
export function ServicePanel({
  orgId,
  orgSlug,
  serviceId,
}: {
  orgId: string;
  orgSlug: string;
  serviceId: string;
}) {
  const navigate = useNavigate();
  const { data: service, isPending } = useService(orgId, serviceId);
  const history = useDeployRequests(orgId, serviceId);
  const rollback = useRollback(orgId, serviceId);
  const [deployOpen, setDeployOpen] = useState(false);

  if (isPending || !service) return <Skeleton className="h-96 w-full" />;

  const serving = service.environments.find((link) => link.role === 'SERVING');
  // 되돌릴 대상: 서비스 중 환경에서 서버가 되돌릴 수 있다고 한 가장 최근 배포 (목록은 최신순)
  const previous = history.data?.items.find(
    (item) => item.rollbackable && item.environment.id === serving?.environment.id,
  );

  return (
    <aside className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
      <header className="flex items-center justify-between gap-2">
        <Link to={`/o/${orgSlug}/services/${service.id}`} className="text-title hover:underline">
          {service.name}
        </Link>
        {service.simulated && <SimulatedBadge />}
      </header>

      <section className="flex flex-col gap-2">
        <h3 className="text-body-medium">Environments</h3>
        {service.environments.length === 0 ? (
          <p className="text-small text-fg-muted">Not deployed yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {service.environments.map((link) => (
              <li key={link.serviceEnvironmentId} className="flex flex-col gap-0.5">
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <ProviderLabel kind={link.environment.kind} showLocation={false} />
                    <span className="truncate font-mono text-mono">{link.environment.name}</span>
                  </span>
                  {linkBadge(link)}
                </span>
                <span className="truncate text-caption text-fg-muted">
                  <span className="font-mono">{shortSha(link.currentDeployment?.commitSha)}</span> ·{' '}
                  {link.activeRequestId
                    ? 'deploying'
                    : link.queuedRequestId
                      ? 'sync queued'
                      : link.versionStatus === 'IN_SYNC'
                        ? 'in sync'
                        : link.url.replace(/^https:\/\//, '')}
                </span>
              </li>
            ))}
          </ul>
        )}
        <span className="pt-1 text-caption text-fg-muted">Public URL (fixed)</span>
        <ExternalLink href={service.url} />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-body-medium">Deploy history</h3>
        {history.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : (history.data?.items.length ?? 0) === 0 ? (
          <p className="text-small text-fg-muted">No deploys yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.data?.items.slice(0, 4).map((request) => (
              <li key={request.id}>
                <Link
                  to={`/o/${orgSlug}/services/${service.id}/deploys/${request.id}`}
                  className="flex items-start gap-3 rounded-md p-1 hover:bg-subtle"
                >
                  <HistoryIcon request={request} />
                  <span className="flex min-w-0 flex-col">
                    <span
                      className={
                        request.status === 'FAILED'
                          ? 'text-body-medium text-danger-fg'
                          : 'text-body-medium'
                      }
                    >
                      <span className="font-mono">{shortSha(request.commitSha)}</span> ·{' '}
                      {request.environment.name}
                    </span>
                    <span className="truncate text-caption text-fg-muted">
                      {dateTime(request.stageTimes.queuedAt)} ·{' '}
                      {request.status === 'FAILED' && request.errorCode
                        ? deployErrorLabel(request.errorCode)
                        : deployTriggerLabel(request.trigger).toLowerCase()}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-col gap-2">
        <RoleButton requires="DEVELOPER" onClick={() => setDeployOpen(true)}>
          Deploy
        </RoleButton>
        {previous && (
          <RoleButton
            requires="DEVELOPER"
            variant="outline"
            disabled={rollback.isPending}
            onClick={() =>
              rollback.mutate(previous.id, {
                onSuccess: (created) =>
                  navigate(`/o/${orgSlug}/services/${service.id}/deploys/${created.id}`),
              })
            }
          >
            Roll back to <span className="font-mono">{shortSha(previous.commitSha)}</span>
          </RoleButton>
        )}
      </div>

      <DeployDialog
        open={deployOpen}
        onOpenChange={setDeployOpen}
        orgId={orgId}
        orgSlug={orgSlug}
        serviceId={service.id}
        serviceName={service.name}
      />
    </aside>
  );
}
