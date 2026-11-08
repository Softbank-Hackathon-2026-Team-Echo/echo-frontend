// 「환경 상태」 카드 · 목록 배지. 노트북 kit 감시자가 스스로 전환해 WAS 는 모르므로,
// 감시자 /state 와 손님 주소 응답 환경을 2초마다 읽어 어느 환경에 장애가 났고 지금 트래픽이 어디로 가는지만 보인다(데모용 관측값).
// ③ 지진 장면 토폴로지 환경 카드와 같은 전환 효과(duration-700 ease-out)를 쓴다
import { useOnpremLive } from '@/lib/api/onprem-watch';
import { k, t } from '@/lib/i18n';
import type { OnpremLiveStatus } from '@/lib/onprem-live';
import { cn } from '@/lib/utils';

export type OnpremLive = ReturnType<typeof useOnpremLive>;

const SUMMARY: Record<OnpremLiveStatus, string> = {
  onprem: k('On-premises healthy — 100% of traffic on-prem'),
  offline: k('On-premises outage detected — traffic switched to AWS Tokyo'),
  returning: k('On-premises recovered — moving traffic back to on-premises'),
};

const ONPREM_STATE: Record<OnpremLiveStatus, string> = {
  onprem: k('🟢 Healthy'),
  offline: k('🔴 Outage (connection lost)'),
  returning: k('🟡 Recovering'),
};

const TONE = {
  success: 'border-success-solid bg-success-bg text-success-fg',
  danger: 'border-danger-solid bg-danger-bg text-danger-fg',
  warning: 'border-warning-solid bg-warning-bg text-warning-fg',
  idle: 'border-line bg-surface text-fg-secondary',
} as const;

type Tone = keyof typeof TONE;

const ONPREM_TONE: Record<OnpremLiveStatus, Tone> = {
  onprem: 'success',
  offline: 'danger',
  returning: 'warning',
};

/** ③ 토폴로지 환경 카드와 같은 전환 효과 */
const EASE = 'transition-colors duration-700 ease-out motion-reduce:transition-none';

/** 환경 한 줄: 이름 · 상태 · 트래픽 % 막대 */
function EnvRow({
  id,
  name,
  state,
  tone,
  weight,
}: {
  id: string;
  name: string;
  state: string;
  tone: Tone;
  weight: number;
}) {
  return (
    <li
      data-testid={`onprem-live-row-${id}`}
      data-tone={tone}
      className={cn('flex flex-col gap-1.5 rounded-md border px-3 py-2', EASE, TONE[tone])}
    >
      <span className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-body-medium">{name}</span>
        <span className="text-body">
          {state} · {t('Traffic')}{' '}
          <span
            data-testid={`onprem-live-weight-${id}`}
            className="font-mono text-body-medium tabular-nums"
          >
            {weight}%
          </span>
        </span>
      </span>
      <span className="h-1 overflow-hidden rounded-full bg-subtle">
        <span
          className="block h-full rounded-full bg-brand transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${weight}%` }}
        />
      </span>
    </li>
  );
}

/** 서비스 상세 개요 탭 위 카드 */
export function OnpremLiveCard({ live }: { live: OnpremLive }) {
  const { status } = live;
  // 손님 응답을 아직 모르면 상태로 짐작한다(정상 = 온프레, 장애 · 복구 중 = 아직 AWS)
  const on = live.trafficOn ?? (status === 'onprem' ? 'onprem' : status ? 'aws' : null);
  const unreachable = !status && !live.watcher.isPending && !live.watcher.data?.watcher;
  return (
    <section
      data-testid="onprem-live"
      data-status={status ?? 'unknown'}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
    >
      <h2 className="text-title">{t('Environment status')}</h2>
      <p
        data-testid="onprem-live-summary"
        className={cn(
          'rounded-md border px-3 py-2 text-h2',
          EASE,
          status ? TONE[ONPREM_TONE[status]] : TONE.idle,
        )}
      >
        {status
          ? t(SUMMARY[status])
          : unreachable
            ? t('Watcher not reachable ({{reason}}).', {
                reason: live.watcher.data?.result.status
                  ? `HTTP ${live.watcher.data.result.status}`
                  : t('no response'),
              })
            : t('Checking…')}
      </p>
      {status && (
        <ul className="flex flex-col gap-2">
          <EnvRow
            id="onprem"
            name={t('On-premises')}
            state={t(ONPREM_STATE[status])}
            tone={ONPREM_TONE[status]}
            weight={on === 'onprem' ? 100 : 0}
          />
          <EnvRow
            id="aws"
            name={t('AWS Tokyo')}
            state={on === 'aws' ? t('🟢 Serving instead') : t('Standing by')}
            tone={on === 'aws' ? 'success' : 'idle'}
            weight={on === 'aws' ? 100 : 0}
          />
        </ul>
      )}
    </section>
  );
}

/** 서비스 목록의 온프레 연결 행에만 붙인다. 이 행만 2초마다 감시자 · 손님 주소를 읽는다 */
export function OnpremLiveRowBadge() {
  const live = useOnpremLive(true);
  return <OnpremLiveBadge status={live.status} />;
}

/** 서비스 목록 실행 환경 칸 옆 배지. 온프레 정상이면 아무것도 그리지 않는다 */
export function OnpremLiveBadge({ status }: { status: OnpremLiveStatus | null }) {
  if (status !== 'offline' && status !== 'returning') return null;
  return (
    <span
      data-testid="onprem-live-badge"
      className={cn(
        'ml-2 rounded-sm px-1.5 text-label',
        status === 'offline' ? 'bg-danger-bg text-danger-fg' : 'bg-warning-bg text-warning-fg',
      )}
    >
      {status === 'offline' ? t('Offline → AWS standing in') : t('Returning')}
    </span>
  );
}
