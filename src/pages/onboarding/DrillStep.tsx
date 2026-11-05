import { Activity } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { DisasterDialog } from '@/components/disaster/DisasterDialog';
import { RoleButton } from '@/components/RoleButton';
import { Button } from '@/components/ui/button';
import type { EnvironmentSummary, ServiceDetail } from '@/lib/api/types';
import { environmentCoordinates, nearLabel, placeLabel } from '@/lib/geo';
import { t } from '@/lib/i18n';
import { shortSha } from '@/lib/status';
import { SetupGlobe } from './SetupGlobe';
import { StepShell } from './StepShell';

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-small">
      <span className="text-fg-secondary">{label}</span>
      <span className="truncate text-fg">{value}</span>
    </div>
  );
}

/** O03: 설정 요약 + 첫 훈련. 누르면 진원지가 주 환경 근처로 채워진 재난 다이얼로그가 열린다 */
export function DrillStep({
  orgId,
  orgSlug,
  primary,
  standbys,
  service,
}: {
  orgId: string;
  orgSlug: string;
  primary: EnvironmentSummary | undefined;
  standbys: EnvironmentSummary[];
  service: ServiceDetail | undefined;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const epicenter = primary ? environmentCoordinates(primary) : null;
  const deployment = service?.environments.find(
    (link) => link.role === 'SERVING',
  )?.currentDeployment;
  return (
    <StepShell
      title={t('You are protected. Try a drill.')}
      lead={t(
        'Simulate an earthquake near your primary. The disaster is simulated, but the migration it starts is real.',
      )}
    >
      <div className="flex items-start gap-3 max-wide:flex-col">
        <SetupGlobe primary={primary} standbys={standbys} ripple />
        <div className="flex w-105 shrink-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 max-wide:w-full">
          <h2 className="text-title">{t('Your setup')}</h2>
          <Kv
            label={t('Primary')}
            value={primary ? `${primary.name} · ${placeLabel(primary) ?? '—'}` : '—'}
          />
          {standbys.map((environment) => (
            <Kv
              key={environment.id}
              label={t('Standby')}
              value={`${environment.name} · ${placeLabel(environment) ?? '—'}`}
            />
          ))}
          <Kv
            label={t('App')}
            value={
              service
                ? `${service.name} ${shortSha(deployment?.commitSha)} · ${service.url.replace(/^https:\/\//, '')}`
                : '—'
            }
          />
          <RoleButton
            requires="DEVELOPER"
            variant="destructive"
            size="lg"
            className="w-full"
            onClick={() => setOpen(true)}
          >
            <Activity aria-hidden />
            {t('Simulate M7.2 {{place}}', {
              place: epicenter ? nearLabel(epicenter) : t('near Tokyo'),
            })}
          </RoleButton>
          <Button variant="ghost" onClick={() => navigate(`/o/${orgSlug}`)}>
            {t('Go to dashboard')}
          </Button>
        </div>
      </div>
      <DisasterDialog
        key={primary?.id ?? 'none'}
        open={open}
        onOpenChange={setOpen}
        orgId={orgId}
        initialEpicenter={epicenter ?? undefined}
        onCreated={() => navigate(`/o/${orgSlug}`)}
      />
    </StepShell>
  );
}
