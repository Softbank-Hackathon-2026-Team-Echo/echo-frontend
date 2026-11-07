import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import type { Disaster } from '@/lib/api/disasters';
import type { EnvironmentSummary } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { DisasterMap } from './DisasterMap';

/** 연출이 떠 있는 시간. 그 뒤 저절로 닫힌다(누르거나 Esc 로 먼저 닫을 수 있다) */
export const ARRIVAL_SHOW_MS = 4_500;

function planLine(disaster: Disaster) {
  if (disaster.plans.some((plan) => plan.outcome === 'APPROVED')) return t('Migration started');
  if (disaster.plans.some((plan) => plan.outcome === 'PENDING_APPROVAL')) {
    return t('Migration waiting for approval');
  }
  return null;
}

/**
 * 새 재난이 들어온 순간의 전체 화면 연출(R2b 충격 트리거의 큰 화면 쪽).
 * 지도에서 진원지부터 영향 반경까지 파동이 퍼지고, 뒤의 앱 화면은 AppShell 이 흔든다.
 * 시뮬레이션 재난이면 SIMULATED 를 숨기지 않는다(심사 규칙)
 */
export function DisasterArrival({
  disaster,
  environments,
  reducedMotion,
  onDone,
}: {
  disaster: Disaster;
  environments: EnvironmentSummary[];
  reducedMotion: boolean;
  onDone: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, ARRIVAL_SHOW_MS);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onDone]);

  const affected = new Set(disaster.affectedEnvironmentIds);
  const plan = planLine(disaster);
  const place = disaster.feedEvent?.place ?? disaster.epicenterLabel;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc 로도 닫힌다(위 keydown)
    <div
      role="alert"
      aria-live="assertive"
      data-testid="disaster-arrival"
      className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-overlay p-gutter fade-in-0"
      onClick={onDone}
    >
      <div className="flex w-full max-w-xl animate-in flex-col gap-3 rounded-xl border-2 border-danger-solid bg-surface p-4 shadow-xl zoom-in-95">
        <header className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-1.5 text-overline uppercase text-danger-fg">
              <TriangleAlert aria-hidden className="size-4" />
              {t('Disaster detected')}
            </p>
            <h2 className="font-mono text-h1 tabular-nums">
              {t('M{{magnitude}} · {{place}}', {
                magnitude: disaster.magnitude.toFixed(1),
                place,
              })}
            </h2>
          </div>
          {disaster.simulated && <SimulatedBadge />}
        </header>
        <DisasterMap
          epicenter={disaster.epicenter}
          radiusKm={disaster.radiusKm}
          environments={environments}
          affected={affected}
          ripple={!reducedMotion}
        />
        <p className="text-body-medium">
          {t('At risk: {{count}} · radius {{radius}} km', {
            count: affected.size,
            radius: Math.round(disaster.radiusKm),
          })}
          {plan && <span className="text-danger-fg"> · {plan}</span>}
        </p>
        <p className="text-caption text-fg-muted">{t('Click anywhere to close')}</p>
      </div>
    </div>
  );
}
