// AI 데이터 레지던시 (echo-was docs/api/ai-residency.md). 기록 없는 실행을 '안 나갔다' 로 세지 않는다
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from './client';
import { queryKeys } from './query-keys';

const SUMMARY_DAYS = 7;

export function useAiResidency(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.aiResidency(orgId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/ai/residency', {
          params: { path: { org_id: orgId ?? '' }, query: { days: SUMMARY_DAYS } },
        }),
      ),
    enabled: Boolean(orgId),
  });
}
