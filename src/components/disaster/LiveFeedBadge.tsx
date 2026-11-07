import { StatusBadge } from '@/components/StatusBadge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLiveFeedStatus } from '@/lib/api/disasters';
import { timeAgo } from '@/lib/format';
import { t } from '@/lib/i18n';
import { liveFeedView } from '@/lib/status';

/** 실제 지진 피드 상태. 서버 스위치가 꺼져 있으면 꺼짐으로 보이고, 연결된 것처럼 보이지 않게 한다 */
export function LiveFeedBadge({ orgId }: { orgId: string | undefined }) {
  const feed = useLiveFeedStatus(orgId);
  if (!feed.data) return null;
  const { connectionStatus, provider, lastPolledAt, lastErrorCode, threshold } = feed.data;
  const badge = <StatusBadge {...liveFeedView(connectionStatus)} />;
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-small text-fg-secondary">
      {t('Live feed ({{name}})', { name: provider })}
      {lastErrorCode ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{badge}</span>
          </TooltipTrigger>
          <TooltipContent>{lastErrorCode}</TooltipContent>
        </Tooltip>
      ) : (
        badge
      )}
      {lastPolledAt && (
        <span className="text-fg-muted">
          {t('Checked {{time}}', { time: timeAgo(lastPolledAt) })}
        </span>
      )}
      <span className="text-fg-muted">
        M{threshold.minMagnitude.toFixed(1)}+ · {threshold.radiusKm} km
      </span>
    </span>
  );
}
