import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { FormError } from '@/components/FormField';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CATEGORY_LABELS,
  type Diagnosis,
  type DiagnosisFix,
  diagnoseDeploy,
  FIX_LABELS,
} from '@/lib/api/diagnosis';
import { describeApiError } from '@/lib/api/errors';
import { isActivePrecheck, useCreateDiagnosis, usePrecheck } from '@/lib/api/prechecks';
import type {
  DeployRequestDetail,
  PrecheckDetail,
  PrecheckDiagnosis,
  PrecheckPatch,
} from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { precheckFailureLabel, precheckStepLabel } from '@/lib/status';
import { PatchReview } from '@/pages/evacuation/PatchReview';
import { useFollowRedeploy } from './follow-redeploy';

/** 고치기 버튼이 부를 동작. 이 배포에서 할 수 없는 고치기는 unavailable 에 넣는다 */
export type DiagnosisActions = {
  run: (fix: DiagnosisFix) => void;
  unavailable?: DiagnosisFix[];
};

function FixButton({ fix, actions }: { fix: DiagnosisFix; actions: DiagnosisActions }) {
  const canFix = !actions.unavailable?.includes(fix);
  return (
    <RoleButton
      requires="DEVELOPER"
      size="sm"
      className="self-start"
      disabledReason={canFix ? undefined : t('Not available for this deploy')}
      onClick={() => actions.run(fix)}
    >
      <Wand2 aria-hidden />
      {t(FIX_LABELS[fix])}
    </RoleButton>
  );
}

/** 서버 진단을 쓸 수 없을 때의 규칙 분류. 실제 진단이 아니라서 simulated 를 단다 */
function RuleResult({ rule, actions }: { rule: Diagnosis; actions: DiagnosisActions }) {
  return (
    <>
      <p className="flex flex-wrap items-center gap-2 text-title text-ai-fg">
        {t('Rule-based hint')} › {t(CATEGORY_LABELS[rule.category])}
        <SimulatedBadge />
      </p>
      <p className="text-body">{t(rule.cause)}</p>
      {rule.evidence.length > 0 && (
        <pre className="overflow-x-auto rounded-sm bg-surface px-2 py-1.5 font-mono text-mono text-fg-secondary">
          {rule.evidence.join('\n')}
        </pre>
      )}
      <p className="text-small text-fg-secondary">{t(rule.remedy)}</p>
      <FixButton fix={rule.fix} actions={actions} />
    </>
  );
}

function evidenceLabel({ source, path, line }: PrecheckDiagnosis['evidence'][number]) {
  if (path) return line ? `${path}:${line}` : path;
  if (source === 'LOG') return line ? t('Log line {{n}}', { n: line }) : t('Log');
  return t('Config');
}

function ServerResult({
  orgId,
  run,
  diagnosis,
  rule,
  actions,
  deployLink,
  onApproved,
}: {
  orgId: string;
  run: PrecheckDetail;
  diagnosis: PrecheckDiagnosis;
  rule: Diagnosis;
  actions: DiagnosisActions;
  deployLink: (id: string) => string;
  onApproved: (patch: PrecheckPatch | undefined) => void;
}) {
  return (
    <>
      <p className="flex flex-wrap items-center gap-2 text-title text-ai-fg">
        {t('Diagnosis')}
        {diagnosis.category && ` › ${t(CATEGORY_LABELS[diagnosis.category])}`}
        {run.simulated && <SimulatedBadge />}
      </p>
      {diagnosis.cause && <p className="text-body">{diagnosis.cause}</p>}
      {diagnosis.result === 'INSUFFICIENT_EVIDENCE' && (
        <p className="text-body">{t('There is not enough evidence to name a cause.')}</p>
      )}
      {diagnosis.result === 'NO_FAILURE_EVIDENCE' && (
        <p className="text-body">{t('No failure evidence was found in the logs.')}</p>
      )}
      {diagnosis.unfixableReason && (
        <p className="text-small text-fg-secondary">{diagnosis.unfixableReason}</p>
      )}
      {diagnosis.evidence.length > 0 && (
        <ul aria-label={t('Evidence')} className="flex flex-col gap-1">
          {diagnosis.evidence.map((item) => (
            <li
              key={`${item.source}-${item.path}-${item.line}`}
              className="flex flex-col rounded-sm bg-surface px-2 py-1.5"
            >
              <span className="text-caption text-fg-muted">{evidenceLabel(item)}</span>
              <code className="overflow-x-auto font-mono text-mono text-fg-secondary">
                {item.text}
              </code>
            </li>
          ))}
        </ul>
      )}
      {run.patches.length > 0 ? (
        <>
          {run.patches.some((patch) => patch.status === 'PROPOSED') && (
            <p className="text-small text-fg-secondary">
              {t('Approving applies the fix in the sandbox, then starts a real redeploy.')}
            </p>
          )}
          {run.patches.map((patch, index) => (
            <PatchReview
              key={patch.id}
              orgId={orgId}
              precheckId={run.id}
              patch={patch}
              number={index + 1}
              deployLink={deployLink}
              onApproved={onApproved}
            />
          ))}
        </>
      ) : (
        <FixButton fix={rule.fix} actions={actions} />
      )}
    </>
  );
}

/**
 * 실패 카드 안의 AI 원인 보기. 서버 진단(POST /deploy-requests/{id}/diagnosis)을 시작하고 원인 · 근거 · 패치를
 * 그린다. 러너가 붙기 전에는 서버가 가짜 진단을 주고 simulated 로 알린다
 */
export function DeployDiagnosis({
  orgId,
  request,
  actions,
  deployLink,
  deploysLink,
}: {
  orgId: string;
  request: Pick<
    DeployRequestDetail,
    'id' | 'status' | 'errorCode' | 'errorMessage' | 'failure' | 'diagnosis'
  > &
    Partial<Pick<DeployRequestDetail, 'serviceId'>>;
  actions: DiagnosisActions;
  deployLink: (id: string) => string;
  /** 서비스 배포 목록 주소. 승인 뒤 새 배포를 못 찾으면 여기로 옮긴다 */
  deploysLink?: string;
}) {
  const create = useCreateDiagnosis(orgId, request.id);
  const [createdId, setCreatedId] = useState<string>();
  const runId = request.diagnosis?.runId ?? createdId;
  const precheck = usePrecheck(orgId, runId);
  const followRedeploy = useFollowRedeploy({
    orgId,
    precheckId: runId ?? '',
    serviceId: request.serviceId,
    failedRequestId: request.id,
    deployLink,
    deploysLink,
  });
  const rule = diagnoseDeploy(request);
  if (!rule) return null;

  if (!runId && !create.isError) {
    return (
      <RoleButton
        requires="DEVELOPER"
        variant="outline"
        size="sm"
        className="self-start border-ai-solid text-ai-fg"
        disabled={create.isPending}
        onClick={() => create.mutate(undefined, { onSuccess: (run) => setCreatedId(run.id) })}
      >
        <Sparkles aria-hidden />
        {create.isPending ? t('Starting diagnosis…') : t('Diagnose with AI')}
      </RoleButton>
    );
  }

  const run = precheck.data;
  const lastStep = run?.steps.at(-1);
  return (
    <section
      aria-label={t('AI diagnosis')}
      className="flex flex-col gap-2 rounded-md border border-line bg-ai-bg p-3 text-fg"
    >
      {create.isError ? (
        <>
          <FormError message={describeApiError(create.error)} />
          <RuleResult rule={rule} actions={actions} />
        </>
      ) : precheck.isError ? (
        <>
          <FormError message={describeApiError(precheck.error)} />
          <RuleResult rule={rule} actions={actions} />
        </>
      ) : !run ? (
        <Skeleton className="h-16 w-full" />
      ) : isActivePrecheck(run.status) ? (
        <p role="status" className="flex items-center gap-2 text-body text-ai-fg">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          {lastStep ? precheckStepLabel(lastStep.name) : t('Waiting for the AI agent')}
        </p>
      ) : run.diagnosis && run.status === 'SUCCEEDED' ? (
        <ServerResult
          orgId={orgId}
          run={run}
          diagnosis={run.diagnosis}
          rule={rule}
          actions={actions}
          deployLink={deployLink}
          onApproved={(patch) => void followRedeploy(patch)}
        />
      ) : (
        <>
          <p className="text-small text-danger-fg">
            {run.failureCode ? precheckFailureLabel(run.failureCode) : t('The diagnosis stopped.')}
          </p>
          <RuleResult rule={rule} actions={actions} />
        </>
      )}
    </section>
  );
}
