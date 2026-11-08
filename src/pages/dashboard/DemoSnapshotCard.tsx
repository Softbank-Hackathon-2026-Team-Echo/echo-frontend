import { useQueryClient } from '@tanstack/react-query';
import { Loader2, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Panel } from '@/components/Panel';
import { RoleButton } from '@/components/RoleButton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRole } from '@/hooks/useRole';
import {
  type DemoRestoreResult,
  failedSteps,
  RESTORE_POLL_MS,
  type RestoreRun,
  restoreDemo,
  restoreUntilDone,
  useDemoSnapshot,
} from '@/lib/api/demo';
import { useMembers } from '@/lib/api/members';
import { notifyApiErrorWithCode } from '@/lib/api/notify';
import { queryKeys } from '@/lib/api/query-keys';
import { currentLocale, k, t } from '@/lib/i18n';
import { hasRole } from '@/lib/roles';
import { cn } from '@/lib/utils';

const STEP_LABELS: Record<string, string> = {
  MIGRATION_PLANS: k('Migration plans'),
  DISASTERS: k('Disasters'),
  AI_RUNS: k('AI runs'),
  DEPLOY_REQUESTS: k('Deploy requests'),
  TRAFFIC: k('Traffic weights'),
  DEPLOYMENTS: k('Deployments'),
  DB_WRITER: k('DB writer'),
  DEMO_APP_DATA: k('Demo app data'),
  AI_FIX_PULL_REQUESTS: k('AI fix pull requests'),
  KEPT_SETTINGS: k('Kept settings'),
  AUDIT_LOGS: k('Audit logs'),
};

const STATUS_LABELS: Record<string, string> = {
  OK: k('Already matches the snapshot'),
  DONE: k('Restored in this call'),
  STARTED: k('Started — worker finishing'),
  WAITING: k('Waiting for earlier work'),
  MANUAL_REQUIRED: k('Manual step required'),
  FAILED: k('Step failed'),
  KEPT: k('Kept as is'),
  WOULD_DO: k('Would restore (dry run)'),
};

const STATUS_TONE: Record<string, string> = {
  OK: 'text-fg-muted',
  DONE: 'text-success',
  STARTED: 'text-ai',
  WAITING: 'text-warning',
  MANUAL_REQUIRED: 'text-warning',
  FAILED: 'text-danger',
};

const MANUAL_LABELS: Record<string, string> = {
  DEMO_APP_DATA: k('App data is manual'),
};

const stepLabel = (step: string) => (STEP_LABELS[step] ? t(STEP_LABELS[step]) : step);
const statusLabel = (status: string) => (STATUS_LABELS[status] ? t(STATUS_LABELS[status]) : status);
const manualLabel = (step: string) =>
  MANUAL_LABELS[step] ? t(MANUAL_LABELS[step]) : t('{{step}} — manual', { step: stepLabel(step) });

function kstTime(iso: string) {
  const text = new Date(iso).toLocaleString(currentLocale(), {
    timeZone: 'Asia/Seoul',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return `${text} KST`;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'running'; calls: number; result: DemoRestoreResult | null }
  | { kind: 'done'; run: RestoreRun };

/** 대시보드의 「시연 스냅샷」 카드. 연습 뒤 팀원이 스스로 스냅샷 상태로 되돌린다. 복구만 하고 발행은 하지 않는다 */
export function DemoSnapshotCard({
  orgId,
  className,
  pollIntervalMs = RESTORE_POLL_MS,
}: {
  orgId: string;
  className?: string;
  pollIntervalMs?: number;
}) {
  const role = useRole();
  const isAdmin = hasRole(role, 'ADMIN');
  const snapshot = useDemoSnapshot(orgId, isAdmin);
  const members = useMembers(isAdmin ? orgId : undefined);
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const unmounted = useRef(false);
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
    };
  }, []);

  const running = phase.kind === 'running';
  const current = snapshot.data;
  const takenBy = current?.takenByUserId
    ? (members.data?.items.find((member) => member.id === current.takenByUserId)?.githubLogin ??
      current.takenByUserId.slice(0, 8))
    : '—';

  const disabledReason = !isAdmin
    ? undefined
    : snapshot.isPending
      ? t('Loading snapshot')
      : snapshot.isError
        ? t('Could not load the snapshot')
        : current === null
          ? t('No snapshot')
          : undefined;

  async function start() {
    setConfirmOpen(false);
    setPhase({ kind: 'running', calls: 0, result: null });
    try {
      const run = await restoreUntilDone(() => restoreDemo(orgId), {
        intervalMs: pollIntervalMs,
        isCancelled: () => unmounted.current,
        onProgress: (result, calls) => {
          if (!unmounted.current) setPhase({ kind: 'running', calls, result });
        },
      });
      if (unmounted.current) return;
      setPhase({ kind: 'done', run });
    } catch (error) {
      notifyApiErrorWithCode(error);
      if (!unmounted.current) setPhase({ kind: 'idle' });
    } finally {
      // 서비스·이전 계획·재난·배포를 다시 읽는다(조직 키 전체)
      void queryClient.invalidateQueries({ queryKey: queryKeys.org(orgId) });
    }
  }

  const shown =
    phase.kind === 'running' ? phase.result : phase.kind === 'done' ? phase.run.result : null;
  const failed = shown ? failedSteps(shown) : [];

  return (
    <Panel
      title={t('Demo snapshot')}
      className={className}
      action={
        <RoleButton
          requires="ADMIN"
          size="sm"
          variant="secondary"
          disabledReason={disabledReason}
          disabled={running}
          aria-busy={running || undefined}
          onClick={() => setConfirmOpen(true)}
        >
          {running ? <Loader2 aria-hidden className="animate-spin" /> : <RotateCcw aria-hidden />}
          {t('Restore to snapshot')}
        </RoleButton>
      }
    >
      <p className="text-small text-fg-secondary" data-testid="demo-snapshot-summary">
        {!isAdmin
          ? t('Only admins can see and restore the demo snapshot.')
          : snapshot.isPending
            ? t('Loading snapshot')
            : snapshot.isError
              ? t('Could not load the snapshot')
              : current
                ? t('Snapshot {{id}} · taken {{at}} by {{by}}', {
                    id: current.id.slice(0, 8),
                    at: kstTime(current.takenAt),
                    by: takenBy,
                  })
                : t('No snapshot')}
      </p>

      {phase.kind === 'running' && (
        <p className="flex items-center gap-2 text-small" role="status">
          <Loader2 aria-hidden className="size-3.5 animate-spin" />
          {phase.calls === 0
            ? t('Restoring…')
            : t('Restoring… (call {{count}}, repeats every 2 seconds)', { count: phase.calls })}
        </p>
      )}

      {phase.kind === 'done' && (
        <p
          role="status"
          className={cn(
            'text-small font-medium',
            phase.run.result.restored ? 'text-success' : 'text-warning',
          )}
        >
          {phase.run.result.restored
            ? t('Restore complete ({{seconds}}s)', {
                seconds: (phase.run.elapsedMs / 1000).toFixed(1),
              })
            : phase.run.timedOut
              ? t('Not finished within 5 minutes — press again to continue')
              : t('Restore stopped before finishing ({{seconds}}s)', {
                  seconds: (phase.run.elapsedMs / 1000).toFixed(1),
                })}
        </p>
      )}

      {shown && (
        <ul className="flex flex-col gap-1 text-small" aria-label={t('Restore steps')}>
          {shown.steps.map((step) => (
            <li key={step.step} className="flex items-center justify-between gap-2">
              <span>{stepLabel(step.step)}</span>
              <span className={cn('tabular-nums', STATUS_TONE[step.status] ?? 'text-fg-muted')}>
                {statusLabel(step.status)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {failed.length > 0 && (
        <ul className="flex flex-col gap-1 text-small text-danger" aria-label={t('Failed steps')}>
          {failed.map((item) => (
            <li key={item.step}>
              {stepLabel(item.step)}
              {item.codes.length > 0 && ` · ${item.codes.join(', ')}`}
            </li>
          ))}
        </ul>
      )}

      {phase.kind === 'done' && phase.run.result.manualRequired.length > 0 && (
        <ul className="flex flex-col gap-1 text-small text-fg-secondary" aria-label={t('Manual')}>
          {phase.run.result.manualRequired.map((step) => (
            <li key={step}>{manualLabel(step)}</li>
          ))}
        </ul>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Restore to the demo snapshot?')}</DialogTitle>
            <DialogDescription>
              {t(
                'Open migration plans, disasters and deploys are cleaned up, and service weights and deployments go back to the snapshot. App data is not restored.',
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button type="button" onClick={() => void start()}>
              {t('Restore')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
