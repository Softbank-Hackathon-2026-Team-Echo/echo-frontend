import { CircleAlert, Loader2, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { ExternalLink } from '@/components/ExternalLink';
import { ProviderLabel } from '@/components/ProviderLabel';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import type { DeployRequestSummary, ServiceDetail, ServiceEnvironment } from '@/lib/api/types';
import { timeAgo } from '@/lib/format';
import { t } from '@/lib/i18n';
import {
  deployErrorLabel,
  envRoleView,
  shortSha,
  teardownErrorLabel,
  versionStatusView,
} from '@/lib/status';
import { cn } from '@/lib/utils';

/**
 * 이 연결에서 지금 배포보다 나중에 실패한 요청. 실패해도 서비스 중인 배포는 그대로라(Railway ACTIVE)
 * 카드는 지금 배포를 보이고, 실패는 한 줄로만 알린다
 */
export function latestFailure(
  link: ServiceEnvironment,
  history: DeployRequestSummary[] | undefined,
): DeployRequestSummary | undefined {
  const latest = history?.find((item) => item.serviceEnvironmentId === link.serviceEnvironmentId);
  return latest?.status === 'FAILED' ? latest : undefined;
}

function ActiveCard({
  link,
  failure,
  deployLink,
  selected,
}: {
  link: ServiceEnvironment;
  failure: DeployRequestSummary | undefined;
  deployLink: (id: string) => string;
  selected: boolean;
}) {
  const current = link.currentDeployment;
  const runningId = link.activeRequestId ?? link.queuedRequestId;
  return (
    <article
      className={cn(
        'flex min-w-0 flex-col gap-2.5 rounded-lg border bg-surface p-4',
        selected ? 'border-brand' : 'border-line',
      )}
    >
      <header className="flex items-center gap-2">
        <span className="text-overline uppercase text-success-fg">
          {current ? t('Active') : t('No active deploy')}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <StatusBadge {...envRoleView(link.role)} />
          {link.versionStatus && <StatusBadge {...versionStatusView(link.versionStatus)} />}
          {link.simulated && <SimulatedBadge />}
        </span>
      </header>
      <div className="flex items-center justify-between gap-2">
        <span className="flex flex-col gap-0.5">
          <span className="text-body-medium">{link.environment.name}</span>
          <ProviderLabel kind={link.environment.kind} showLocation={false} />
        </span>
        <span className="text-metric tabular-nums">{link.trafficWeight}%</span>
      </div>
      <p className="flex flex-wrap items-center gap-x-2 text-small text-fg-secondary">
        <span className="font-mono text-mono text-fg">{shortSha(current?.commitSha)}</span>
        {current?.finishedAt && (
          <span>{t('deployed {{time}}', { time: timeAgo(current.finishedAt) })}</span>
        )}
      </p>
      <ExternalLink href={link.url} className="text-small" />
      {/* 예비 따라가기: 성공하면 걸린 초, 실패하면 그 이유 */}
      {link.lastSyncError ? (
        <span className="text-caption text-warning-fg">
          {t('Standby sync failed: {{reason}}', { reason: deployErrorLabel(link.lastSyncError) })}
        </span>
      ) : link.lastSyncSeconds !== null ? (
        <span className="text-caption text-fg-muted">
          {t('Synced {{seconds}}s after the source', { seconds: link.lastSyncSeconds })}
        </span>
      ) : null}
      {link.teardownError && (
        <span className="text-caption text-danger-fg">
          {teardownErrorLabel(link.teardownError)}
        </span>
      )}
      {runningId && (
        <Link
          to={deployLink(runningId)}
          className="flex items-center gap-1.5 text-small text-migrating-fg hover:underline"
        >
          <Loader2 aria-hidden className="size-3.5 animate-spin" />
          {link.activeRequestId ? t('New version deploying…') : t('Deploy queued')}
        </Link>
      )}
      {failure && (
        <div className="flex flex-col gap-1.5 rounded-md bg-danger-bg px-3 py-2 text-danger-fg">
          <p className="flex items-center gap-1.5 text-small">
            <CircleAlert aria-hidden className="size-3.5 shrink-0" />
            {t('Latest deploy {{sha}} failed: {{reason}}', {
              sha: shortSha(failure.commitSha),
              reason: failure.errorCode ? deployErrorLabel(failure.errorCode) : '—',
            })}
          </p>
          <span className="text-caption">
            {current
              ? t('This version keeps serving.')
              : t('No version is running in this environment yet.')}
          </span>
          <Link
            to={deployLink(failure.id)}
            className="flex items-center gap-1.5 self-start text-small text-ai-fg hover:underline"
          >
            <Sparkles aria-hidden className="size-3.5" />
            {t('Diagnose with AI')}
          </Link>
        </div>
      )}
    </article>
  );
}

/** 환경마다 지금 서비스 중인 배포 카드 한 장. 서비스 화면 맨 위에 고정한다 (Railway ACTIVE) */
export function ActiveDeployments({
  service,
  history,
  orgSlug,
  selectedEnvironmentId,
}: {
  service: ServiceDetail;
  history: DeployRequestSummary[] | undefined;
  orgSlug: string;
  selectedEnvironmentId: string | undefined;
}) {
  const deployLink = (id: string) => `/o/${orgSlug}/services/${service.id}/deploys/${id}`;
  // 서비스 중 → 예비 → 나머지 순서
  const order = { SERVING: 0, STANDBY: 1, NONE: 2 } as const;
  const links = [...service.environments].sort(
    (a, b) => (order[a.role] ?? 2) - (order[b.role] ?? 2),
  );
  return (
    <div className="grid grid-cols-3 gap-4 max-wide:grid-cols-2 max-sm:grid-cols-1">
      {links.map((link) => (
        <ActiveCard
          key={link.serviceEnvironmentId}
          link={link}
          failure={latestFailure(link, history)}
          deployLink={deployLink}
          selected={link.environment.id === selectedEnvironmentId}
        />
      ))}
    </div>
  );
}
