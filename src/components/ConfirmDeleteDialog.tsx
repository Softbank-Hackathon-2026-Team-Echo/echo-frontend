import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { t } from '@/lib/i18n';

const NAME_SLOT = '\u0000';

type ConfirmDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 이 이름을 그대로 입력해야 삭제 버튼이 켜진다 */
  name: string;
  title: string;
  description: string;
  pending?: boolean;
  onConfirm: () => void;
};

/** 되돌릴 수 없는 삭제. 대상 이름을 입력해야 버튼이 켜진다 (frontend-conventions §4.3) */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  name,
  title,
  description,
  pending,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [typed, setTyped] = useState('');
  // 언어마다 이름 자리가 달라서 번역문을 이름 자리에서 나눠 이름만 mono 로 그린다
  const [before, after] = t('Type {{name}} to confirm.', { name: NAME_SLOT }).split(NAME_SLOT);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped('');
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5 text-body">
          <label htmlFor="confirm-delete-name">
            {before}
            <span className="font-mono text-mono">{name}</span>
            {after}
          </label>
          <Input
            id="confirm-delete-name"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button variant="destructive" disabled={typed !== name || pending} onClick={onConfirm}>
            {pending ? t('Deleting…') : t('Delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
