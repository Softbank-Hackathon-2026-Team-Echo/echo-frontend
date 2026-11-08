import { Smartphone, TriangleAlert, Vibrate } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ErrorState } from '@/components/ErrorState';
import { Logo } from '@/components/Logo';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useNow } from '@/hooks/useNow';
import {
  DISASTER_MAGNITUDES,
  type DisasterPlan,
  useActiveDisasters,
  useCreateDisaster,
  useEndDisaster,
} from '@/lib/api/disasters';
import { useEnvironments } from '@/lib/api/environments';
import { useCurrentOrg } from '@/lib/api/me';
import { useServices } from '@/lib/api/services';
import type { EnvironmentSummary, ServiceSummary } from '@/lib/api/types';
import { environmentCoordinates } from '@/lib/geo';
import { t } from '@/lib/i18n';
import { hasRole, ROLE_LABELS, roleLabel } from '@/lib/roles';
import {
  clampThreshold,
  DEFAULT_SHAKE_THRESHOLD,
  lockRemainingMs,
  MAX_SHAKE_THRESHOLD,
  MIN_SHAKE_THRESHOLD,
  type MotionSupport,
  motionEventClass,
  motionMagnitude,
  needsMotionPermission,
  requestMotionPermission,
  SHAKE_LOCK_MS,
  shouldTrigger,
} from '@/lib/shake';
import { disasterPlanReasonLabel } from '@/lib/status';
import { cn } from '@/lib/utils';

// 시연 기본값 (지민 R2b): 서비스 demo · 환경 aws-tokyo
const DEFAULT_SERVICE = 'demo';
const DEFAULT_ENVIRONMENT = 'aws-tokyo';
// 시연 기본값: M6.8 — 7.0 이상이면 긴급 트래픽 계획이 자동 승인돼 DB 포함 이전을 막는다(2026-11-08 리허설)
const DEFAULT_MAGNITUDE = 6.8;
/** 화면 숫자를 이 간격보다 자주 고치지 않는다(센서는 초당 60번쯤 온다) */
const DISPLAY_MS = 100;
/** 흉내내기는 이 시간 안에 두 번 눌러야 보낸다. 리모컨과 같다 */
const PRESS_AGAIN_MS = 5_000;

function pickService(items: ServiceSummary[]): ServiceSummary | undefined {
  return (
    items.find((item) => item.name === DEFAULT_SERVICE) ??
    items.find((item) => item.name.includes(DEFAULT_SERVICE)) ??
    items[0]
  );
}

function pickEnvironment(items: EnvironmentSummary[]): EnvironmentSummary | undefined {
  return items.find((item) => item.name === DEFAULT_ENVIRONMENT) ?? items[0];
}

function planText(plan: DisasterPlan) {
  if (plan.outcome === 'APPROVED') return t('Migration started');
  const reason = disasterPlanReasonLabel(plan.reason ?? '');
  return plan.outcome === 'SKIPPED'
    ? t('Migration skipped: {{reason}}', { reason })
    : t('Migration waiting: {{reason}}', { reason });
}

/** 목업 명시 규칙: 시연용 모의 재난임을 큰 글씨로 숨기지 않는다 */
function BigSimulatedBadge() {
  return (
    <p
      className="rounded-lg border-2 border-warning-solid bg-warning-bg px-3 py-2 text-center text-warning-fg"
      data-testid="simulated-badge"
    >
      <span className="block font-mono text-h2">SIMULATED</span>
      <span className="text-small">{t('Simulated drill disaster. Not a real earthquake.')}</span>
    </p>
  );
}

/**
 * R2b 시연용 충격 트리거: 휴대폰을 흔들거나 떨어뜨리면(DeviceMotion) 재난 선언 API 를 한 번 부른다.
 * 본문은 대시보드 재난 버튼·S01-R 리모컨과 같다({ type, magnitude, epicenter })
 */
export default function ShakeRemotePage() {
  const { slug } = useParams();
  const { organization, isPending, isError, error, refetch } = useCurrentOrg(slug);
  const orgId = organization?.id ?? '';
  const environments = useEnvironments(organization?.id);
  const services = useServices(organization?.id);
  const active = useActiveDisasters(organization?.id);
  const create = useCreateDisaster(orgId);
  const end = useEndDisaster(orgId);

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [environmentId, setEnvironmentId] = useState<string | null>(null);
  const [magnitude, setMagnitude] = useState(DEFAULT_MAGNITUDE);
  const [threshold, setThreshold] = useState(DEFAULT_SHAKE_THRESHOLD);
  const [armed, setArmed] = useState(false);
  const [support, setSupport] = useState<MotionSupport | null>(null);
  const [current, setCurrent] = useState(0);
  const [peak, setPeak] = useState(0);
  const [lastTriggeredAt, setLastTriggeredAt] = useState<number | null>(null);
  // 재난은 시뮬레이션이어도 이전은 실제라, 흔들림 한 번에 트래픽이 움직이기 전에 사람이 확인한다
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isPressedOnce, setIsPressedOnce] = useState(false);
  const locked = lockRemainingMs({ lastTriggeredAt, now: Date.now() }) > 0;
  const now = useNow(locked, 250);

  const serviceItems = services.data?.items ?? [];
  const environmentItems = environments.data?.items ?? [];
  const service = serviceItems.find((item) => item.id === serviceId) ?? pickService(serviceItems);
  const environment =
    environmentItems.find((item) => item.id === environmentId) ?? pickEnvironment(environmentItems);
  const epicenter = environment ? environmentCoordinates(environment) : null;
  const latest = active.data?.at(-1);
  const hasActive = Boolean(latest);
  const allowed = organization ? hasRole(organization.role, 'DEVELOPER') : false;
  // 진행 중 재난을 모르는 동안(목록 로딩 · 조회 실패)은 보내지 않는다
  const notReady = hasActive || !active.isSuccess || !epicenter || !isConfirmed;
  const blocked = notReady || create.isPending || !allowed;

  // 센서 콜백은 한 번만 붙이고, 판정에 쓰는 최신 값은 ref 로 읽는다
  const gate = useRef({
    blocked,
    threshold,
    input: epicenter ? { type: 'EARTHQUAKE' as const, magnitude, epicenter } : null,
  });
  gate.current = {
    blocked,
    threshold,
    input: epicenter ? { type: 'EARTHQUAKE', magnitude, epicenter } : null,
  };
  // 같은 순간 이벤트가 여러 번 와도 한 번만 보내도록 상태가 아니라 ref 로 바로 잠근다
  const lockRef = useRef<number | null>(null);
  const shownAt = useRef(0);
  const createRef = useRef(create.mutate);
  createRef.current = create.mutate;

  function handleSample(value: number, fromButton = false) {
    const nowMs = Date.now();
    if (fromButton || nowMs - shownAt.current >= DISPLAY_MS) {
      shownAt.current = nowMs;
      setCurrent(value);
    }
    setPeak((previous) => Math.max(previous, value));
    const { blocked: isBlocked, threshold: limit, input } = gate.current;
    const fire = shouldTrigger(value, limit, {
      armed: true,
      blocked: isBlocked,
      lastTriggeredAt: lockRef.current,
      now: nowMs,
    });
    if (!fire || !input) return;
    lockRef.current = nowMs;
    setLastTriggeredAt(nowMs);
    // 한 번 보내면 감지를 끈다. 켜 둔 채 종료하면 다음 흔들림이 재난을 또 낸다
    setArmed(false);
    setIsConfirmed(false);
    navigator.vibrate?.([200, 100, 200]);
    createRef.current(input);
  }
  const handleRef = useRef(handleSample);
  handleRef.current = handleSample;

  useEffect(() => {
    if (!armed) return;
    const listener = (event: DeviceMotionEvent) => handleRef.current(motionMagnitude(event));
    window.addEventListener('devicemotion', listener);
    return () => window.removeEventListener('devicemotion', listener);
  }, [armed]);

  // 다른 기기에서 재난이 생겨도 같다
  useEffect(() => {
    if (!hasActive) return;
    setArmed(false);
    setIsConfirmed(false);
  }, [hasActive]);

  useEffect(() => {
    if (!isPressedOnce) return;
    const timer = window.setTimeout(() => setIsPressedOnce(false), PRESS_AGAIN_MS);
    return () => window.clearTimeout(timer);
  }, [isPressedOnce]);

  function handleConfirm(checked: boolean) {
    setIsConfirmed(checked);
    if (checked) return;
    setArmed(false);
    setIsPressedOnce(false);
  }

  function handleSimulate() {
    if (!isPressedOnce) {
      setIsPressedOnce(true);
      return;
    }
    setIsPressedOnce(false);
    handleSample(clampThreshold(threshold) + 15, true);
  }

  async function handleArm() {
    if (armed) {
      setArmed(false);
      return;
    }
    // iOS 는 이 누름 안에서 권한을 물어야 한다
    const result = await requestMotionPermission(motionEventClass());
    setSupport(result);
    if (result === 'granted') setArmed(true);
  }

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !organization) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-4 p-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64" />
      </main>
    );
  }

  const result = create.data ?? latest;
  const plans = result?.plans ?? [];
  // useNow 는 다시 그리기용이다. 막 보낸 직후에는 그 값이 낡았으므로 지금 시각과 큰 쪽을 쓴다
  const lockLeft = lockRemainingMs({
    lastTriggeredAt,
    now: Math.max(now, Date.now()),
    lockMs: SHAKE_LOCK_MS,
  });
  const serviceName = (id: string) =>
    serviceItems.find((item) => item.id === id)?.name ?? id.slice(0, 8);
  const over = current > clampThreshold(threshold);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-4 bg-canvas p-4">
      <header className="flex items-center justify-between gap-2">
        <Logo className="h-5" />
        <span className="text-small text-fg-secondary">{roleLabel(organization.role)}</span>
      </header>

      <div className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-h2">
          <Smartphone aria-hidden className="size-6 text-brand" />
          {t('Drop trigger')}
        </h1>
        <p className="text-body-medium">
          {t('Shake or drop the phone to declare a disaster (simulated drill disaster).')}
        </p>
        {(!latest || latest.simulated) && <BigSimulatedBadge />}
      </div>

      <section
        aria-label={t('Current acceleration')}
        className="flex flex-col items-center gap-1 rounded-xl border border-line bg-surface p-4"
      >
        <span className="text-caption text-fg-muted">{t('Current acceleration')}</span>
        <output
          aria-live="off"
          data-testid="acceleration"
          className={cn('font-mono text-h1 tabular-nums', over ? 'text-danger-fg' : 'text-fg')}
        >
          {current.toFixed(1)}
        </output>
        <span className="text-small text-fg-secondary">
          m/s² · {t('Peak {{value}}', { value: peak.toFixed(1) })}
        </span>
        <div className="h-2 w-full overflow-hidden rounded-full bg-subtle">
          <div
            className={cn('h-full', over ? 'bg-danger-solid' : 'bg-brand')}
            style={{ width: `${Math.min(100, (current / MAX_SHAKE_THRESHOLD) * 100)}%` }}
          />
        </div>
      </section>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="shake-threshold" className="text-label">
          {t('Threshold {{value}} m/s²', { value: threshold })}
        </Label>
        <input
          id="shake-threshold"
          type="range"
          min={MIN_SHAKE_THRESHOLD}
          max={MAX_SHAKE_THRESHOLD}
          step={1}
          value={threshold}
          onChange={(event) => setThreshold(clampThreshold(Number(event.target.value)))}
          className="w-full accent-brand"
        />
        <p className="text-caption text-fg-muted">
          {t('A phone lying still reads about 9.8. Locked for 10 seconds after each send.')}
        </p>
      </div>

      {latest ? (
        <section
          role="status"
          className="flex flex-col gap-2 rounded-xl border border-danger-solid bg-surface p-4"
        >
          <span className="text-body-medium">
            {t('A disaster is active: M{{magnitude}} {{place}}', {
              magnitude: latest.magnitude.toFixed(1),
              place: latest.epicenterLabel,
            })}
          </span>
          <span className="text-small text-fg-secondary">{t('End it before the next drop.')}</span>
          <RoleButton
            requires="DEVELOPER"
            variant="outline"
            className="h-12"
            disabled={end.isPending}
            onClick={() =>
              end.mutate(latest.id, {
                onSuccess: () => {
                  create.reset();
                  lockRef.current = null;
                  setLastTriggeredAt(null);
                  setPeak(0);
                },
              })
            }
          >
            {latest.simulated ? t('End simulation') : t('End disaster')}
          </RoleButton>
        </section>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shake-service" className="text-label">
              {t('Service')}
            </Label>
            <Select value={service?.id ?? ''} onValueChange={setServiceId}>
              <SelectTrigger id="shake-service" className="h-12 w-full">
                <SelectValue placeholder={t('No services yet')} />
              </SelectTrigger>
              <SelectContent>
                {serviceItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shake-environment" className="text-label">
              {t('Affected environment')}
            </Label>
            <Select value={environment?.id ?? ''} onValueChange={setEnvironmentId}>
              <SelectTrigger id="shake-environment" className="h-12 w-full">
                <SelectValue placeholder={t('near Tokyo')} />
              </SelectTrigger>
              <SelectContent>
                {environmentItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-caption text-fg-muted">
              {t('The epicenter is placed on this environment.')}
            </p>
            {environment && !epicenter && (
              <p role="alert" className="text-small text-danger-fg">
                {t(
                  'This environment has no coordinates, so nothing can be sent. Pick another one.',
                )}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shake-magnitude" className="text-label">
              {t('Magnitude')}
            </Label>
            <Select
              value={String(magnitude)}
              onValueChange={(value) => setMagnitude(Number(value))}
            >
              <SelectTrigger id="shake-magnitude" className="h-12 w-full">
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

          <div className="flex flex-col gap-2 rounded-lg bg-danger-bg p-3 text-small text-danger-fg">
            <p>{t('The disaster is simulated, but the migrations it starts are real.')}</p>
            <p>{t('Every service on the affected environment moves, not only the one above.')}</p>
            <label className="flex items-start gap-2 text-body-medium">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-brand"
                checked={isConfirmed}
                onChange={(event) => handleConfirm(event.target.checked)}
              />
              {t('I understand real traffic will move')}
            </label>
          </div>
        </>
      )}

      {result && (
        <section
          aria-label={t('Result')}
          className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-4"
        >
          <span className="text-caption text-fg-muted">{t('Disaster ID')}</span>
          <code className="break-all font-mono text-small" data-testid="disaster-id">
            {result.id}
          </code>
          {result.simulated && <SimulatedBadge />}
          {plans.length === 0 ? (
            <p className="text-small text-fg-secondary">
              {t('No emergency migration plan was created.')}
            </p>
          ) : (
            plans.map((plan) => (
              <p
                key={plan.planId ?? plan.serviceId}
                className={cn(
                  'flex flex-col text-small',
                  plan.serviceId === service?.id ? 'text-fg' : 'text-fg-secondary',
                )}
              >
                <span>
                  {serviceName(plan.serviceId)} · {planText(plan)}
                </span>
                {plan.planId && (
                  <Link
                    className="text-brand underline"
                    to={`/o/${organization.slug}/migrations/${plan.planId}`}
                  >
                    {t('Emergency migration plan created. Open it')}
                  </Link>
                )}
              </p>
            ))
          )}
        </section>
      )}

      <div className="mt-auto flex flex-col gap-2">
        {!allowed && (
          <p className="text-center text-small text-fg-muted">
            {t('Requires {{role}}', { role: ROLE_LABELS.DEVELOPER })}
          </p>
        )}
        {active.isError && (
          <p role="alert" className="rounded-lg bg-danger-bg p-3 text-small text-danger-fg">
            {t('Could not check for active disasters. Sending stays blocked until this loads.')}
          </p>
        )}
        {support === 'denied' && (
          <p role="alert" className="rounded-lg bg-danger-bg p-3 text-small text-danger-fg">
            {t('Motion permission was denied. Allow motion access in Safari settings and reload.')}
          </p>
        )}
        {support === 'unsupported' && (
          <p role="alert" className="rounded-lg bg-warning-bg p-3 text-small text-warning-fg">
            {t('This browser has no motion sensor. Use the simulate button.')}
          </p>
        )}
        {lockLeft > 0 && (
          <p className="text-center text-small text-fg-secondary">
            {t('Locked for {{seconds}}s', { seconds: Math.ceil(lockLeft / 1000) })}
          </p>
        )}
        <RoleButton
          requires="DEVELOPER"
          variant={armed ? 'outline' : 'destructive'}
          className="h-20 w-full text-h3"
          disabled={!armed && notReady}
          onClick={handleArm}
        >
          <TriangleAlert aria-hidden />
          {armed
            ? t('Watching for a drop. Tap to stop')
            : needsMotionPermission(motionEventClass())
              ? t('Allow motion and start watching')
              : t('Start watching for a drop')}
        </RoleButton>
        <RoleButton
          requires="DEVELOPER"
          variant="ghost"
          className="h-10"
          disabled={blocked || lockLeft > 0}
          onClick={handleSimulate}
        >
          <Vibrate aria-hidden />
          {isPressedOnce ? t('Press again to move traffic') : t('Simulate an impact')}
        </RoleButton>
      </div>
    </main>
  );
}
