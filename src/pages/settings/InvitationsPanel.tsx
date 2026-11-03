import { ErrorState } from '@/components/ErrorState';
import { RoleButton } from '@/components/RoleButton';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { useInvitations, useMembers, useRevokeInvitation } from '@/lib/api/members';
import { dateTime } from '@/lib/format';
import { roleLabel } from '@/lib/roles';

/** 초대 대기 목록(어드민만). 수락·만료·취소된 것은 목록에서 뺀다 */
export function InvitationsPanel({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  const invitations = useInvitations(orgId, isAdmin);
  const members = useMembers(orgId);
  const revoke = useRevokeInvitation(orgId);
  const logins = new Map(members.data?.items.map((member) => [member.id, member.githubLogin]));

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <header className="flex flex-col gap-0.5">
        <h2 className="text-title">Pending invitations</h2>
        <p className="text-small text-fg-secondary">
          Applied when the person signs in with that GitHub account. Expires after 7 days.
        </p>
      </header>
      {!isAdmin ? (
        <p className="text-small text-fg-muted">Only admins can see and send invitations.</p>
      ) : invitations.isError ? (
        <ErrorState error={invitations.error} onRetry={() => invitations.refetch()} />
      ) : invitations.isPending ? (
        <Skeleton className="h-12 w-full" />
      ) : (
        (() => {
          const pending = invitations.data.items.filter((item) => item.status === 'PENDING');
          if (pending.length === 0) {
            return <p className="text-small text-fg-muted">No pending invitations.</p>;
          }
          return (
            <ul className="flex flex-col divide-y divide-line border-t border-line">
              {pending.map((invitation) => (
                <li key={invitation.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="font-mono text-mono">@{invitation.githubLogin}</span>
                  <StatusBadge label={roleLabel(invitation.role)} tone="neutral" />
                  <span className="text-caption text-fg-muted">
                    invited by @{logins.get(invitation.invitedByUserId) ?? 'unknown'} · expires{' '}
                    {dateTime(invitation.expiresAt)}
                  </span>
                  <RoleButton
                    requires="ADMIN"
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(invitation.id)}
                  >
                    Revoke
                  </RoleButton>
                </li>
              ))}
            </ul>
          );
        })()
      )}
    </section>
  );
}
