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
            Type <span className="font-mono text-mono">{name}</span> to confirm.
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
            Cancel
          </Button>
          <Button variant="destructive" disabled={typed !== name || pending} onClick={onConfirm}>
            {pending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
