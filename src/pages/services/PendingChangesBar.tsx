import { CircleDot, Rocket } from 'lucide-react';
import { useState } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ServiceDetail } from '@/lib/api/types';
import { type PendingVariable, usePendingVariables } from '@/lib/api/variables';
import { t } from '@/lib/i18n';

/**
 * 변경 대기 띠 (Railway "Apply 1 change"). 값을 바꾼 변수는 다음 배포에 반영되므로 서비스 화면 맨 위에 고정해
 * 놓칠 수 없게 하고, Details 에서 키 · 지금 적용된 버전 · 새 버전을 비교한다. 값은 어디에도 보이지 않는다
 */
export function PendingChangesBar({
  orgId,
  service,
  disabledReason,
  onDeploy,
}: {
  orgId: string;
  service: ServiceDetail;
  disabledReason?: string;
  onDeploy: (environmentId: string) => void;
}) {
  const environmentIds = service.environments.map((link) => link.environment.id);
  const pending = usePendingVariables(orgId, service.id, environmentIds);
  const [detailsOpen, setDetailsOpen] = useState(false);
  if (pending.length === 0) return null;

  const nameOf = (environmentId: string) =>
    service.environments.find((link) => link.environment.id === environmentId)?.environment.name ??
    environmentId;
  const byEnvironment = new Map<string, PendingVariable[]>();
  for (const item of pending) {
    byEnvironment.set(item.environmentId, [...(byEnvironment.get(item.environmentId) ?? []), item]);
  }
  const keys = [...new Set(pending.map((item) => item.key))];

  return (
    <>
      <div
        role="status"
        className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-warning-bg px-4 py-2.5 text-warning-fg shadow-sm"
      >
        <CircleDot aria-hidden className="size-4" />
        <span className="text-body-medium">
          {pending.length === 1
            ? t('Apply 1 change')
            : t('Apply {{n}} changes', { n: pending.length })}
        </span>
        <span className="min-w-0 truncate font-mono text-mono">{keys.join(' · ')}</span>
        <span className="text-small">
          {t('in {{names}}', { names: [...byEnvironment.keys()].map(nameOf).join(', ') })}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setDetailsOpen(true)}>
            {t('Details')}
          </Button>
          {[...byEnvironment.keys()].map((environmentId) => (
            <RoleButton
              key={environmentId}
              requires="DEVELOPER"
              size="sm"
              disabledReason={disabledReason}
              onClick={() => onDeploy(environmentId)}
            >
              <Rocket aria-hidden />
              {byEnvironment.size === 1
                ? t('Deploy changes')
                : t('Deploy {{name}}', { name: nameOf(environmentId) })}
            </RoleButton>
          ))}
        </div>
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('Pending changes')}</DialogTitle>
            <DialogDescription>
              {t(
                'These variables were saved but the running app still uses the applied version. Values stay hidden.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-md border border-line">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Environment')}</TableHead>
                  <TableHead>{t('Change')}</TableHead>
                  <TableHead>{t('Current value')}</TableHead>
                  <TableHead>{t('New value')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((item) => (
                  <TableRow key={`${item.environmentId}:${item.key}`}>
                    <TableCell>{nameOf(item.environmentId)}</TableCell>
                    <TableCell className="font-mono text-mono">{item.key}</TableCell>
                    <TableCell className="font-mono text-mono text-fg-muted">
                      {item.appliedVersion === null ? t('(not set)') : `v${item.appliedVersion}`}
                    </TableCell>
                    <TableCell className="font-mono text-mono">v{item.version}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              {t('Close')}
            </Button>
            {byEnvironment.size === 1 && (
              <RoleButton
                requires="DEVELOPER"
                disabledReason={disabledReason}
                onClick={() => {
                  setDetailsOpen(false);
                  onDeploy([...byEnvironment.keys()][0] ?? '');
                }}
              >
                {t('Deploy changes')}
              </RoleButton>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
