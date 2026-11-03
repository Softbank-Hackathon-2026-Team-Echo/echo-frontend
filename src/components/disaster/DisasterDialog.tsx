import { Activity, TriangleAlert, Wind } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { ProviderLabel } from '@/components/ProviderLabel';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type DisasterType,
  EPICENTER_PRESETS,
  EVACUATION_MIN_MAGNITUDE,
  LIVE_FEED,
  meetsEvacuationThreshold,
  previewDisaster,
  useCreateDisaster,
} from '@/lib/api/disasters';
import { useEnvironments } from '@/lib/api/environments';
import { type LatLng, nearLabel } from '@/lib/geo';
import { cn } from '@/lib/utils';
import { DisasterMap } from './DisasterMap';

// 규모 M5.0 ~ M9.0, 0.2 단계 (데모 기본 M7.2)
const MAGNITUDES = Array.from({ length: 21 }, (_, index) => Number((5 + index * 0.2).toFixed(1)));

const TYPES: { type: DisasterType; label: string; hint: string; icon: typeof Activity }[] = [
  { type: 'EARTHQUAKE', label: 'Earthquake', hint: 'M5–M9', icon: Activity },
  { type: 'TYPHOON', label: 'Typhoon', hint: 'Cat. 1–5', icon: Wind },
];

/** S01-D 재난 시뮬레이션: 지도를 눌러 진원지를 정하면 반경 안의 환경이 위험으로 바뀐다 */
export function DisasterDialog({
  open,
  onOpenChange,
  orgId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
}) {
  const environments = useEnvironments(orgId);
  const items = environments.data?.items ?? [];
  const create = useCreateDisaster(orgId, items);
  const defaultPreset = EPICENTER_PRESETS[0];
  const [type, setType] = useState<DisasterType>('EARTHQUAKE');
  const [epicenter, setEpicenter] = useState<LatLng>(
    defaultPreset?.epicenter ?? { lat: 35.2, lng: 139.4 },
  );
  const [magnitude, setMagnitude] = useState(7.2);

  const preview = useMemo(
    () => previewDisaster(items, { magnitude, epicenter }),
    [items, magnitude, epicenter],
  );
  const affected = new Set(preview.affected);
  const triggers = meetsEvacuationThreshold({ type, magnitude });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      { type, magnitude, epicenter, epicenterLabel: nearLabel(epicenter) },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Simulate disaster <SimulatedBadge />
            </DialogTitle>
            <DialogDescription>
              Click the map to set the epicenter. Environments inside the radius turn “At risk”.
              Nothing real goes down.
            </DialogDescription>
          </DialogHeader>

          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="sr-only">Disaster type</legend>
            {TYPES.map((item) => {
              const selected = item.type === type;
              const Icon = item.icon;
              return (
                <label
                  key={item.type}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus',
                    selected
                      ? 'border-brand bg-brand-subtle ring-1 ring-brand'
                      : 'border-line hover:bg-subtle',
                  )}
                >
                  <input
                    type="radio"
                    name="disaster-type"
                    value={item.type}
                    checked={selected}
                    onChange={() => setType(item.type)}
                    className="sr-only"
                  />
                  <Icon aria-hidden className="size-5 text-brand" />
                  <span className="flex flex-col">
                    <span className="text-body-medium">{item.label}</span>
                    <span className="text-caption text-fg-muted">{item.hint}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <DisasterMap
            epicenter={epicenter}
            radiusKm={preview.radiusKm}
            environments={items}
            affected={affected}
            onPick={setEpicenter}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="disaster-magnitude" className="text-label">
              {type === 'EARTHQUAKE' ? 'Magnitude' : 'Strength'}
            </Label>
            <Select
              value={String(magnitude)}
              onValueChange={(value) => setMagnitude(Number(value))}
            >
              <SelectTrigger id="disaster-magnitude" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAGNITUDES.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    M{value.toFixed(1)}
                    {type === 'EARTHQUAKE' && value === EVACUATION_MIN_MAGNITUDE && (
                      <span className="text-caption text-fg-muted">evacuation threshold</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="font-mono text-mono text-fg-muted">
              → radius {preview.radiusKm} km
            </span>
            <span className="ml-auto text-small text-fg-secondary">
              Epicenter {nearLabel(epicenter)}
            </span>
          </div>

          <dl className="flex flex-col gap-1 text-small">
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-fg-secondary">Evacuation rule</dt>
              <dd>
                {type === 'EARTHQUAKE'
                  ? `Magnitude ${EVACUATION_MIN_MAGNITUDE.toFixed(1)} or above`
                  : 'No threshold yet. Every typhoon counts.'}
              </dd>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-fg-secondary">Source</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <StatusBadge label="Manual (simulated)" tone="neutral" />
                {/* 실제 지진 피드를 붙이면 이 자리에서 고른다 (11/2 2부: 시간이 되면 연동) */}
                <span className="text-fg-muted">
                  Live feed ({LIVE_FEED.name}) {LIVE_FEED.ready ? 'connected' : 'not connected yet'}
                </span>
              </dd>
            </div>
          </dl>

          <div
            className={cn(
              'flex flex-col gap-2 rounded-lg p-3',
              preview.affected.length ? 'bg-warning-bg' : 'bg-subtle',
            )}
          >
            <span
              className={cn(
                'flex items-center gap-2 text-body-medium',
                preview.affected.length ? 'text-warning-fg' : 'text-fg-secondary',
              )}
            >
              <TriangleAlert aria-hidden className="size-4" />
              {preview.affected.length} environment{preview.affected.length === 1 ? '' : 's'}{' '}
              affected · {preview.safe.length} safe target{preview.safe.length === 1 ? '' : 's'}
            </span>
            {preview.affected.length > 0 && (
              <span className="text-small text-fg-secondary">
                {triggers
                  ? 'Above the threshold. EchoPort proposes an evacuation for services on affected environments.'
                  : `Below M${EVACUATION_MIN_MAGNITUDE.toFixed(1)}. Affected environments are flagged, but no evacuation is proposed.`}
              </span>
            )}
            <ul className="flex flex-col gap-1.5">
              {items.map((environment) => (
                <li key={environment.id} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <ProviderLabel kind={environment.kind} showLocation={false} />
                    <span className="truncate font-mono text-mono">{environment.name}</span>
                  </span>
                  {affected.has(environment.id) ? (
                    <StatusBadge label="At risk" tone="warning" />
                  ) : preview.unknown.includes(environment.id) ? (
                    <StatusBadge label="Unknown location" tone="neutral" />
                  ) : (
                    <StatusBadge label="Safe" tone="success" />
                  )}
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={create.isPending || !items.length}
            >
              Simulate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
