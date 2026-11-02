import { Siren } from 'lucide-react';
import { Link } from 'react-router';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { Button } from '@/components/ui/button';
import { useNow } from '@/hooks/useNow';
import { type Disaster, useActiveDisasters, useEndDisaster } from '@/lib/api/disasters';
import { useEnvironments } from '@/lib/api/environments';
import { timeAgo } from '@/lib/format';

const TYPE_LABEL: Record<Disaster['type'], string> = {
  EARTHQUAKE: 'Earthquake',
  TYPHOON: 'Typhoon',
};

/** 진행 중인 재난 경보. 앱 껍데기 상단 바 아래에 붙어 모든 화면에서 보인다 */
export function DisasterBanner({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
  const disasters = useActiveDisasters(orgId);
  const environments = useEnvironments(orgId);
  const end = useEndDisaster(orgId);
  const names = new Map(environments.data?.items.map((item) => [item.id, item.name]));
  // "2 minutes ago" 가 멈춰 보이지 않게 30초마다 다시 그린다
  const now = useNow(Boolean(disasters.data?.length), 30_000);

  if (!disasters.data?.length) return null;

  return (
    <div className="flex flex-col">
      {disasters.data.map((disaster) => {
        const affected = disaster.affectedEnvironmentIds.map((id) => names.get(id) ?? 'unknown');
        return (
          <div
            key={disaster.id}
            role="alert"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-danger-solid bg-danger-bg px-gutter py-2 text-danger-fg max-compact:px-gutter-compact"
          >
            <Siren aria-hidden className="size-4 shrink-0" />
            <span className="text-body-medium">
              {TYPE_LABEL[disaster.type]} M{disaster.magnitude.toFixed(1)} {disaster.epicenterLabel}
            </span>
            <span className="text-body">
              {affected.length === 0
                ? 'No environments in the impact radius.'
                : `${affected.length} at risk: ${affected.join(', ')}`}
            </span>
            <span className="text-small opacity-80">{timeAgo(disaster.startedAt, now)}</span>
            <SimulatedBadge />
            <span className="ml-auto flex items-center gap-2">
              {affected.length > 0 && (
                <Button asChild size="sm" variant="destructive">
                  <Link to={`/o/${orgSlug}/evacuation`}>Plan evacuation</Link>
                </Button>
              )}
              <RoleButton
                requires="DEVELOPER"
                size="sm"
                variant="outline"
                disabled={end.isPending}
                onClick={() => end.mutate(disaster.id)}
              >
                End simulation
              </RoleButton>
            </span>
          </div>
        );
      })}
    </div>
  );
}
