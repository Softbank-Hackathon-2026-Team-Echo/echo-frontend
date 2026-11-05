import { Link } from 'react-router';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { type Disaster, EVACUATION_MIN_MAGNITUDE, useEndDisaster } from '@/lib/api/disasters';
import { t } from '@/lib/i18n';
import { disasterPlanReasonLabel, migrationPlanStatusView } from '@/lib/status';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-body">
      <dt className="text-fg-secondary">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

/** S01 오른쪽 위 "Active disaster" 칸. 재난이 없으면 그리지 않는다 */
export function ActiveDisasterCard({
  orgId,
  orgSlug,
  disaster,
  names,
}: {
  orgId: string;
  orgSlug: string;
  disaster: Disaster;
  names: Map<string, string>;
}) {
  const end = useEndDisaster(orgId);
  const list = (ids: string[]) =>
    ids.length ? ids.map((id) => names.get(id) ?? t('unknown')).join(' · ') : t('None');
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-danger-solid bg-surface p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-overline uppercase text-danger-fg">{t('Active disaster')}</h2>
        <SimulatedBadge />
      </header>
      <dl className="flex flex-col gap-1.5">
        <Row
          label={t('Epicenter')}
          value={
            <span className="tabular-nums">
              {disaster.epicenter.lat.toFixed(1)}°N {disaster.epicenter.lng.toFixed(1)}°E · M
              {disaster.magnitude.toFixed(1)}
            </span>
          }
        />
        <Row
          label={t('Impact radius')}
          value={<span className="tabular-nums">{disaster.radiusKm} km</span>}
        />
        <Row
          label={t('Evacuation rule')}
          value={
            disaster.type === 'EARTHQUAKE' ? (
              <StatusBadge
                label={
                  disaster.meetsThreshold
                    ? t('Met · M{{magnitude}}+', {
                        magnitude: EVACUATION_MIN_MAGNITUDE.toFixed(1),
                      })
                    : t('Not met · M{{magnitude}}+', {
                        magnitude: EVACUATION_MIN_MAGNITUDE.toFixed(1),
                      })
                }
                tone={disaster.meetsThreshold ? 'danger' : 'neutral'}
              />
            ) : (
              t('No threshold')
            )
          }
        />
        <Row label={t('Affected')} value={list(disaster.affectedEnvironmentIds)} />
        <Row label={t('Safe targets')} value={list(disaster.safeEnvironmentIds)} />
      </dl>
      {disaster.plans.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-line pt-3">
          {disaster.plans.map((plan) => (
            <li key={plan.planId ?? plan.serviceId} className="flex flex-col gap-0.5 text-small">
              <span className="flex items-center justify-between gap-2">
                {plan.planId ? (
                  <Link to={`/o/${orgSlug}/migrations/${plan.planId}`} className="hover:underline">
                    {t('Emergency migration → {{name}}', {
                      name: names.get(plan.targetEnvironmentId ?? '') ?? t('unknown'),
                    })}
                  </Link>
                ) : (
                  t('Emergency migration')
                )}
                {plan.planStatus && <StatusBadge {...migrationPlanStatusView(plan.planStatus)} />}
              </span>
              {plan.reason && (
                <span className="text-caption text-fg-muted">
                  {disasterPlanReasonLabel(plan.reason)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <RoleButton
        requires="DEVELOPER"
        size="sm"
        variant="outline"
        className="self-end"
        disabled={end.isPending}
        onClick={() => end.mutate(disaster.id)}
      >
        {t('End simulation')}
      </RoleButton>
    </section>
  );
}
