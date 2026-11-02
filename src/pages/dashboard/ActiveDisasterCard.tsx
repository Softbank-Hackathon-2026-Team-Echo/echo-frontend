import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { type Disaster, useEndDisaster } from '@/lib/api/disasters';

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
  disaster,
  names,
}: {
  orgId: string;
  disaster: Disaster;
  names: Map<string, string>;
}) {
  const end = useEndDisaster(orgId);
  const list = (ids: string[]) =>
    ids.length ? ids.map((id) => names.get(id) ?? 'unknown').join(' · ') : 'None';
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-danger-solid bg-surface p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-overline uppercase text-danger-fg">Active disaster</h2>
        <SimulatedBadge />
      </header>
      <dl className="flex flex-col gap-1.5">
        <Row
          label="Epicenter"
          value={
            <span className="tabular-nums">
              {disaster.epicenter.lat.toFixed(1)}°N {disaster.epicenter.lng.toFixed(1)}°E · M
              {disaster.magnitude.toFixed(1)}
            </span>
          }
        />
        <Row
          label="Impact radius"
          value={<span className="tabular-nums">{disaster.radiusKm} km</span>}
        />
        <Row label="Affected" value={list(disaster.affectedEnvironmentIds)} />
        <Row label="Safe targets" value={list(disaster.safeEnvironmentIds)} />
      </dl>
      <RoleButton
        requires="DEVELOPER"
        size="sm"
        variant="outline"
        className="self-end"
        disabled={end.isPending}
        onClick={() => end.mutate(disaster.id)}
      >
        End simulation
      </RoleButton>
    </section>
  );
}
