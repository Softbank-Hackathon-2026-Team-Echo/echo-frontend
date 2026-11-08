// 서비스 화면의 「온프레 실시간」 덮어 그리기(순수 함수). 노트북 kit 감시자가 스스로 전환해 WAS 는 모르므로,
// 감시자 상태 · 손님 응답 환경으로 지금 트래픽이 실제로 어디로 가는지 계산한다. 데모용 관측값이다
import type { ServiceDetail, ServiceEnvironment } from '@/lib/api/types';
import { watchKind } from '@/lib/onprem-watch';

/** onprem = 온프레 정상, offline = 온프레 오프라인 · AWS 대체 중, returning = 복귀 중 */
export type OnpremLiveStatus = 'onprem' | 'offline' | 'returning';

/** 서비스에 온프레 환경 연결이 있을 때만 덮어 그린다 */
export function hasOnpremLink(service: Pick<ServiceDetail, 'environments'>): boolean {
  return service.environments.some((link) => link.environment.kind === 'onprem');
}

/**
 * 감시자 state 와 손님 응답 환경 → 사람 말 상태.
 * PROMOTED = 오프라인. NORMAL · PROMOTED 가 아닌 상태(FROZEN · FAILBACK 계열) = 복귀 중.
 * NORMAL 이어도 손님이 aws 로 답하면 트래픽은 아직 AWS 다. 둘 다 모르면 null
 */
export function liveStatus(
  watcherState: string | null | undefined,
  guestEnvironment: string | null | undefined,
): OnpremLiveStatus | null {
  const guest = guestEnvironment ? watchKind(guestEnvironment) : null;
  if (watcherState === 'PROMOTED') return 'offline';
  if (watcherState && watcherState !== 'NORMAL') return 'returning';
  if (guest === 'aws') return 'offline';
  if (guest === 'onprem') return 'onprem';
  return watcherState === 'NORMAL' ? 'onprem' : null;
}

/** 실제 트래픽 쪽: 감시자 PROMOTED 이거나 손님이 aws 로 답하면 aws */
export function liveTrafficOn(
  watcherState: string | null | undefined,
  guestEnvironment: string | null | undefined,
): 'aws' | 'onprem' | null {
  const guest = guestEnvironment ? watchKind(guestEnvironment) : null;
  if (watcherState === 'PROMOTED' || guest === 'aws') return 'aws';
  if (guest === 'onprem') return 'onprem';
  return null;
}

/**
 * 트래픽이 AWS 로 가 있으면 비율만 바꾼 서비스를 돌려준다(온프레 0 · 첫 AWS 연결 100).
 * 역할 · 연결 목록은 그대로라 토폴로지 그래프 구조는 바뀌지 않는다. 바꿀 것이 없으면 같은 참조를 돌려준다
 */
export function applyLiveTraffic(
  service: ServiceDetail,
  trafficOn: 'aws' | 'onprem' | null,
): ServiceDetail {
  if (trafficOn !== 'aws') return service;
  const aws = service.environments.find((link) => link.environment.kind === 'aws');
  const environments = service.environments.map((link): ServiceEnvironment => {
    const weight = link === aws ? 100 : link.environment.kind === 'onprem' ? 0 : link.trafficWeight;
    return weight === link.trafficWeight ? link : { ...link, trafficWeight: weight };
  });
  return environments.every((link, index) => link === service.environments[index])
    ? service
    : { ...service, environments };
}

/** 관측한 트래픽이 콘솔 등록값과 다를 때 KPI 칸에 보일 환경 · 비율. 같으면 undefined */
export function observedTraffic(
  service: ServiceDetail,
  trafficOn: 'aws' | 'onprem' | null,
): { name: string; weight: number } | undefined {
  if (trafficOn !== 'aws') return undefined;
  const aws = service.environments.find((link) => link.environment.kind === 'aws');
  return aws ? { name: aws.environment.name, weight: 100 } : undefined;
}

/** 콘솔 등록값(WAS) 요약: 주 환경 이름 · 비율. 주석 문구에 쓴다 */
export function registeredTraffic(service: ServiceDetail): { name: string; weight: number } | null {
  const serving = service.environments.find((link) => link.role === 'SERVING');
  return serving ? { name: serving.environment.name, weight: serving.trafficWeight } : null;
}
