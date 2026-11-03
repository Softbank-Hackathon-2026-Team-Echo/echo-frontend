import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { RoleButton } from '@/components/RoleButton';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentOrg } from '@/lib/api/me';
import { useUpdateOrgSettings } from '@/lib/api/members';
import type { Organization } from '@/lib/api/types';
import { hasRole } from '@/lib/roles';
import { AgentTokensPanel } from './AgentTokensPanel';
import { InvitationsPanel } from './InvitationsPanel';
import { InviteDialog } from './InviteDialog';
import { MembersTable } from './MembersTable';
import { SettingsTabs } from './SettingsTabs';

/** 이전 계획을 만든 사람이 스스로 승인할 수 있는지. 기본은 꺼짐(다른 개발자가 승인) */
function ApprovalSetting({ organization }: { organization: Organization }) {
  const update = useUpdateOrgSettings(organization.id);
  const isAdmin = hasRole(organization.role, 'ADMIN');
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
      <h2 className="text-title">Migration approvals</h2>
      <label className="flex items-start gap-2 text-body has-[:disabled]:cursor-not-allowed">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-brand"
          checked={organization.allowSelfApproval}
          disabled={!isAdmin || update.isPending}
          onChange={(event) => update.mutate({ allowSelfApproval: event.target.checked })}
        />
        <span className="flex flex-col gap-0.5">
          Let the person who planned a migration approve it
          <span className="text-small text-fg-muted">
            {organization.allowSelfApproval
              ? 'On. Useful when one developer runs the whole demo.'
              : 'Off. Another developer or admin has to approve.'}
            {!isAdmin && ' Only admins can change this.'}
          </span>
        </span>
      </label>
    </section>
  );
}

/** SET 멤버 탭: 멤버·역할 · 초대 대기 · 에이전트 토큰 · 승인 설정 */
export default function MembersPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data: me, organization } = useCurrentOrg(slug);
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Members & roles"
        description="Viewer < Developer < Admin. Approvals need Developer or above; delete, invite and role changes need Admin."
        actions={
          <RoleButton requires="ADMIN" onClick={() => setInviteOpen(true)}>
            Invite by GitHub ID
          </RoleButton>
        }
      />
      <SettingsTabs />
      {!organization || !me ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <MembersTable
            orgId={organization.id}
            myUserId={me.user.id}
            myRole={organization.role}
            onLeft={() => navigate('/')}
          />
          <div className="grid grid-cols-2 items-start gap-4 max-compact:grid-cols-1">
            <InvitationsPanel
              orgId={organization.id}
              isAdmin={hasRole(organization.role, 'ADMIN')}
            />
            <AgentTokensPanel
              orgId={organization.id}
              canManage={hasRole(organization.role, 'DEVELOPER')}
            />
          </div>
          <ApprovalSetting organization={organization} />
          <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} orgId={organization.id} />
        </>
      )}
    </>
  );
}
