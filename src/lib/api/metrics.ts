// 서비스 대시보드 지표 (echo-was docs/api/metrics.md). Prometheus 를 못 읽어도 200 이고 metricsStatus 로 알린다
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from './client';
import { queryKeys } from './query-keys';

const METRICS_RANGE = '15m';
const METRICS_STEP = '10s';
// 점 간격과 같다. 실시간 채널이 없어 이전 중 숫자가 움직이게 하려면 다시 불러야 한다
const METRICS_POLL_MS = 10_000;

export function useServiceMetrics(orgId: string | undefined, serviceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.serviceMetrics(orgId ?? '', serviceId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/services/{service_id}/metrics', {
          params: {
            path: { org_id: orgId ?? '', service_id: serviceId ?? '' },
            query: { range: METRICS_RANGE, step: METRICS_STEP },
          },
        }),
      ),
    enabled: Boolean(orgId && serviceId),
    refetchInterval: METRICS_POLL_MS,
  });
}
