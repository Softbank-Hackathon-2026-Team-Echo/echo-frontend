import { type FormEvent, useState } from 'react';
import { FormError, FormField } from '@/components/FormField';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fieldErrors } from '@/lib/api/form-errors';
import { useCreateInvitation } from '@/lib/api/members';
import { MEMBER_ROLES, type MemberRole } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { ROLE_LABELS } from '@/lib/roles';

/** GitHub 아이디 + 역할로 초대한다. 그 사람이 로그인하면 바로 멤버가 된다 */
export function InviteDialog({
  open,
  onOpenChange,
  orgId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
}) {
  const create = useCreateInvitation(orgId);
  const [githubLogin, setGithubLogin] = useState('');
  const [role, setRole] = useState<MemberRole>('VIEWER');
  const errors = fieldErrors(create.error);

  function close(next: boolean) {
    if (!next) {
      setGithubLogin('');
      setRole('VIEWER');
      create.reset();
    }
    onOpenChange(next);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      { githubLogin: githubLogin.trim().replace(/^@/, ''), role },
      { onSuccess: () => close(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('Invite by GitHub ID')}</DialogTitle>
            <DialogDescription>
              {t(
                'They join with this role the next time they sign in. The invitation expires after 7 days.',
              )}
            </DialogDescription>
          </DialogHeader>
          <FormField id="invite-login" label={t('GitHub username')} error={errors.githubLogin}>
            <Input
              id="invite-login"
              value={githubLogin}
              onChange={(event) => setGithubLogin(event.target.value)}
              placeholder="octocat"
              autoComplete="off"
              aria-invalid={Boolean(errors.githubLogin)}
              required
            />
          </FormField>
          <FormField
            id="invite-role"
            label={t('Role')}
            hint={t(
              'Developers can deploy, migrate and approve. Admins also invite, change roles and delete.',
            )}
            error={errors.role}
          >
            <Select value={role} onValueChange={(value) => setRole(value as MemberRole)}>
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEMBER_ROLES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {ROLE_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormError message={errors._form} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              {t('Cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending || !githubLogin.trim()}>
              {t('Send invitation')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
