import { useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleX, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ExternalLink } from '@/components/ExternalLink';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { notifyApiErrorWithCode } from '@/lib/api/notify';
import {
  isAwaitingRedeploy,
  isRedeployWaitOver,
  parseDiff,
  usePatchDecision,
} from '@/lib/api/prechecks';
import { queryKeys } from '@/lib/api/query-keys';
import { useDeployRequest } from '@/lib/api/services';
import type { PrecheckPatch } from '@/lib/api/types';
import { dateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import {
  deployStatusView,
  patchBlockReasonLabel,
  patchStatusView,
  precheckFailureLabel,
  shortSha,
} from '@/lib/status';
import { cn } from '@/lib/utils';

const DIFF_CLASS = {
  context: 'text-fg-secondary',
  added: 'bg-success-bg text-fg',
  removed: 'bg-danger-bg text-fg',
} as const;

const DIFF_SIGN = { context: ' ', added: '+', removed: '−' } as const;

const SIGN_CLASS = {
  context: 'text-fg-muted',
  added: 'text-success-fg',
  removed: 'text-danger-fg',
} as const;

type PatchReviewProps = {
  orgId: string;
  precheckId: string;
  patch: PrecheckPatch;
  number: number;
  /** 진단 패치가 만든 재배포로 가는 주소 */
  deployLink?: (id: string) => string;
  /** 승인이 성공하면 부른다(승인 응답의 패치). 주면 카드 위에 반영 진행 줄을 단다 */
  onApproved?: (patch: PrecheckPatch | undefined) => void;
};

/** 고친 커밋으로 만든 재배포의 지금 상태. 끝날 때까지 배포 상세와 같은 간격으로 다시 부른다 */
function RedeployStatus({
  orgId,
  redeployRequestId,
  deployLink,
}: {
  orgId: string;
  redeployRequestId: string;
  deployLink: (id: string) => string;
}) {
  const redeploy = useDeployRequest(orgId, redeployRequestId);
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-fg-secondary">{t('Redeploy with the fix')}</span>
      {redeploy.data && <StatusBadge {...deployStatusView(redeploy.data.status)} />}
      {redeploy.data?.commitSha && (
        <span className="font-mono text-mono" title={redeploy.data.commitSha}>
          {shortSha(redeploy.data.commitSha)}
        </span>
      )}
      <Link to={deployLink(redeployRequestId)} className="text-brand hover:underline">
        {t('Open the redeploy')}
      </Link>
    </p>
  );
}

/** 반영은 끝났고 서버가 수정 커밋 · 재배포를 잇는 중. 오래 걸리면 다시 확인하게 한다 */
function AwaitingRedeploy({
  orgId,
  precheckId,
  apply,
}: {
  orgId: string;
  precheckId: string;
  apply: NonNullable<PrecheckPatch['apply']>;
}) {
  const queryClient = useQueryClient();
  if (!isRedeployWaitOver(apply)) {
    return (
      <p role="status" className="flex items-center gap-2 text-fg-secondary">
        <Loader2 aria-hidden className="size-3.5 animate-spin" />
        {t('Sandbox check passed. Committing the fix and starting the redeploy…')}
      </p>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-2 text-warning-fg">
      {t('The redeploy has not started yet.')}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          void queryClient.invalidateQueries({ queryKey: queryKeys.precheck(orgId, precheckId) })
        }
      >
        {t('Check again')}
      </Button>
    </p>
  );
}

/** 샌드박스 반영 실행의 결과. 브랜치 · 커밋은 러너 결과가 나온 뒤에만 찬다 */
function ApplyResult({
  orgId,
  precheckId,
  apply,
  deployLink,
}: {
  orgId: string;
  precheckId: string;
  apply: NonNullable<PrecheckPatch['apply']>;
  deployLink?: (id: string) => string;
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-line px-4 py-3 text-small">
      {apply.failureCode && (
        <p className="flex flex-wrap items-center gap-x-2 text-danger-fg">
          {precheckFailureLabel(apply.failureCode)}
          <span className="font-mono text-mono">{apply.failureCode}</span>
        </p>
      )}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-fg-secondary">
        {apply.finishedAt ? (
          <span>{t('Finished {{time}}', { time: dateTime(apply.finishedAt) })}</span>
        ) : (
          <span>{t('Applying in the sandbox…')}</span>
        )}
        {apply.branch && <span className="font-mono text-mono">{apply.branch}</span>}
        {apply.appliedCommitSha && (
          <span className="font-mono text-mono" title={apply.appliedCommitSha}>
            {shortSha(apply.appliedCommitSha)}
          </span>
        )}
        {apply.simulated && <SimulatedBadge />}
      </p>
      {apply.pullRequestUrl && <ExternalLink href={apply.pullRequestUrl} />}
      {apply.redeployRequestId && deployLink && (
        <RedeployStatus
          orgId={orgId}
          redeployRequestId={apply.redeployRequestId}
          deployLink={deployLink}
        />
      )}
      {deployLink && isAwaitingRedeploy(apply) && (
        <AwaitingRedeploy orgId={orgId} precheckId={precheckId} apply={apply} />
      )}
      {apply.redeployRejectedCode && (
        <p className="text-warning-fg">
          {t('The redeploy did not start.')}{' '}
          <span className="font-mono text-mono">{apply.redeployRejectedCode}</span>
        </p>
      )}
    </div>
  );
}

/** 러너가 낸 수정안 하나. 사람이 승인 · 거절한다(F15). 막힌 패치는 승인 버튼이 없다 */
export function PatchReview({
  orgId,
  precheckId,
  patch,
  number,
  deployLink,
  onApproved,
}: PatchReviewProps) {
  const decide = usePatchDecision(orgId, precheckId);
  // 승인이 성공한 뒤 새 배포로 옮길 때까지 버튼을 다시 열지 않는다
  const [approved, setApproved] = useState(false);
  const { passed, total } = patch.verification;
  const proof = patch.reviewEvidence;
  const failed = passed < total || Boolean(proof && proof.review.verdict !== 'PASS');
  const status = patchStatusView(patch.status);
  const approving = (decide.isPending && decide.variables?.decision === 'approve') || approved;
  const busy = decide.isPending || approved;

  function decideOn(decision: 'approve' | 'reject') {
    decide.mutate(
      { patch, decision },
      {
        onSuccess: (result) => {
          if (decision !== 'approve') return;
          setApproved(true);
          onApproved?.(result);
        },
        onError: notifyApiErrorWithCode,
      },
    );
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
      {onApproved && approving && (
        <p
          role="status"
          className="flex items-center gap-2 border-b border-line bg-ai-bg px-4 py-2 text-small text-ai-fg"
        >
          <Loader2 aria-hidden className="size-3.5 animate-spin" />
          {t('Approved — applying the fix (PR → build → deploy, about 2–3 min)')}
        </p>
      )}
      <header className="flex flex-col gap-1.5 px-4 py-3">
        <span className="flex flex-wrap items-center gap-2">
          {patch.origin === 'RULE' ? (
            <StatusBadge label={t('Rule')} tone="neutral" />
          ) : (
            <StatusBadge label="AI" tone="ai" />
          )}
          <h3 className="text-title">
            {t('Patch #{{n}}', { n: number })} ·{' '}
            <span className="font-mono">{patch.files.join(', ')}</span>
          </h3>
          {status && <StatusBadge {...status} />}
        </span>
        <p className="text-small text-fg-secondary">{patch.reason}</p>
        {patch.blockReason && (
          <p className="text-small text-danger-fg">{patchBlockReasonLabel(patch.blockReason)}</p>
        )}
      </header>
      <pre className="flex flex-col bg-subtle py-2 font-mono text-mono">
        {parseDiff(patch.diff).map((line, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: diff 줄은 순서가 곧 정체다
          <span key={index} className={cn('flex gap-3 px-2 py-0.5', DIFF_CLASS[line.kind])}>
            <span className={SIGN_CLASS[line.kind]}>{DIFF_SIGN[line.kind]}</span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap">{line.text}</span>
          </span>
        ))}
      </pre>
      {proof && (
        <details className="border-t border-line px-4 py-3 text-small">
          <summary className="cursor-pointer text-fg-secondary">
            {t('Independent review and syntax evidence')} · {proof.review.verdict}
          </summary>
          <p className="mt-2 text-fg-secondary">{proof.review.reason}</p>
          <p className="text-fg-secondary">
            {t('Syntax checked; functional compatibility not tested.')}
          </p>
          <p className="mt-2 break-all font-mono text-mono" title={proof.evidenceHash}>
            {proof.evidenceHash}
          </p>
        </details>
      )}
      {patch.apply && (
        <ApplyResult
          orgId={orgId}
          precheckId={precheckId}
          apply={patch.apply}
          deployLink={deployLink}
        />
      )}
      <footer className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span
          className={cn(
            'flex items-center gap-1.5 text-small',
            failed ? 'text-danger-fg' : 'text-success-fg',
          )}
        >
          {failed ? (
            <CircleX aria-hidden className="size-3.5" />
          ) : (
            <CircleCheck aria-hidden className="size-3.5" />
          )}
          {failed
            ? t('Sandbox verification failed ({{passed}}/{{total}}) · not applied', {
                passed,
                total,
              })
            : t('Sandbox verification passed ({{passed}}/{{total}})', { passed, total })}
        </span>
        {patch.status === 'PROPOSED' && (
          <span className="flex items-center gap-2">
            <RoleButton
              requires="DEVELOPER"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => decideOn('reject')}
            >
              {t('Reject patch')}
            </RoleButton>
            <RoleButton
              requires="DEVELOPER"
              size="sm"
              disabled={busy}
              aria-busy={approving || undefined}
              onClick={() => decideOn('approve')}
            >
              {approving && <Loader2 aria-hidden className="animate-spin" />}
              {t('Approve patch')}
            </RoleButton>
          </span>
        )}
      </footer>
    </article>
  );
}
