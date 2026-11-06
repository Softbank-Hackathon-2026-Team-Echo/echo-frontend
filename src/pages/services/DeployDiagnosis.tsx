import { Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CATEGORY_LABELS,
  type DiagnosisFix,
  diagnoseDeploy,
  FIX_LABELS,
} from '@/lib/api/diagnosis';
import type { DeployRequestDetail } from '@/lib/api/types';
import { t } from '@/lib/i18n';

/** 고치기 버튼이 부를 동작. 이 배포에서 할 수 없는 고치기는 unavailable 에 넣는다 */
export type DiagnosisActions = {
  run: (fix: DiagnosisFix) => void;
  unavailable?: DiagnosisFix[];
};

/**
 * 실패 카드 안의 AI 원인 보기 (Railway Diagnose). 분류 · 원인 · 고치기 버튼 하나를 같은 카드에 둔다.
 * 진단 API 전까지 규칙 분류 시뮬레이션이라 simulated 배지를 단다. 고치기 버튼은 실제 화면 동작이다
 */
export function DeployDiagnosis({
  request,
  actions,
}: {
  request: Pick<DeployRequestDetail, 'status' | 'errorCode' | 'errorMessage'>;
  actions: DiagnosisActions;
}) {
  const [open, setOpen] = useState(false);
  const diagnosis = diagnoseDeploy(request);
  if (!diagnosis) return null;

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="self-start border-ai-solid text-ai-fg"
        onClick={() => setOpen(true)}
      >
        <Sparkles aria-hidden />
        {t('Diagnose with AI')}
      </Button>
    );
  }

  const canFix = !actions.unavailable?.includes(diagnosis.fix);
  return (
    <section
      aria-label={t('AI diagnosis')}
      className="flex flex-col gap-2 rounded-md border border-line bg-ai-bg p-3 text-fg"
    >
      <header className="flex flex-wrap items-center gap-2">
        <Sparkles aria-hidden className="size-4 text-ai-fg" />
        <span className="text-title text-ai-fg">
          {t('Diagnosis')} › {t(CATEGORY_LABELS[diagnosis.category])}
        </span>
        <SimulatedBadge />
        <Tooltip>
          <TooltipTrigger asChild>
            <label className="ml-auto flex cursor-not-allowed items-center gap-1.5 text-caption text-fg-muted">
              <input type="checkbox" disabled className="size-3.5" />
              {t('Run automatically')}
            </label>
          </TooltipTrigger>
          <TooltipContent>{t('Turns on when the AI fix agent API is ready.')}</TooltipContent>
        </Tooltip>
      </header>
      <p className="text-body">{t(diagnosis.cause)}</p>
      {diagnosis.variable && (
        <p className="text-small text-fg-secondary">
          {t('Mentioned in the error:')}{' '}
          <span className="font-mono text-mono">{diagnosis.variable}</span>
        </p>
      )}
      {diagnosis.evidence.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-caption text-fg-muted">{t('Evidence from the container log')}</span>
          <pre className="overflow-x-auto rounded-sm bg-surface px-2 py-1.5 font-mono text-mono text-fg-secondary">
            {diagnosis.evidence.join('\n')}
          </pre>
        </div>
      )}
      <p className="text-small text-fg-secondary">{t(diagnosis.remedy)}</p>
      <RoleButton
        requires="DEVELOPER"
        size="sm"
        className="self-start"
        disabledReason={canFix ? undefined : t('Not available for this deploy')}
        onClick={() => actions.run(diagnosis.fix)}
      >
        <Wand2 aria-hidden />
        {t(FIX_LABELS[diagnosis.fix])}
      </RoleButton>
      <p className="text-caption text-fg-muted">
        {t('Rule-based preview until the AI diagnosis API is connected.')}
      </p>
    </section>
  );
}
