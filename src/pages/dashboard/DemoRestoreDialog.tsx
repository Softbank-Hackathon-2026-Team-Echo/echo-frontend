import { useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { RoleButton } from '@/components/RoleButton';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { type DemoStepStatus, useDemoRestore } from '@/lib/api/demo';
import { t } from '@/lib/i18n';
import type { Tone } from '@/lib/status';

function stepStatusView(status: DemoStepStatus): { label: string; tone: Tone } {
  switch (status) {
    case 'OK':
      return { label: t('Already matches'), tone: 'success' };
    case 'DONE':
      return { label: t('Restored'), tone: 'success' };
    case 'STARTED':
      return { label: t('Started'), tone: 'migrating' };
    case 'WAITING':
      return { label: t('Waiting'), tone: 'warning' };
    case 'MANUAL_REQUIRED':
      return { label: t('Manual step needed'), tone: 'danger' };
    case 'FAILED':
      return { label: t('Failed'), tone: 'danger' };
    case 'KEPT':
      return { label: t('Kept as is'), tone: 'neutral' };
    case 'WOULD_DO':
      return { label: t('Would change'), tone: 'warning' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

/**
 * 시연 조직을 스냅샷 상태로 되돌린다(어드민만). 먼저 미리 보기(dryRun)를 보이고, 되돌리기는 확인 뒤에만 보낸다.
 * DB 쓰기 담당 · 데모 앱 데이터 · AI 수정 PR 은 서버가 손대지 않고 「수동 필요」로 돌려준다.
 */
export function DemoRestoreButton({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const restore = useDemoRestore(orgId);
  const result = restore.data;

  return (
    <>
      <RoleButton requires="ADMIN" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t('Restore demo state')}
      </RoleButton>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) restore.reset();
          setOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('Restore demo state')}</DialogTitle>
            <DialogDescription>
              {t(
                'Cancels open migrations, ends active disasters, moves traffic and deploys back to the saved snapshot. Audit logs, security exceptions and settings are kept. Safe to run again.',
              )}
            </DialogDescription>
          </DialogHeader>

          {restore.isError && <ErrorState error={restore.error} />}

          {result && (
            <div className="flex flex-col gap-2">
              <p className="text-body-medium">
                {result.dryRun
                  ? t('Preview only. Nothing was changed.')
                  : result.restored
                    ? t('Restored to the snapshot.')
                    : t('Not fully restored yet.')}
                {result.callAgain &&
                  ` ${t('Some steps are still running. Run it again in a moment.')}`}
              </p>
              <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
                {result.steps.map((step) => (
                  <li
                    key={step.step}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-2"
                  >
                    <span className="font-mono text-mono">{step.step}</span>
                    <StatusBadge {...stepStatusView(step.status)} />
                    {step.items
                      .filter(
                        (item) => item.status === 'MANUAL_REQUIRED' || item.status === 'FAILED',
                      )
                      .map((item) => (
                        <span
                          key={`${item.targetType}-${item.targetId ?? item.label}`}
                          className="w-full text-small text-fg-secondary"
                        >
                          {[item.label, item.code, item.detail].filter(Boolean).join(' · ')}
                        </span>
                      ))}
                  </li>
                ))}
              </ul>
              {result.manualRequired.length > 0 && (
                <p className="text-small text-danger-fg">
                  {t('Manual step needed: {{steps}}', { steps: result.manualRequired.join(', ') })}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('Close')}
            </Button>
            <Button
              variant="secondary"
              disabled={restore.isPending}
              onClick={() => restore.mutate(true)}
            >
              {t('Preview')}
            </Button>
            <Button
              variant="destructive"
              disabled={restore.isPending || !result}
              title={!result ? t('Preview first') : undefined}
              onClick={() => restore.mutate(false)}
            >
              {restore.isPending ? t('Working…') : t('Restore')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
