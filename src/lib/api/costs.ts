// 클라우드 비용 (echo-was docs/api/costs.md). 서버는 목록가로 추정하고 청구 실측은 일별 값을 따로 준다
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from './client';
import { queryKeys } from './query-keys';

export function useCloudCosts(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cloudCosts(orgId ?? ''),
    queryFn: () =>
      unwrap(api.GET('/api/v1/orgs/{org_id}/costs', { params: { path: { org_id: orgId ?? '' } } })),
    enabled: Boolean(orgId),
    // 단가 파일과 환경 목록으로 계산해서 자주 바뀌지 않는다
    staleTime: 5 * 60_000,
  });
}

/** 금액은 소수 넷째 자리까지가 서버 정밀도다 */
export function usd(value: number, digits = 2): string {
  return `$${value.toFixed(digits)}`;
}
