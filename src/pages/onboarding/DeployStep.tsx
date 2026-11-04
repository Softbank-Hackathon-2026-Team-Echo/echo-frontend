import { GitBranch } from 'lucide-react';
import { useState } from 'react';
import { DeployDialog } from '@/components/DeployDialog';
import { RegisterServiceDialog } from '@/components/RegisterServiceDialog';
import { RoleButton } from '@/components/RoleButton';
import type { ServiceSummary } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { StepShell } from './StepShell';

type Target = { id: string; name: string };

/**
 * 4단계: GitHub 저장소를 등록하고 주 환경에 원터치 배포한다. 배포가 시작되면 진행 화면으로 간다.
 * 먼저 성공한 환경이 서비스 중이 되고, 다른 환경은 같은 커밋을 예비로 따라간다(API 서버 3)
 */
export function DeployStep({
  orgId,
  orgSlug,
  services,
  primaryId,
}: {
  orgId: string;
  orgSlug: string;
  services: ServiceSummary[];
  primaryId: string | undefined;
}) {
  const [registerOpen, setRegisterOpen] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  return (
    <StepShell
      title={t('Deploy your app')}
      lead={t(
        'Connect a GitHub repository and deploy it to your primary. Standbys follow the same commit automatically.',
      )}
    >
      <div className="flex max-w-140 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-xs">
        {services.length === 0 ? (
          <div className="flex items-start gap-3">
            <GitBranch aria-hidden className="mt-0.5 size-5 text-fg-secondary" />
            <div className="flex flex-1 flex-col gap-1">
              <h2 className="text-h3">{t('No service yet')}</h2>
              <p className="text-small text-fg-secondary">
                {t(
                  'Register a repository with a Dockerfile. EchoPort builds it once and gives it a public URL.',
                )}
              </p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {services.map((service) => (
              <li key={service.id} className="flex items-center gap-3 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body-medium">{service.name}</span>
                  <span className="truncate font-mono text-mono text-fg-muted">
                    {service.repoUrl.replace(/^https:\/\//, '')}
                  </span>
                </span>
                <RoleButton
                  requires="DEVELOPER"
                  onClick={() => setTarget({ id: service.id, name: service.name })}
                >
                  {t('Deploy')}
                </RoleButton>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end">
          <RoleButton
            requires="DEVELOPER"
            variant={services.length === 0 ? 'default' : 'outline'}
            onClick={() => setRegisterOpen(true)}
          >
            {t('Register service')}
          </RoleButton>
        </div>
      </div>
      <RegisterServiceDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        orgId={orgId}
        orgSlug={orgSlug}
        onRegistered={(service) => setTarget(service)}
      />
      {target && (
        <DeployDialog
          open
          onOpenChange={(next) => !next && setTarget(null)}
          orgId={orgId}
          orgSlug={orgSlug}
          serviceId={target.id}
          serviceName={target.name}
          defaultEnvironmentId={primaryId}
        />
      )}
    </StepShell>
  );
}
