import { useState } from 'react';
import { Link } from 'react-router';
import { ExternalLink } from '@/components/ExternalLink';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  type Disaster,
  EVACUATION_MIN_MAGNITUDE,
  useEndDisaster,
  useEvacuateDisaster,
} from '@/lib/api/disasters';
import { dateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { disasterPlanReasonLabel, disasterSourceView, migrationPlanStatusView } from '@/lib/status';

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
  const evacuate = useEvacuateDisaster(orgId);
  const fromFeed = disaster.source !== 'SIMULATED';
  const event = disaster.feedEvent;
  const [isConfirming, setIsConfirming] = useState(false);
  const canEvacuate =
    fromFeed && disaster.plans.length === 0 && disaster.affectedEnvironmentIds.length > 0;
  const list = (ids: string[]) =>
    ids.length ? ids.map((id) => names.get(id) ?? t('unknown')).join(' · ') : t('None');
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-danger-solid bg-surface p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-overline uppercase text-danger-fg">{t('Active disaster')}</h2>
        <span className="flex items-center gap-1.5">
          <StatusBadge {...disasterSourceView(disaster.source)} />
          {disaster.simulated && <SimulatedBadge />}
        </span>
      </header>
      <dl className="flex flex-col gap-1.5">
        {event?.place && <Row label={t('Place')} value={event.place} />}
        {event?.occurredAt && <Row label={t('Occurred')} value={dateTime(event.occurredAt)} />}
        {event?.nearestDistanceKm != null && (
          <Row
            label={t('Nearest environment')}
            value={<span className="tabular-nums">{event.nearestDistanceKm} km</span>}
          />
        )}
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
            fromFeed ? (
              t('Feed threshold met')
            ) : disaster.type === 'EARTHQUAKE' ? (
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
      {event?.url && <ExternalLink href={event.url} className="text-small" />}
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
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canEvacuate && (
          <RoleButton requires="DEVELOPER" size="sm" onClick={() => setIsConfirming(true)}>
            {t('Create evacuation plans')}
          </RoleButton>
        )}
        <RoleButton
          requires="DEVELOPER"
          size="sm"
          variant="outline"
          disabled={end.isPending}
          onClick={() => end.mutate(disaster.id)}
        >
          {disaster.simulated ? t('End simulation') : t('End disaster')}
        </RoleButton>
      </div>
      <Dialog open={isConfirming} onOpenChange={setIsConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('Create evacuation plans')}</DialogTitle>
            <DialogDescription>
              {t('This moves live traffic off {{names}}.', {
                names: list(disaster.affectedEnvironmentIds),
              })}{' '}
              {t('If self-approval is on, the migration starts right away.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirming(false)}>
              {t('Cancel')}
            </Button>
            <Button
              disabled={evacuate.isPending}
              onClick={() =>
                evacuate.mutate(disaster.id, { onSettled: () => setIsConfirming(false) })
              }
            >
              {t('Create plans')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
