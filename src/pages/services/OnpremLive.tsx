// 온프레 실시간 → 토폴로지 표시 · 목록 배지. 노트북 kit 감시자가 스스로 전환해 WAS 는 모르므로,
// 감시자 /state 와 손님 주소 응답 환경을 2초마다 읽어 별도 카드 없이 토폴로지 안(노드 표시 · 갈래 비율 · 상태 줄)에서만 보인다(데모용 관측값)
import { useOnpremLive } from '@/lib/api/onprem-watch';
import type { ServiceDetail } from '@/lib/api/types';
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

/** 토폴로지 환경 노드에 붙일 표시: ③ 지진 피해 환경과 같은 빨간 테두리 · 경고 아이콘 · 라벨을 재사용한다 */
export type TopologyAlert = { tone: 'danger' | 'warning' | 'success'; label: string };

/** 온프레 실시간 → 토폴로지에 넘길 값. 별도 카드 없이 노드 표시 · 상태 줄 · 캡션으로만 보인다 */
export type OnpremTopologyView = {
  status: OnpremLiveStatus | null;
  /** 상태 줄(③ 「이전 진행 중」 자리) 한 줄. 평소엔 없다 */
  line?: { tone: 'danger' | 'warning'; text: string };
  /** 환경 id → 노드 표시 */
  alerts: Map<string, TopologyAlert>;
  caption: string;
};

export function onpremTopologyView(
  service: Pick<ServiceDetail, 'environments'>,
  live: Pick<OnpremLive, 'status' | 'trafficOn'>,
): OnpremTopologyView {
  const { status } = live;
  const on = live.trafficOn ?? (status === 'onprem' ? 'onprem' : status ? 'aws' : null);
  const alerts = new Map<string, TopologyAlert>();
  const onprem = service.environments.find((link) => link.environment.kind === 'onprem');
  const aws = service.environments.find((link) => link.environment.kind === 'aws');
  if (onprem && status === 'offline')
    alerts.set(onprem.environment.id, { tone: 'danger', label: t(ONPREM_STATE.offline) });
  if (onprem && status === 'returning')
    alerts.set(onprem.environment.id, { tone: 'warning', label: t(ONPREM_STATE.returning) });
  if (aws && on === 'aws' && status !== 'onprem')
    alerts.set(aws.environment.id, { tone: 'success', label: t('🟢 Serving instead') });
  const line =
    status === 'offline'
      ? { tone: 'danger' as const, text: t(SUMMARY.offline) }
      : status === 'returning'
        ? { tone: 'warning' as const, text: t(SUMMARY.returning) }
        : undefined;
  return { status, line, alerts, caption: t('Live observation (laptop watcher)') };
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
