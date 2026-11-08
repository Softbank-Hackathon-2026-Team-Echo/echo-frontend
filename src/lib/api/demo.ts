// 시연 스냅샷·복구 (echo-was docs/api/demo-snapshot.md). 스키마에 아직 없어 apiFetch 로 부른다.
// 조직 ADMIN 사람 세션만 부를 수 있다(그 외 403). 스냅샷 발행은 지휘자가 직접 한다(화면에 버튼 없음)
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import { isApiError } from './errors';
import { queryKeys } from './query-keys';

export type DemoSnapshot = {
  id: string;
  takenAt: string;
  takenByUserId: string | null;
  services?: unknown[];
};

export type DemoStepStatus =
  | 'OK'
  | 'DONE'
  | 'STARTED'
  | 'WAITING'
  | 'MANUAL_REQUIRED'
  | 'FAILED'
  | 'KEPT'
  | 'WOULD_DO';

export type DemoRestoreItem = {
  targetType?: string | null;
  targetId?: string | null;
  label?: string | null;
  action?: string | null;
  status?: string | null;
  code?: string | null;
  detail?: string | null;
};

export type DemoRestoreStep = {
  step: string;
  status: DemoStepStatus | string;
  items: DemoRestoreItem[];
};

export type DemoRestoreResult = {
  snapshotId: string;
  snapshotTakenAt: string;
  dryRun: boolean;
  restored: boolean;
  callAgain: boolean;
  steps: DemoRestoreStep[];
  manualRequired: string[];
};

/** 가장 최근 스냅샷. 없으면(404 DEMO_SNAPSHOT_NOT_FOUND) null. ADMIN 이 아니면 부르지 않는다 */
export function useDemoSnapshot(orgId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.demoSnapshot(orgId ?? ''),
    queryFn: async () => {
      try {
        return await apiFetch<DemoSnapshot>(`/orgs/${orgId}/demo/snapshot`);
      } catch (error) {
        if (isApiError(error) && error.status === 404) return null;
        throw error;
      }
    },
    enabled: Boolean(orgId) && enabled,
  });
}

export function restoreDemo(orgId: string) {
  return apiFetch<DemoRestoreResult>(`/orgs/${orgId}/demo/restore`, {
    method: 'POST',
    body: JSON.stringify({ dryRun: false }),
  });
}

export const RESTORE_POLL_MS = 2_000;
export const RESTORE_TIMEOUT_MS = 5 * 60_000;

export type RestoreRun = {
  result: DemoRestoreResult;
  calls: number;
  elapsedMs: number;
  /** 5분 안에 callAgain 이 꺼지지 않았다. 다시 부르면 이어 간다(멱등) */
  timedOut: boolean;
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * restore 를 callAgain 이 꺼질 때까지 intervalMs 간격으로 다시 부른다(서버가 멱등).
 * 응답마다 onProgress 로 단계를 넘긴다. 실패(4xx·5xx)는 그대로 던진다
 */
export async function restoreUntilDone(
  call: () => Promise<DemoRestoreResult>,
  {
    intervalMs = RESTORE_POLL_MS,
    timeoutMs = RESTORE_TIMEOUT_MS,
    onProgress,
    isCancelled = () => false,
    now = () => Date.now(),
    sleep = wait,
  }: {
    intervalMs?: number;
    timeoutMs?: number;
    onProgress?: (result: DemoRestoreResult, calls: number) => void;
    isCancelled?: () => boolean;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<RestoreRun> {
  const started = now();
  let calls = 0;
  for (;;) {
    const result = await call();
    calls += 1;
    onProgress?.(result, calls);
    const elapsedMs = now() - started;
    if (!result.callAgain || isCancelled()) {
      return { result, calls, elapsedMs, timedOut: false };
    }
    if (elapsedMs + intervalMs > timeoutMs) return { result, calls, elapsedMs, timedOut: true };
    await sleep(intervalMs);
  }
}

/** FAILED 단계와 그 안의 오류 코드 */
export function failedSteps(result: DemoRestoreResult) {
  return result.steps
    .filter(
      (step) => step.status === 'FAILED' || step.items.some((item) => item.status === 'FAILED'),
    )
    .map((step) => ({
      step: step.step,
      codes: [
        ...new Set(
          step.items
            .filter((item) => item.status === 'FAILED' || item.code)
            .map((item) => item.code)
            .filter((code): code is string => Boolean(code)),
        ),
      ],
    }));
}
