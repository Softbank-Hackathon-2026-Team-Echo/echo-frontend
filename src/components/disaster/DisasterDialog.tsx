import { Activity, TriangleAlert, Wind } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
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
  type DisasterPlan,
  type DisasterType,
  EPICENTER_PRESETS,
  EVACUATION_MIN_MAGNITUDE,
  LIVE_FEED,
  radiusForMagnitude,
  useCreateDisaster,
  useDisasterPreview,
} from '@/lib/api/disasters';
import { useEnvironments } from '@/lib/api/environments';
import { useMe } from '@/lib/api/me';
import { type LatLng, nearLabel } from '@/lib/geo';
import { k, t } from '@/lib/i18n';
import { disasterPlanReasonLabel } from '@/lib/status';
import { cn } from '@/lib/utils';
import { DisasterMap } from './DisasterMap';

// 규모 M5.0 ~ M9.0, 0.2 단계 (데모 기본 M7.2)
const MAGNITUDES = Array.from({ length: 21 }, (_, index) => Number((5 + index * 0.2).toFixed(1)));

const TYPES: { type: DisasterType; label: string; hint: string; icon: typeof Activity }[] = [
  { type: 'EARTHQUAKE', label: k('Earthquake'), hint: 'M5–M9', icon: Activity },
  { type: 'TYPHOON', label: k('Typhoon'), hint: k('Cat. 1–5'), icon: Wind },
];

const NO_PREVIEW = {
  affected: [] as string[],
  safe: [] as string[],
  unknown: [] as string[],
  meetsThreshold: false,
};

/** 만들기 응답에만 건너뛴 서비스가 있어서, 그 순간의 결과를 알린다 */
function announce(plans: DisasterPlan[]) {
  const started = plans.filter((plan) => plan.outcome === 'APPROVED').length;
  const held = plans.filter((plan) => plan.outcome !== 'APPROVED');
  if (started > 0) {
    toast.success(
      started === 1
        ? t('1 migration started')
        : t('{{total}} migrations started', { total: started }),
    );
  }
  for (const plan of held) {
    toast.warning(
      plan.outcome === 'SKIPPED'
        ? t('Migration skipped: {{reason}}', {
            reason: disasterPlanReasonLabel(plan.reason ?? ''),
          })
        : t('Migration waiting: {{reason}}', {
            reason: disasterPlanReasonLabel(plan.reason ?? ''),
          }),
    );
  }
}

/** S01-D 재난 시뮬레이션: 지도를 눌러 진원지를 정하면 반경 안의 환경이 위험으로 바뀐다 */
export function DisasterDialog({
  open,
  onOpenChange,
  orgId,
  initialEpicenter,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  /** 처음 진원지(온보딩 훈련은 주 환경 근처). 없으면 첫 프리셋 */
  initialEpicenter?: LatLng;
  onCreated?: () => void;
}) {
  const environments = useEnvironments(orgId);
  const items = environments.data?.items ?? [];
  const create = useCreateDisaster(orgId);
  const me = useMe();
  const selfApproval = me.data?.organizations.find((item) => item.id === orgId)?.allowSelfApproval;
  const defaultPreset = EPICENTER_PRESETS[0];
  const [type, setType] = useState<DisasterType>('EARTHQUAKE');
  const [epicenter, setEpicenter] = useState<LatLng>(
    initialEpicenter ?? defaultPreset?.epicenter ?? { lat: 35.2, lng: 139.4 },
  );
  const [magnitude, setMagnitude] = useState(7.2);
  const [confirmed, setConfirmed] = useState(false);

  const previewQuery = useDisasterPreview(orgId, { type, magnitude, epicenter }, open);
  const preview = previewQuery.data ?? NO_PREVIEW;
  const radiusKm = radiusForMagnitude(magnitude);
  const affected = new Set(preview.affected);
  const triggers = preview.meetsThreshold;
  // 재난은 시뮬레이션이어도 이 경우에는 서버가 실제 이전 계획을 만든다
  const startsMigration = triggers && preview.affected.length > 0;
  const affectedNames = items
    .filter((item) => affected.has(item.id))
    .map((item) => item.name)
    .join(', ');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      { type, magnitude, epicenter },
      {
        onSuccess: (disaster) => {
          announce(disaster.plans);
          setConfirmed(false);
          onOpenChange(false);
          onCreated?.();
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {t('Simulate disaster')} <SimulatedBadge />
            </DialogTitle>
            <DialogDescription>
              {t(
                'Click the map to set the epicenter. The disaster is simulated, but the migrations it starts are real.',
              )}
            </DialogDescription>
          </DialogHeader>

          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="sr-only">{t('Disaster type')}</legend>
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
                    <span className="text-body-medium">{t(item.label)}</span>
                    <span className="text-caption text-fg-muted">{t(item.hint)}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <DisasterMap
            epicenter={epicenter}
            radiusKm={radiusKm}
            environments={items}
            affected={affected}
            onPick={setEpicenter}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="disaster-magnitude" className="text-label">
              {type === 'EARTHQUAKE' ? t('Magnitude') : t('Strength')}
            </Label>
            <Select
              value={String(magnitude)}
              onValueChange={(value) => setMagnitude(Number(value))}
            >
              <SelectTrigger id="disaster-magnitude" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAGNITUDES.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    M{value.toFixed(1)}
                    {/* 선택 칸에도 같은 글자가 들어가므로 짧게 쓴다 */}
                    {type === 'EARTHQUAKE' &&
                      value === EVACUATION_MIN_MAGNITUDE &&
                      ` ${t('(rule)')}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="font-mono text-mono text-fg-muted">
              {t('→ radius {{km}} km', { km: radiusKm })}
            </span>
            <span className="ml-auto text-small text-fg-secondary">
              {t('Epicenter {{place}}', { place: nearLabel(epicenter) })}
            </span>
          </div>

          <dl className="flex flex-col gap-1 text-small">
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-fg-secondary">{t('Evacuation rule')}</dt>
              <dd>
                {type === 'EARTHQUAKE'
                  ? t('Magnitude {{magnitude}} or above', {
                      magnitude: EVACUATION_MIN_MAGNITUDE.toFixed(1),
                    })
                  : t('No threshold yet. Every typhoon counts.')}
              </dd>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-fg-secondary">{t('Source')}</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <StatusBadge label={t('Manual (simulated)')} tone="neutral" />
                {/* 실제 지진 피드를 붙이면 이 자리에서 고른다 (11/2 2부: 시간이 되면 연동) */}
                <span className="text-fg-muted">
                  {LIVE_FEED.ready
                    ? t('Live feed ({{name}}) connected', { name: LIVE_FEED.name })
                    : t('Live feed ({{name}}) not connected yet', { name: LIVE_FEED.name })}
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
              {preview.affected.length === 1
                ? t('{{total}} environment affected', { total: 1 })
                : t('{{total}} environments affected', { total: preview.affected.length })}
              {' · '}
              {preview.safe.length === 1
                ? t('{{total}} safe target', { total: 1 })
                : t('{{total}} safe targets', { total: preview.safe.length })}
            </span>
            {preview.affected.length > 0 && (
              <span className="text-small text-fg-secondary">
                {triggers
                  ? t('Above the threshold. EchoPort creates emergency migrations.')
                  : t(
                      'Below M{{magnitude}}. Affected environments are flagged, but no evacuation is proposed.',
                      { magnitude: EVACUATION_MIN_MAGNITUDE.toFixed(1) },
                    )}
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
                    <StatusBadge label={t('At risk')} tone="warning" />
                  ) : preview.unknown.includes(environment.id) ? (
                    <StatusBadge label={t('Unknown location')} tone="neutral" />
                  ) : (
                    <StatusBadge label={t('Safe')} tone="success" />
                  )}
                </li>
              ))}
            </ul>
          </div>

          {startsMigration && (
            <div role="alert" className="flex flex-col gap-2 rounded-lg bg-danger-bg p-3">
              <p className="text-body-medium text-danger-fg">
                {t('This moves live traffic off {{names}}.', { names: affectedNames })}
              </p>
              <p className="text-small text-danger-fg">
                {selfApproval
                  ? t('Self-approval is on, so migrations start as soon as you confirm.')
                  : t('Each migration waits for another developer to approve it.')}
              </p>
              <label className="flex items-center gap-2 text-body">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                {t('I understand real traffic will move')}
              </label>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('Cancel')}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={
                create.isPending ||
                !items.length ||
                !previewQuery.data ||
                previewQuery.isPlaceholderData ||
                (startsMigration && !confirmed)
              }
            >
              {startsMigration ? t('Start disaster and migrate') : t('Simulate')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
