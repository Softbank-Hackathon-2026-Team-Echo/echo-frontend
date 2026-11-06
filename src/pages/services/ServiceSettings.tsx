import { Lock, Pencil, Trash2 } from 'lucide-react';
import { RoleButton } from '@/components/RoleButton';
import type { ServiceDetail } from '@/lib/api/types';
import { t } from '@/lib/i18n';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 px-4 py-2 max-compact:grid-cols-1">
      <dt className="text-small text-fg-secondary">{label}</dt>
      <dd className="col-span-2 min-w-0 break-all text-body">{children}</dd>
    </div>
  );
}

/** 설정 탭: 저장소 · 배포 설정 · 삭제 */
export function ServiceSettings({
  service,
  disabledReason,
  onEdit,
  onDelete,
}: {
  service: ServiceDetail;
  disabledReason?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-h3">{t('Source and deploy')}</h2>
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
        </div>
        <dl className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          <Row label={t('GitHub repository')}>
            <a
              href={service.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-mono hover:underline"
            >
              {service.private && <Lock aria-label={t('Private repository')} className="size-3" />}
              {service.repoUrl.replace(/^https:\/\//, '')}
            </a>
          </Row>
          <Row label={t('Health check path')}>
            <span className="font-mono text-mono">{service.healthCheckPath}</span>
          </Row>
          <Row label={t('Health timeout (s)')}>
            <span className="font-mono text-mono">{service.healthCheckTimeoutSeconds}</span>
          </Row>
          <Row label={t('Container port')}>
            <span className="font-mono text-mono">{service.containerPort}</span>
          </Row>
        </dl>
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
