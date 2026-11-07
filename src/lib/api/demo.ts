// 시연 조직 복귀(P2). 계약은 시연 계획 demo-org/SPEC.md(echo-was `feat/demo-org-snapshot`, 아직 운영 OpenAPI 에 없음)라
// 생성 타입이 아니라 apiFetch + 손으로 쓴 타입을 쓴다. 서버가 배포되면 `pnpm gen:api` 뒤 api + unwrap 으로 바꾼다.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { queryKeys } from '@/lib/api/query-keys';

/** 서버 단계 상태. 모르는 값이 와도 화면은 원래 값을 그대로 보인다 */
export type DemoStepStatus =
  | 'OK'
  | 'DONE'
  | 'STARTED'
  | 'WAITING'
  | 'MANUAL_REQUIRED'
  | 'FAILED'
  | 'KEPT'
  | 'WOULD_DO'
  | (string & {});

export type DemoRestoreItem = {
  targetType: string;
  targetId: string | null;
  label: string | null;
  action: string | null;
  status: DemoStepStatus;
  code: string | null;
  detail: string | null;
};

export type DemoRestoreStep = { step: string; status: DemoStepStatus; items: DemoRestoreItem[] };

export type DemoRestoreResult = {
  snapshotId: string;
  snapshotTakenAt: string;
  dryRun: boolean;
  restored: boolean;
  callAgain: boolean;
  steps: DemoRestoreStep[];
  manualRequired: string[];
};

/** POST …/demo/restore. 여러 번 불러도 안전하다(서버 멱등). 조치가 있었으면 조직 화면 데이터를 다시 부른다 */
export function useDemoRestore(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dryRun: boolean) =>
      apiFetch<DemoRestoreResult>(`/orgs/${orgId}/demo/restore`, {
        method: 'POST',
        body: JSON.stringify({ dryRun }),
      }),
    onSuccess: (result) => {
      if (!result.dryRun) queryClient.invalidateQueries({ queryKey: queryKeys.org(orgId) });
    },
  });
}
