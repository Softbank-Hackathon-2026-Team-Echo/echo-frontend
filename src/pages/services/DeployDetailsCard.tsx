import type { DeployRequestDetail, ServiceDetail } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { deployTriggerLabel, shortSha } from '@/lib/status';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-fg-secondary">{label}</dt>
      <dd className="min-w-0 break-all">{children}</dd>
    </>
  );
}

/**
 * 이 배포의 기록 (Railway 배포 Details). 서버가 접수 때 고정한 값(커밋 · ref · 이미지 · 빌드)을 보이고,
 * 서버가 배포마다 저장하지 않는 값(헬스 체크 · 포트 · 레플리카)은 지금 서비스 설정이라고 밝힌다
 */
export function DeployDetailsCard({
  request,
  service,
}: {
  request: DeployRequestDetail;
  service: ServiceDetail | undefined;
}) {
  const digest = request.build?.imageDigest;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <h2 className="text-title">{t('Deploy details')}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-small">
        <Row label={t('Environment')}>
          {request.environment.name}{' '}
          <span className="text-fg-muted">({request.environment.kind})</span>
        </Row>
        <Row label={t('Trigger')}>{deployTriggerLabel(request.trigger)}</Row>
        <Row label={t('Ref')}>
          <span className="font-mono text-mono">{request.ref.value}</span>
        </Row>
        <Row label={t('Commit')}>
          <span className="font-mono text-mono" title={request.commitSha ?? undefined}>
            {shortSha(request.commitSha)}
          </span>
        </Row>
        <Row label={t('Image')}>
          <span className="font-mono text-mono" title={digest ?? undefined}>
            {digest ? `${digest.slice(0, 19)}…` : '—'}
          </span>
        </Row>
        <Row label={t('Build')}>
          {request.build ? (request.build.reused ? t('Reused') : t('New build')) : '—'}
        </Row>
      </dl>
      <h3 className="text-label text-fg-secondary">{t('Current service settings')}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-small">
        <Row label={t('Health check')}>
          <span className="font-mono text-mono">{service?.healthCheckPath ?? '—'}</span>
        </Row>
        <Row label={t('Port')}>
          <span className="font-mono text-mono">{service?.containerPort ?? '—'}</span>
        </Row>
        <Row label={t('Replicas')}>—</Row>
        <Row label={t('Restart policy')}>{t('Kubernetes default (always)')}</Row>
      </dl>
    </section>
  );
}
