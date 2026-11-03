import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react';
import { RoleButton } from '@/components/RoleButton';
import { StatusBadge } from '@/components/StatusBadge';
import type { Patch } from '@/lib/api/prechecks';
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

/** AI 가 낸 수정안 하나. 검증을 통과한 것만 사람이 승인·거절한다(F15) */
export function PatchReview({
  patch,
  pending,
  onDecide,
}: {
  patch: Patch;
  pending: boolean;
  onDecide: (decision: 'APPROVED' | 'REJECTED') => void;
}) {
  const failed = patch.verification.passed < patch.verification.total;
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
      <header className="flex flex-col gap-1.5 px-4 py-3">
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge label="AI" tone="ai" />
          <h3 className="text-title">
            Patch #{patch.number} · <span className="font-mono">{patch.file}</span>
          </h3>
          {patch.status === 'APPROVED' && <StatusBadge label="Approved" tone="success" />}
          {patch.status === 'REJECTED' && <StatusBadge label="Rejected" tone="neutral" />}
          {patch.status === 'BLOCKED' && <StatusBadge label="Blocked" tone="danger" />}
        </span>
        <p className="text-small text-fg-secondary">{patch.reason}</p>
      </header>
      <pre className="flex flex-col bg-subtle py-2 font-mono text-mono">
        {patch.diff.map((line, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: diff 줄은 순서가 곧 정체다
          <span key={index} className={cn('flex gap-3 px-2 py-0.5', DIFF_CLASS[line.kind])}>
            <span className="w-7 shrink-0 text-right text-fg-muted">{line.line}</span>
            <span className={SIGN_CLASS[line.kind]}>{DIFF_SIGN[line.kind]}</span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap">{line.text}</span>
          </span>
        ))}
      </pre>
      <footer className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        {patch.status === 'VERIFYING' ? (
          <span className="flex items-center gap-1.5 text-small text-migrating-fg">
            <LoaderCircle aria-hidden className="size-3.5 motion-safe:animate-spin" />
            Verifying in sandbox…
          </span>
        ) : (
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
            Sandbox verification {failed ? 'failed' : 'passed'} ({patch.verification.passed}/
            {patch.verification.total}){failed && ' · not applied'}
          </span>
        )}
        {patch.status === 'PROPOSED' && (
          <span className="flex items-center gap-2">
            <RoleButton
              requires="DEVELOPER"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => onDecide('REJECTED')}
            >
              Reject
            </RoleButton>
            <RoleButton
              requires="DEVELOPER"
              size="sm"
              disabled={pending}
              onClick={() => onDecide('APPROVED')}
            >
              Approve patch
            </RoleButton>
          </span>
        )}
      </footer>
    </article>
  );
}
