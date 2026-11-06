import { Pencil, Trash2 } from 'lucide-react';
import { ExternalLink } from '@/components/ExternalLink';
import { ProviderLabel } from '@/components/ProviderLabel';
import { RoleButton } from '@/components/RoleButton';
import { StatusBadge } from '@/components/StatusBadge';
import { useEnvironments } from '@/lib/api/environments';
import type { ServiceDetail } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { envRoleView } from '@/lib/status';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-3 py-2 max-sm:grid-cols-1 max-sm:gap-0.5">
      <dt className="text-small text-fg-secondary">{label}</dt>
      <dd className="min-w-0 text-body">{children}</dd>
    </div>
  );
}

/**
 * 서비스 설정 묶음(Railway Settings). 서비스 전체 값과 환경마다 다른 값을 한 화면에 모은다.
 * 복제 수는 API 에 없어 지어내지 않는다
 */
export function ServiceSettings({
  orgId,
  service,
  disabledReason,
  onEdit,
  onDelete,
}: {
  orgId: string;
  service: ServiceDetail;
  disabledReason?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const environments = useEnvironments(orgId);
  const locationOf = (id: string) =>
    environments.data?.items.find((env) => env.id === id)?.location;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        <header className="flex items-center justify-between gap-2">
          <h2 className="text-title">{t('Service')}</h2>
          <RoleButton
            requires="DEVELOPER"
            variant="outline"
            size="sm"
            disabledReason={disabledReason}
            onClick={onEdit}
          >
            <Pencil aria-hidden />
            {t('Edit settings')}
          </RoleButton>
        </header>
        <dl className="divide-y divide-line">
          <Row label={t('Repository')}>
            <span className="font-mono text-mono break-all">{service.repoUrl}</span>
          </Row>
          <Row label={t('Health check path')}>
            <span className="font-mono text-mono">{service.healthCheckPath}</span>
          </Row>
          <Row label={t('Container port')}>
            <span className="font-mono text-mono">{service.containerPort}</span>
          </Row>
          <Row label={t('Replicas')}>
            <span className="text-fg-muted">—</span>
          </Row>
          <Row label={t('Restart policy')}>{t('Kubernetes default (always)')}</Row>
          <Row label={t('Public URL')}>
            <ExternalLink href={service.url} />
          </Row>
        </dl>
      </section>
      <section className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-title">{t('Per environment')}</h2>
        {service.environments.length === 0 ? (
          <p className="text-body text-fg-muted">{t('Not deployed yet')}</p>
        ) : (
          <dl className="divide-y divide-line">
            {service.environments.map((link) => (
              <Row key={link.serviceEnvironmentId} label={link.environment.name}>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <ProviderLabel
                    kind={link.environment.kind}
                    location={locationOf(link.environment.id)}
                  />
                  <StatusBadge {...envRoleView(link.role)} />
                  <span className="tabular-nums text-fg-secondary">
                    {t('Traffic')} {link.trafficWeight}%
                  </span>
                  <ExternalLink href={link.url} className="text-small" />
                </span>
              </Row>
            ))}
          </dl>
        )}
      </section>
      <section className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-col">
          <h2 className="text-title">{t('Delete service')}</h2>
          <p className="text-small text-fg-secondary">
            {t(
              'EchoPort removes it from every environment, then deletes it. Deploy history is kept.',
            )}
          </p>
        </div>
        <RoleButton
          requires="ADMIN"
          variant="destructive"
          size="sm"
          disabledReason={disabledReason}
          onClick={onDelete}
        >
          <Trash2 aria-hidden />
          {t('Delete service')}
        </RoleButton>
      </section>
    </div>
  );
}
