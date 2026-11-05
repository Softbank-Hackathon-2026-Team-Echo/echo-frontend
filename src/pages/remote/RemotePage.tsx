import { Activity, TriangleAlert, Wind } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { ErrorState } from '@/components/ErrorState';
import { Logo } from '@/components/Logo';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DISASTER_MAGNITUDES,
  type DisasterPlan,
  type DisasterType,
  EPICENTER_PRESETS,
  useActiveDisasters,
  useCreateDisaster,
  useDisasterPreview,
  useEndDisaster,
} from '@/lib/api/disasters';
import { useEnvironments } from '@/lib/api/environments';
import { useCurrentOrg } from '@/lib/api/me';
import { k, t } from '@/lib/i18n';
import { hasRole, ROLE_LABELS, roleLabel } from '@/lib/roles';
import { disasterPlanReasonLabel } from '@/lib/status';
import { cn } from '@/lib/utils';

const ARM_MS = 5_000;

const TYPES: { type: DisasterType; label: string; hint: string; icon: typeof Activity }[] = [
  { type: 'EARTHQUAKE', label: k('Earthquake'), hint: 'M5–M9', icon: Activity },
  { type: 'TYPHOON', label: k('Typhoon'), hint: k('Cat. 1–5'), icon: Wind },
];

function planText(plan: DisasterPlan) {
  if (plan.outcome === 'APPROVED') return t('Migration started');
  const reason = disasterPlanReasonLabel(plan.reason ?? '');
  return plan.outcome === 'SKIPPED'
    ? t('Migration skipped: {{reason}}', { reason })
    : t('Migration waiting: {{reason}}', { reason });
}

/** S01-R 시연 리모컨: 무대에서 휴대폰으로 재난을 낸다. 재난 다이얼로그와 같은 API 다 */
export default function RemotePage() {
  const { slug } = useParams();
  const { organization, isPending, isError, error, refetch } = useCurrentOrg(slug);
  const orgId = organization?.id ?? '';
  const environments = useEnvironments(organization?.id);
  const active = useActiveDisasters(organization?.id);
  const create = useCreateDisaster(orgId);
  const end = useEndDisaster(orgId);
  const [type, setType] = useState<DisasterType>('EARTHQUAKE');
  const [presetIndex, setPresetIndex] = useState(0);
  const [magnitude, setMagnitude] = useState(7.2);
  const [armed, setArmed] = useState(false);
  const epicenter = EPICENTER_PRESETS[presetIndex]?.epicenter ?? { lat: 35.2, lng: 139.4 };
  const input = { type, magnitude, epicenter };
  const preview = useDisasterPreview(orgId, input, Boolean(organization));

  // 주머니에서 잘못 눌려도 바로 나가지 않게, 두 번째 누름을 잠깐만 기다린다
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), ARM_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !organization) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-4 p-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64" />
      </main>
    );
  }

  const latest = active.data?.at(-1);
  const startsMigration =
    Boolean(preview.data?.meetsThreshold) && (preview.data?.affected.length ?? 0) > 0;
  const affectedNames = (environments.data?.items ?? [])
    .filter((item) => preview.data?.affected.includes(item.id))
    .map((item) => item.name)
    .join(', ');
  const plans = create.data?.plans ?? latest?.plans ?? [];
  const allowed = hasRole(organization.role, 'DEVELOPER');

  function handleTrigger() {
    if (startsMigration && !armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    create.mutate(input);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-4 bg-canvas p-4">
      <header className="flex items-center justify-between gap-2">
        <Logo className="h-5" />
        <span className="text-small text-fg-secondary">{roleLabel(organization.role)}</span>
      </header>

      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-h2">
          {t('Demo remote')} <SimulatedBadge />
        </h1>
        <p className="text-small text-fg-secondary">
          {t('The disaster is simulated, but the migrations it starts are real.')}
        </p>
      </div>

      {latest ? (
        <section
          role="status"
          className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4"
        >
          <span className="flex items-center gap-2">
            <StatusBadge label={t('Sent')} tone="success" />
            <span className="text-body-medium">
              M{latest.magnitude.toFixed(1)} {latest.epicenterLabel}
            </span>
          </span>
          {plans.map((plan) => (
            <p key={plan.planId ?? plan.serviceId} className="text-small text-fg-secondary">
              {planText(plan)}
            </p>
          ))}
          <RoleButton
            requires="DEVELOPER"
            variant="outline"
            className="h-12"
            disabled={end.isPending}
            onClick={() =>
              end.mutate(latest.id, {
                onSuccess: () => create.reset(),
              })
            }
          >
            {t('End simulation')}
          </RoleButton>
        </section>
      ) : (
        <>
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="sr-only">{t('Disaster type')}</legend>
            {TYPES.map((item) => {
              const Icon = item.icon;
              return (
                <label
                  key={item.type}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg border bg-surface p-3',
                    item.type === type ? 'border-brand ring-1 ring-brand' : 'border-line',
                  )}
                >
                  <input
                    type="radio"
                    name="remote-type"
                    className="sr-only"
                    checked={item.type === type}
                    onChange={() => setType(item.type)}
                  />
                  <Icon aria-hidden className="size-5 text-brand" />
                  <span className="flex flex-col">
                    <span className="text-body-medium">{t(item.label)}</span>
                    <span className="text-caption text-fg-muted">{t(item.hint)}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="remote-epicenter" className="text-label">
              {t('Epicenter')}
            </Label>
            <Select
              value={String(presetIndex)}
              onValueChange={(value) => setPresetIndex(Number(value))}
            >
              <SelectTrigger id="remote-epicenter" className="h-12 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EPICENTER_PRESETS.map((preset, index) => (
                  <SelectItem key={preset.label} value={String(index)}>
                    {t(preset.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="remote-magnitude" className="text-label">
              {type === 'EARTHQUAKE' ? t('Magnitude') : t('Strength')}
            </Label>
            <Select
              value={String(magnitude)}
              onValueChange={(value) => setMagnitude(Number(value))}
            >
              <SelectTrigger id="remote-magnitude" className="h-12 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISASTER_MAGNITUDES.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    M{value.toFixed(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {startsMigration && (
            <p role="alert" className="rounded-lg bg-danger-bg p-3 text-small text-danger-fg">
              {t('This moves live traffic off {{names}}.', { names: affectedNames })}{' '}
              {organization.allowSelfApproval
                ? t('Self-approval is on, so migrations start as soon as you confirm.')
                : t('Each migration waits for another developer to approve it.')}
            </p>
          )}

          <div className="mt-auto flex flex-col gap-2">
            {!allowed && (
              <p className="text-center text-small text-fg-muted">
                {t('Requires {{role}}', { role: ROLE_LABELS.DEVELOPER })}
              </p>
            )}
            <RoleButton
              requires="DEVELOPER"
              variant="destructive"
              className="h-16 w-full text-h3"
              disabled={create.isPending || !preview.data || preview.isPlaceholderData}
              onClick={handleTrigger}
            >
              <TriangleAlert aria-hidden />
              {armed ? t('Press again to move traffic') : t('Trigger disaster')}
            </RoleButton>
          </div>
        </>
      )}
    </main>
  );
}
