import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DeployRequestSummary } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { shortSha } from '@/lib/status';

/**
 * 되돌리기 확인 창. 되돌리는 범위(이미지와 그 배포에 고정한 변수 버전)를 적는다.
 * 서버는 대상 배포의 빌드·커밋·설정 사본으로 새 배포 요청을 만든다(API 서버 4 · 10)
 */
export function RollbackDialog({
  target,
  onOpenChange,
  pending,
  onConfirm,
}: {
  target: DeployRequestSummary | undefined;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onConfirm: (target: DeployRequestSummary) => void;
}) {
  const sha = shortSha(target?.commitSha);
  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('Roll back to {{sha}}?', { sha })}</DialogTitle>
          <DialogDescription>
            {t(
              'This restores both the image and the variable versions pinned at that deploy. A new deploy is created and history is kept.',
            )}
          </DialogDescription>
        </DialogHeader>
        {target && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-md bg-subtle p-3 text-small">
            <dt className="text-fg-secondary">{t('Environment')}</dt>
            <dd>{target.environment.name}</dd>
            <dt className="text-fg-secondary">{t('Image')}</dt>
            <dd className="font-mono text-mono">{sha}</dd>
            <dt className="text-fg-secondary">{t('Variables')}</dt>
            <dd>{t('Versions pinned at that deploy')}</dd>
            <dt className="text-fg-secondary">{t('Build')}</dt>
            <dd>{t('Reused, no new build')}</dd>
          </dl>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button disabled={pending || !target} onClick={() => target && onConfirm(target)}>
            <RotateCcw aria-hidden />
            {pending ? t('Rolling back…') : t('Roll back')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
