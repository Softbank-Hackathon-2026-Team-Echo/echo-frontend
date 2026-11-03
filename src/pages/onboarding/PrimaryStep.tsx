import { Cloud, Server } from 'lucide-react';
import { useState } from 'react';
import { EnvironmentFormDialog } from '@/components/EnvironmentFormDialog';
import { RoleButton } from '@/components/RoleButton';
import { StepShell } from './StepShell';

const PROVIDERS = [
  { label: 'AWS', hint: 'EKS cluster', icon: Cloud },
  { label: 'GCP', hint: 'GKE cluster', icon: Cloud },
  { label: 'On-prem', hint: 'K3s cluster', icon: Server },
];

/** O01: 지금 트래픽을 받는 환경을 등록한다. 폼은 설정의 환경 등록과 같다 */
export function PrimaryStep({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
  const [open, setOpen] = useState(false);
  return (
    <StepShell
      title="Where does your app run today?"
      lead="Connect the environment that serves traffic now. You can add more later."
    >
      <div className="flex max-w-140 flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-xs">
        <header className="flex flex-col gap-1">
          <h2 className="text-h3">Add environment</h2>
          <p className="text-small text-fg-secondary">
            Each environment is one cloud region or one on-prem site. Any registered environment can
            become an evacuation target.
          </p>
        </header>
        <ul className="grid grid-cols-3 gap-2">
          {PROVIDERS.map(({ label, hint, icon: Icon }) => (
            <li key={label} className="flex items-start gap-3 rounded-lg border border-line p-3">
              <Icon aria-hidden className="size-5 text-fg-secondary" />
              <span className="flex flex-col gap-0.5">
                <span className="text-body-medium">{label}</span>
                <span className="text-caption text-fg-secondary">{hint}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-small text-fg-muted">
          You give a name, region, cluster and where the kubeconfig is stored. EchoPort keeps only
          that reference, never the secret itself.
        </p>
        <div className="flex justify-end">
          <RoleButton requires="DEVELOPER" onClick={() => setOpen(true)}>
            Add environment
          </RoleButton>
        </div>
      </div>
      <EnvironmentFormDialog open={open} onOpenChange={setOpen} orgId={orgId} orgSlug={orgSlug} />
    </StepShell>
  );
}
