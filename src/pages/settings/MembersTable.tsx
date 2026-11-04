import { LogOut, UserMinus } from 'lucide-react';
import { useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { RoleButton } from '@/components/RoleButton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useMembers, useRemoveMember, useUpdateMemberRole } from '@/lib/api/members';
import { MEMBER_ROLES, type Member, type MemberRole } from '@/lib/api/types';
import { dateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { hasRole, ROLE_LABELS, roleLabel } from '@/lib/roles';

type MembersTableProps = {
  orgId: string;
  myUserId: string;
  myRole: MemberRole | null;
  onLeft: () => void;
};

/** 멤버 표. 어드민은 다른 사람의 역할을 바꾸고 내보낼 수 있고, 누구나 스스로 나갈 수 있다 */
export function MembersTable({ orgId, myUserId, myRole, onLeft }: MembersTableProps) {
  const members = useMembers(orgId);
  const updateRole = useUpdateMemberRole(orgId);
  const remove = useRemoveMember(orgId);
  const [removing, setRemoving] = useState<Member>();
  const isAdmin = hasRole(myRole, 'ADMIN');

  if (members.isError)
    return <ErrorState error={members.error} onRetry={() => members.refetch()} />;
  if (members.isPending) return <Skeleton className="h-40 w-full" />;

  const leaving = removing?.id === myUserId;

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>GitHub</TableHead>
              <TableHead>{t('Role')}</TableHead>
              <TableHead>{t('Can approve')}</TableHead>
              <TableHead>{t('Joined')}</TableHead>
              <TableHead className="w-0">
                <span className="sr-only">{t('Actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.data.items.map((member) => {
              const isMe = member.id === myUserId;
              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Avatar className="size-6">
                        {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt="" />}
                        <AvatarFallback className="bg-brand-subtle text-caption text-brand-on-subtle">
                          {member.githubLogin.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-mono text-mono">@{member.githubLogin}</span>
                      {isMe && <span className="text-caption text-fg-muted">{t('You')}</span>}
                    </span>
                  </TableCell>
                  <TableCell>
                    {/* 자기 역할은 바꿀 수 없다(서버 403 CANNOT_CHANGE_OWN_ROLE) */}
                    {isAdmin && !isMe ? (
                      <Select
                        value={member.role}
                        disabled={updateRole.isPending}
                        onValueChange={(role) =>
                          updateRole.mutate({ userId: member.id, role: role as MemberRole })
                        }
                      >
                        <SelectTrigger
                          className="h-7 w-32"
                          aria-label={t('Role of {{login}}', { login: member.githubLogin })}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MEMBER_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      roleLabel(member.role)
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-mono">
                    {hasRole(member.role, 'DEVELOPER') ? t('yes') : t('no')}
                  </TableCell>
                  <TableCell className="text-fg-secondary">{dateTime(member.joinedAt)}</TableCell>
                  <TableCell>
                    {isMe ? (
                      <Button variant="ghost" size="sm" onClick={() => setRemoving(member)}>
                        <LogOut aria-hidden />
                        {t('Leave')}
                      </Button>
                    ) : (
                      <RoleButton
                        requires="ADMIN"
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemoving(member)}
                      >
                        <UserMinus aria-hidden />
                        {t('Remove')}
                      </RoleButton>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {leaving
                ? t('Leave this organization?')
                : t('Remove @{{login}}?', { login: removing?.githubLogin ?? '' })}
            </DialogTitle>
            <DialogDescription>
              {leaving
                ? t('You lose access right away. An admin has to invite you again to come back.')
                : t('They lose access right away. You can invite them again later.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(undefined)}>
              {t('Cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                removing &&
                remove.mutate(removing.id, {
                  onSuccess: () => {
                    setRemoving(undefined);
                    if (leaving) onLeft();
                  },
                })
              }
            >
              {leaving ? t('Leave') : t('Remove')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
