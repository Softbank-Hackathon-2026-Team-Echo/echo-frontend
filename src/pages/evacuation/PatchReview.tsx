import { CircleCheck, CircleX } from 'lucide-react';
import { RoleButton } from '@/components/RoleButton';
import { StatusBadge } from '@/components/StatusBadge';
import { parseDiff } from '@/lib/api/prechecks';
import type { PrecheckPatch } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { patchBlockReasonLabel } from '@/lib/status';
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

/** AI 가 낸 수정안 하나. 승인 API 가 생기기 전까지 보여 주기만 한다(F15) */
export function PatchReview({ patch, number }: { patch: PrecheckPatch; number: number }) {
  const { passed, total } = patch.verification;
  const failed = passed < total;
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
      <header className="flex flex-col gap-1.5 px-4 py-3">
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge label="AI" tone="ai" />
          <h3 className="text-title">
            {t('Patch #{{n}}', { n: number })} ·{' '}
            <span className="font-mono">{patch.files.join(', ')}</span>
          </h3>
          {patch.status === 'BLOCKED' && <StatusBadge label={t('Blocked')} tone="danger" />}
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
          <RoleButton
            requires="DEVELOPER"
            size="sm"
            disabledReason={t('Patch approval is not available yet')}
          >
            {t('Approve patch')}
          </RoleButton>
        )}
      </footer>
    </article>
  );
}
