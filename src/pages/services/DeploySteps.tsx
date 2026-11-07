import { Check, Circle, CircleAlert, Loader2, X } from 'lucide-react';
import type { DeployRequestDetail } from '@/lib/api/types';
import { STAGES, type StageState, stageDuration, stageStates } from '@/lib/deploy-stages';
import { k, t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// 진행 중인 단계에서 바꿔 보이는 하위 문구 (Railway "Pulling image…" 처럼). 서버 단계 이름과 1:1 이다
const SUBSTEPS: Record<string, string> = {
  QUEUED: k('Waiting for a deploy worker…'),
  BUILDING: k('Building the image…'),
  DEPLOYING: k('Creating containers…'),
  VERIFYING: k('Waiting for the health check…'),
};

const ICON: Record<StageState, React.ReactNode> = {
  done: <Check aria-hidden className="size-4 text-success-solid" />,
  current: <Loader2 aria-hidden className="size-4 animate-spin text-migrating-solid" />,
  failed: <X aria-hidden className="size-4 text-danger-solid" />,
  pending: <Circle aria-hidden className="size-4 text-fg-muted" />,
  skipped: <Circle aria-hidden className="size-4 text-fg-muted" />,
};

/**
 * 단계 목록 (Railway 배포 카드): 단계마다 ✓/✗ 와 걸린 시간, 실패한 단계 바로 밑에 에러 문장을 고정폭으로 붙인다
 * stalled 면(상태 조회 오류로 마지막 확인 상태를 보이는 중) 진행 중 단계의 스피너와 하위 문구를 멈춘다
 */
export function DeploySteps({
  request,
  now,
  stalled = false,
}: {
  request: DeployRequestDetail;
  now: number;
  stalled?: boolean;
}) {
  const states = stageStates(request);
  return (
    <ol className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
      {STAGES.map((stage, index) => {
        const state = states[index] ?? 'pending';
        const duration = stageDuration(request.stageTimes, index, now);
        return (
          <li key={stage.status} className="flex flex-col gap-1.5 px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              {stalled && state === 'current' ? (
                <CircleAlert aria-hidden className="size-4 text-warning-fg" />
              ) : (
                ICON[state]
              )}
              <span
                className={cn(
                  'text-body-medium',
                  state === 'pending' && 'text-fg-muted',
                  state === 'failed' && 'text-danger-fg',
                )}
              >
                {t(stage.label)}
              </span>
              {state === 'current' && !stalled && SUBSTEPS[stage.status] && (
                <span className="text-small text-migrating-fg">
                  {t(SUBSTEPS[stage.status] ?? '')}
                </span>
              )}
              {stage.status === 'BUILDING' && request.build?.reused && state === 'done' && (
                <span className="text-small text-fg-muted">{t('cache reused')}</span>
              )}
              <span className="ml-auto font-mono text-mono tabular-nums text-fg-muted">
                {duration ?? t('Not started')}
              </span>
            </div>
            {state === 'failed' && request.errorMessage && (
              <pre className="ml-6 whitespace-pre-wrap break-all rounded-sm bg-danger-bg px-2 py-1.5 font-mono text-mono text-danger-fg">
                {request.errorMessage}
              </pre>
            )}
          </li>
        );
      })}
    </ol>
  );
}
