import { Check, Circle, Loader2, X } from 'lucide-react';
import type { DeployRequestSummary } from '@/lib/api/types';
import { DEPLOY_STAGES, stageDuration, stageStates } from '@/lib/deploy-stages';
import { t } from '@/lib/i18n';

const ICON = {
  done: <Check aria-hidden className="size-4 text-success-solid" />,
  current: <Loader2 aria-hidden className="size-4 animate-spin text-migrating-solid" />,
  failed: <X aria-hidden className="size-4 text-danger-solid" />,
  pending: <Circle aria-hidden className="size-4 text-fg-muted" />,
  skipped: <Circle aria-hidden className="size-4 text-fg-muted" />,
};

/** 배포 단계와 걸린 시간을 목록 안에서 펼쳐 본다 */
export function DeploySteps({ request }: { request: DeployRequestSummary }) {
  const states = stageStates(request);
  const now = Date.now();
  return (
    <ol className="flex flex-col gap-1 pt-2">
      {DEPLOY_STAGES.map((stage, index) => {
        const state = states[index] ?? 'pending';
        return (
          <li key={stage.status} className="flex items-center gap-2 text-small">
            {ICON[state]}
            <span className="flex-1">{t(stage.label)}</span>
            <span className="font-mono text-mono text-fg-muted">
              {stageDuration(request.stageTimes, index, now) ?? t('Not started')}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
