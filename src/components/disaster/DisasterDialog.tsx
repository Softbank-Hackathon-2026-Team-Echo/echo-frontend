import { type FormEvent, useMemo, useState } from 'react';
import { ProviderLabel } from '@/components/ProviderLabel';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type DisasterType,
  EPICENTER_PRESETS,
  previewDisaster,
  useCreateDisaster,
} from '@/lib/api/disasters';
import { useEnvironments } from '@/lib/api/environments';
import type { EnvironmentSummary } from '@/lib/api/types';

const MIN_MAGNITUDE = 5;
const MAX_MAGNITUDE = 9;

function EnvironmentList({
  title,
  tone,
  environments,
}: {
  title: string;
  tone: 'danger' | 'success' | 'neutral';
  environments: EnvironmentSummary[];
}) {
  const color = { danger: 'text-danger-fg', success: 'text-success-fg', neutral: 'text-fg-muted' }[
    tone
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <span className={`text-label ${color}`}>
        {title} ({environments.length})
      </span>
      {environments.length === 0 ? (
        <span className="text-small text-fg-muted">None</span>
      ) : (
        <ul className="flex flex-col gap-1">
          {environments.map((environment) => (
            <li key={environment.id} className="flex items-center justify-between gap-2 text-body">
              <span className="truncate">{environment.name}</span>
              <ProviderLabel kind={environment.kind} location={environment.location} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** S01-D 재난 시뮬레이션. 진원지 · 규모를 고르면 반경 안의 환경을 미리 보여 주고 재난을 만든다 */
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
  const [type, setType] = useState<DisasterType>('EARTHQUAKE');
  const [presetIndex, setPresetIndex] = useState('0');
  const [magnitude, setMagnitude] = useState(7.2);
  const preset = EPICENTER_PRESETS[Number(presetIndex)] ?? EPICENTER_PRESETS[0];

  const preview = useMemo(
    () => (preset ? previewDisaster(items, { magnitude, epicenter: preset.epicenter }) : undefined),
    [items, magnitude, preset],
  );
  const pick = (ids: string[] = []) => items.filter((environment) => ids.includes(environment.id));

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!preset) return;
    create.mutate(
      { type, magnitude, epicenter: preset.epicenter, epicenterLabel: preset.label },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Simulate disaster <SimulatedBadge />
            </DialogTitle>
            <DialogDescription>
              Nothing real goes down. EchoPort marks environments inside the impact radius as at
              risk so you can rehearse evacuation.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={type} onValueChange={(value) => setType(value as DisasterType)}>
            <TabsList>
              <TabsTrigger value="EARTHQUAKE">Earthquake</TabsTrigger>
              <TabsTrigger value="TYPHOON">Typhoon</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="disaster-epicenter" className="text-label">
                {type === 'EARTHQUAKE' ? 'Epicenter' : 'Center'}
              </Label>
              <Select value={presetIndex} onValueChange={setPresetIndex}>
                <SelectTrigger id="disaster-epicenter" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EPICENTER_PRESETS.map((item, index) => (
                    <SelectItem key={item.label} value={String(index)}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="disaster-magnitude" className="text-label">
                {type === 'EARTHQUAKE' ? 'Magnitude' : 'Strength'}
              </Label>
              <Input
                id="disaster-magnitude"
                type="number"
                step={0.1}
                min={MIN_MAGNITUDE}
                max={MAX_MAGNITUDE}
                value={magnitude}
                onChange={(event) =>
                  setMagnitude(
                    Math.min(
                      MAX_MAGNITUDE,
                      Math.max(MIN_MAGNITUDE, Number(event.target.value) || MIN_MAGNITUDE),
                    ),
                  )
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-line bg-subtle p-3">
            <span className="text-body">
              Impact radius{' '}
              <span className="text-body-medium tabular-nums">{preview?.radiusKm ?? '—'} km</span>
            </span>
            <EnvironmentList title="At risk" tone="danger" environments={pick(preview?.affected)} />
            <EnvironmentList title="Safe" tone="success" environments={pick(preview?.safe)} />
            {(preview?.unknown.length ?? 0) > 0 && (
              <EnvironmentList
                title="Unknown location"
                tone="neutral"
                environments={pick(preview?.unknown)}
              />
            )}
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
              Trigger {type === 'EARTHQUAKE' ? 'earthquake' : 'typhoon'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
