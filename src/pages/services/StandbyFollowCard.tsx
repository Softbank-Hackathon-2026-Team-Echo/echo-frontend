import { Link } from 'react-router';
import { StatusBadge } from '@/components/StatusBadge';
import { useEnvironments } from '@/lib/api/environments';
import { isTerminalStatus } from '@/lib/api/services';
import type { DeployRequestDetail, DeployRequestSummary } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { deployStatusView } from '@/lib/status';

type SyncLike = Pick<DeployRequestSummary, 'id' | 'status' | 'environment'>;

export type StandbyRow =
  | { kind: 'sync'; environmentId: string; name: string; requested: boolean; sync: SyncLike }
  | { kind: 'requested'; environmentId: string; name: string; state: 'waiting' | 'skipped' };

/**
 * 이 배포가 띄운 예비. 서버는 새로 요청한 예비와 이미 있던 예비 모두 따라가기 요청(STANDBY_SYNC)으로 만든다.
 * 요청 목록(standbyEnvironmentIds)에 있는 환경이면 "이번에 요청한 예비", 없으면 "기존 예비 따라가기" 로 나눈다.
 * 요청했는데 따라가기가 없으면 주 배포 성공 전에는 대기, 성공 뒤에는 서버가 건너뛴 것이다(STANDBY_SKIPPED)
 */
export function standbyRows(
  request: Pick<DeployRequestDetail, 'status' | 'standbyEnvironmentIds'>,
  syncs: SyncLike[],
  names: Map<string, string>,
): StandbyRow[] {
  const requested = new Set(request.standbyEnvironmentIds ?? []);
  const rows: StandbyRow[] = syncs.map((sync) => ({
    kind: 'sync',
    environmentId: sync.environment.id,
    name: sync.environment.name,
    requested: requested.has(sync.environment.id),
    sync,
  }));
  const followed = new Set(syncs.map((sync) => sync.environment.id));
  for (const environmentId of requested) {
    if (followed.has(environmentId)) continue;
    rows.push({
      kind: 'requested',
      environmentId,
      name: names.get(environmentId) ?? environmentId.slice(0, 8),
      state: request.status === 'SUCCEEDED' ? 'skipped' : 'waiting',
    });
  }
  return rows;
}

export function StandbyFollowCard({
  orgId,
  request,
  syncs,
  requestLink,
}: {
  orgId: string;
  request: DeployRequestDetail;
  syncs: SyncLike[] | undefined;
  requestLink: (id: string) => string;
}) {
  const environments = useEnvironments(orgId);
  if (request.trigger === 'STANDBY_SYNC' || !syncs) return null;
  const names = new Map((environments.data?.items ?? []).map((item) => [item.id, item.name]));
  const rows = standbyRows(request, syncs, names);
  if (rows.length === 0) return null;
  const stopped = request.status === 'FAILED' || request.status === 'CANCELLED';

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <h2 className="text-title">{t('Standby environments')}</h2>
      <ul className="flex flex-col gap-2 text-small">
        {rows.map((row) => (
          <li key={row.environmentId} className="flex flex-col gap-0.5">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{row.name}</span>
              {row.kind === 'sync' ? (
                <StatusBadge {...deployStatusView(row.sync.status)} />
              ) : (
                <StatusBadge
                  label={
                    row.state === 'skipped'
                      ? t('Not started')
                      : stopped
                        ? t('Not started')
                        : t('Waiting for the main deploy')
                  }
                  tone={row.state === 'skipped' || stopped ? 'warning' : 'neutral'}
                />
              )}
            </span>
            <span className="flex flex-wrap items-center gap-x-2 text-caption text-fg-muted">
              {row.kind === 'requested' || row.requested
                ? t('Requested in this deploy')
                : t('Existing standby following this version')}
              {row.kind === 'sync' && !isTerminalStatus(row.sync.status) && (
                <span>· {t('in progress')}</span>
              )}
              {row.kind === 'sync' && (
                <Link to={requestLink(row.sync.id)} className="text-brand hover:underline">
                  {t('Open')}
                </Link>
              )}
            </span>
          </li>
        ))}
      </ul>
      {rows.some((row) => row.kind === 'requested' && row.state === 'skipped') && (
        <p className="text-caption text-fg-muted">
          {t(
            'EchoPort skips a standby when the environment is gone, its address conflicts, or a migration is running.',
          )}
        </p>
      )}
    </section>
  );
}
