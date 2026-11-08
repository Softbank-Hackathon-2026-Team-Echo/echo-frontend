// 「온프레 실시간」 카드 · 목록 배지. 노트북 kit 감시자가 스스로 전환해 WAS 는 모르므로,
// 감시자 /state 와 손님 주소 응답 환경을 2초마다 읽어 지금 트래픽이 실제로 어디로 가는지 덮어 보인다(데모용 관측값)
import { useOnpremLive } from '@/lib/api/onprem-watch';
import { k, t } from '@/lib/i18n';
import type { OnpremLiveStatus } from '@/lib/onprem-live';
import { watchKind } from '@/lib/onprem-watch';
import { cn } from '@/lib/utils';
import { Legend, WatchStrip } from '@/pages/remote/OnpremWatchParts';
import { clock, kindLabel } from '@/pages/remote/onprem-watch-view';

export type OnpremLive = ReturnType<typeof useOnpremLive>;

const STATUS_TEXT: Record<OnpremLiveStatus, string> = {
  onprem: k('🟢 On-prem is serving'),
  offline: k('🔴 On-prem offline — AWS is serving instead'),
  returning: k('🟡 Returning — moving back to on-prem'),
};

const STATUS_TONE: Record<OnpremLiveStatus, string> = {
  onprem: 'border-success-solid bg-success-bg text-success-fg',
  offline: 'border-danger-solid bg-danger-bg text-danger-fg',
  returning: 'border-warning-solid bg-warning-bg text-warning-fg',
};

const signal = (value: boolean | null) => (value === null ? '—' : value ? t('OK') : t('down'));

/** 서비스 상세 개요 탭 위 카드 */
export function OnpremLiveCard({ live }: { live: OnpremLive }) {
  const { status, watch } = live;
  const watcher = live.watcher.data?.watcher ?? null;
  const answering = watch.current ? kindLabel(watchKind(watch.current)) : '—';
  const lastSwitch = watch.lastSwitch;
  return (
    <section
      data-testid="onprem-live"
      data-status={status ?? 'unknown'}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-title">{t('On-prem live')}</h2>
        <span className="text-caption text-fg-muted">{t('Laptop watcher, every 2 seconds')}</span>
      </div>
      <p
        data-testid="onprem-live-status"
        className={cn(
          'rounded-md border px-3 py-2 text-h2',
          status ? STATUS_TONE[status] : 'border-line text-fg-secondary',
        )}
      >
        {status ? t(STATUS_TEXT[status]) : t('Checking…')}
      </p>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-body">
        <span>
          {t('Answering environment')}:{' '}
          <span data-testid="onprem-live-env" className="text-body-medium">
            {answering}
          </span>
        </span>
        {live.trafficOn && (
          <span data-testid="onprem-live-traffic" className="font-mono tabular-nums">
            {live.trafficOn === 'aws' ? t('AWS 100% · On-prem 0% (offline)') : t('On-prem 100%')}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <WatchStrip samples={watch.samples} />
        <Legend />
      </div>
      <p className="text-small text-fg-secondary">
        {lastSwitch
          ? t('Last switch {{from}} → {{to}} at {{time}} ({{seconds}}s)', {
              from: kindLabel(watchKind(lastSwitch.from)),
              to: kindLabel(watchKind(lastSwitch.to)),
              time: clock(lastSwitch.at),
              seconds: lastSwitch.seconds.toFixed(1),
            })
          : watcher?.promotedAt
            ? t('Last promoted {{time}}', { time: clock(Date.parse(watcher.promotedAt)) })
            : t('No switch seen yet')}
        {watcher?.normalSince &&
          ` · ${t('Back to normal since {{time}}', { time: clock(Date.parse(watcher.normalSince)) })}`}
      </p>
      <p data-testid="onprem-live-watcher" className="text-small text-fg-secondary">
        {watcher
          ? t('Watcher {{state}} · epoch {{n}} · heartbeat {{hb}} · replication {{repl}}', {
              state: watcher.state ?? '—',
              n: watcher.epoch ?? '—',
              hb: signal(watcher.hb),
              repl: signal(watcher.repl),
            })
          : live.watcher.isPending
            ? t('Checking…')
            : t('Watcher not reachable ({{reason}}).', {
                reason: live.watcher.data?.result.status
                  ? `HTTP ${live.watcher.data.result.status}`
                  : t('no response'),
              })}
      </p>
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
