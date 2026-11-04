import { Cloud, Server } from 'lucide-react';
import { useState } from 'react';
import { EnvironmentFormDialog } from '@/components/EnvironmentFormDialog';
import { RoleButton } from '@/components/RoleButton';
import { Button } from '@/components/ui/button';
import { k, t } from '@/lib/i18n';
import { StepShell } from './StepShell';

const PROVIDERS = [
  { label: 'AWS', hint: k('EKS cluster'), icon: Cloud },
  { label: 'GCP', hint: k('GKE cluster'), icon: Cloud },
  { label: k('On-prem'), hint: k('K3s cluster'), icon: Server },
];

/** O01: 지금 트래픽을 받는 환경을 등록한다. 폼은 설정의 환경 등록과 같다 */
export function PrimaryStep({
  orgId,
  orgSlug,
  primaryName,
  onContinue,
}: {
  orgId: string;
  orgSlug: string;
  /** 이미 등록했으면 그 이름. 다시 볼 때 Continue 를 보인다 */
  primaryName: string | undefined;
  onContinue: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <StepShell
      title={t('Where does your app run today?')}
      lead={t('Connect the environment that serves traffic now. You can add more later.')}
    >
      <div className="flex max-w-140 flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-xs">
        <header className="flex flex-col gap-1">
          <h2 className="text-h3">{t('Add environment')}</h2>
          <p className="text-small text-fg-secondary">
            {t(
              'Each environment is one cloud region or one on-prem site. Any registered environment can become an evacuation target.',
            )}
          </p>
        </header>
        <ul className="grid grid-cols-3 gap-2">
          {PROVIDERS.map(({ label, hint, icon: Icon }) => (
            <li key={label} className="flex items-start gap-3 rounded-lg border border-line p-3">
              <Icon aria-hidden className="size-5 text-fg-secondary" />
              <span className="flex flex-col gap-0.5">
                <span className="text-body-medium">{t(label)}</span>
                <span className="text-caption text-fg-secondary">{t(hint)}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-small text-fg-muted">
          {t(
            'You give a name, region, cluster and where the kubeconfig is stored. EchoPort keeps only that reference, never the secret itself.',
          )}
        </p>
        <div className="flex items-center justify-end gap-2">
          {primaryName && (
            <span className="mr-auto text-small text-fg-secondary">
              {t('Primary {{name}} is connected', { name: primaryName })}
            </span>
          )}
          <RoleButton
            requires="DEVELOPER"
            variant={primaryName ? 'outline' : 'default'}
            onClick={() => setOpen(true)}
          >
            {t('Add environment')}
          </RoleButton>
          {primaryName && <Button onClick={onContinue}>{t('Continue')}</Button>}
        </div>
      </div>
      <EnvironmentFormDialog open={open} onOpenChange={setOpen} orgId={orgId} orgSlug={orgSlug} />
    </StepShell>
  );
}
