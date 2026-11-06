// 서비스 지표 (echo-was GET /services/{id}/metrics). 환경별 rps · 성공률 · p95 시계열과 요약
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from './client';
import { queryKeys } from './query-keys';

export const METRICS_RANGES = ['15m', '1h', '6h'] as const;
export type MetricsRange = (typeof METRICS_RANGES)[number];

// 범위가 길수록 점 간격을 넓혀 점 수를 비슷하게 둔다
const STEP_BY_RANGE: Record<MetricsRange, string> = { '15m': '10s', '1h': '30s', '6h': '3m' };
const POLL_MS = 15_000;

export function useServiceMetrics(
  orgId: string | undefined,
  serviceId: string | undefined,
  range: MetricsRange,
) {
  return useQuery({
    queryKey: queryKeys.serviceMetrics(orgId ?? '', serviceId ?? '', range),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/services/{service_id}/metrics', {
          params: {
            path: { org_id: orgId ?? '', service_id: serviceId ?? '' },
            query: { range, step: STEP_BY_RANGE[range] },
          },
        }),
      ),
    enabled: Boolean(orgId && serviceId),
    refetchInterval: POLL_MS,
  });
}
