import { Users } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { SettingsTabs } from './SettingsTabs';

/** SET 멤버 탭. 멤버·초대·에이전트 토큰 화면은 프론트 9(#9)에서 만든다 */
export default function MembersPage() {
  return (
    <>
      <PageHeader
        title="Members"
        description="People and agent tokens that can access this organization."
      />
      <SettingsTabs />
      <EmptyState
        icon={Users}
        title="Members are coming next"
        description="Invite by GitHub ID, change roles and manage agent tokens here."
      />
    </>
  );
}
