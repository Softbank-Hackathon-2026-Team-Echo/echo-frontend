import { Cloud, Info, Plus, Server, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { EnvironmentFormDialog } from '@/components/EnvironmentFormDialog';
import { RoleButton } from '@/components/RoleButton';
import { Button } from '@/components/ui/button';
import { radiusForMagnitude } from '@/lib/api/disasters';
import type { EnvironmentSummary } from '@/lib/api/types';
import { distanceKm, environmentCoordinates, placeLabel } from '@/lib/geo';
import { cn } from '@/lib/utils';
import { SetupGlobe } from './SetupGlobe';
import { StepShell } from './StepShell';

// 큰 지진(M8) 영향 반경보다 가까우면 같은 재난에 같이 들어간다. 반경은 재난 판정과 같은 식이다
const BIG_EARTHQUAKE = 8;
const TOO_CLOSE_KM = radiusForMagnitude(BIG_EARTHQUAKE);

function distanceFrom(primary: EnvironmentSummary | undefined, other: EnvironmentSummary) {
  const a = primary && environmentCoordinates(primary);
  const b = environmentCoordinates(other);
  return a && b ? Math.round(distanceKm(a, b)) : null;
}

/** O02: 예비 환경을 더한다. 지구본에 주 환경 → 예비 항로와 거리를 보여 "멀리 둘수록 안전" 을 보인다 */
export function StandbyStep({
  orgId,
  orgSlug,
  primary,
  standbys,
  onContinue,
}: {
  orgId: string;
  orgSlug: string;
  primary: EnvironmentSummary | undefined;
  standbys: EnvironmentSummary[];
  onContinue: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <StepShell
      title="Where can it evacuate to?"
      lead="Add at least one standby environment in a different region. The globe shows how far apart they are."
    >
      <div className="flex items-start gap-3 max-wide:flex-col">
        <SetupGlobe primary={primary} standbys={standbys} />
        <div className="flex w-105 shrink-0 flex-col gap-3 max-wide:w-full">
          {primary && (
            <p className="text-small text-fg-secondary">
              Primary <span className="text-body-medium text-fg">{primary.name}</span> ·{' '}
              {placeLabel(primary) ?? '—'}
            </p>
          )}
          {standbys.length === 0 && (
            <p className="rounded-lg border border-dashed border-line-strong p-3 text-small text-fg-muted">
              No standby yet. Add one in another region or on-prem site.
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {standbys.map((environment) => {
              const km = distanceFrom(primary, environment);
              const tooClose = km !== null && km < TOO_CLOSE_KM;
              const Icon = environment.kind === 'onprem' ? Server : Cloud;
              return (
                <li
                  key={environment.id}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3',
                    tooClose ? 'border-line bg-surface' : 'border-2 border-brand bg-brand-subtle',
                  )}
                >
                  <Icon aria-hidden className="size-5 text-fg-secondary" />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-body-medium">{environment.name}</span>
                    <span className="text-caption text-fg-secondary">
                      {environment.location ?? '—'}
                      {km !== null && ` · ${km.toLocaleString('en-US')} km away`}
                    </span>
                    {tooClose && (
                      <span className="flex items-center gap-1 text-caption text-warning-fg">
                        <TriangleAlert aria-hidden className="size-3" />
                        Inside the same M{BIG_EARTHQUAKE} impact radius ({Math.round(TOO_CLOSE_KM)}{' '}
                        km)
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-2">
            <RoleButton requires="DEVELOPER" variant="outline" onClick={() => setOpen(true)}>
              <Plus aria-hidden />
              Add another environment
            </RoleButton>
            {standbys.length > 0 && <Button onClick={onContinue}>Continue</Button>}
          </div>
          <div className="flex items-start gap-3 rounded-lg bg-brand-subtle p-3 text-brand-on-subtle">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <p className="text-body-medium">Tip: keep standby far from primary</p>
              <p className="text-small">
                A standby inside the same impact radius cannot help in a big earthquake.
              </p>
            </div>
          </div>
        </div>
      </div>
      <EnvironmentFormDialog open={open} onOpenChange={setOpen} orgId={orgId} orgSlug={orgSlug} />
    </StepShell>
  );
}
