import { useParams } from 'react-router';
import { useLiveFeedStatus } from '@/lib/api/disasters';
import { useCurrentOrg } from '@/lib/api/me';
import { DisasterHistoryView } from './DisasterHistoryView';
import { EMPTY_HISTORY_FILTERS } from './HistoryEventList';

const ignore = () => {};

/**
 * 과거 재난 조회 재생(#100). 서버 조회 계약 전이라 목록을 비운 채 대기 상태로 둔다.
 * 샘플 사건을 운영 화면에 넣지 않는다. 데이터가 있는 모양은 개발 서버의 /dev/disaster-history 에서 본다
 */
export default function DisasterHistoryPage() {
  const { slug } = useParams();
  const { organization } = useCurrentOrg(slug);
  const feed = useLiveFeedStatus(organization?.id);

  return (
    <DisasterHistoryView
      scopeKey={organization?.id ?? ''}
      list={{ kind: 'contract-pending' }}
      detail={{ kind: 'none' }}
      selectedId={null}
      filters={EMPTY_HISTORY_FILTERS}
      operations={{
        liveIntakeStatus: feed.data?.connectionStatus ?? null,
        isLiveIntakeStale: feed.isError,
        liveIntakeCheckedAt: feed.data?.lastPolledAt ?? null,
        // 자동 이전 상태를 알려 주는 서버 값이 아직 없다. 꺼져 있다고 넘겨짚지 않는다
        autoMigrationEnabled: null,
      }}
      onFiltersChange={ignore}
      onSelect={ignore}
      onPageChange={ignore}
    />
  );
}
