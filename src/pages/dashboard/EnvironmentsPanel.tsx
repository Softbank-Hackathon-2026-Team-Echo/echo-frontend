import { memo } from 'react';
import { Panel } from '@/components/Panel';
import { ProviderLabel } from '@/components/ProviderLabel';
import { StatusBadge } from '@/components/StatusBadge';
import type { EnvironmentSummary } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { envRoleView } from '@/lib/status';
import type { ServiceOnEnvironment } from './types';

/** S01 "Environments" 칸: 환경마다 역할 또는 재난 위험 */
export const EnvironmentsPanel = memo(function EnvironmentsPanel({
  environments,
  byEnvironment,
  atRisk,
  className,
}: {
  environments: EnvironmentSummary[];
  byEnvironment: Map<string, ServiceOnEnvironment[]>;
  atRisk: Set<string>;
  className?: string;
}) {
  return (
    <Panel title={t('Environments')} className={className}>
      <ul className="flex flex-col gap-2">
        {environments.map((environment) => {
          const role = byEnvironment.get(environment.id)?.[0]?.link.role;
          return (
            <li key={environment.id} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <ProviderLabel kind={environment.kind} showLocation={false} />
                <span className="truncate font-mono text-mono">{environment.name}</span>
              </span>
              {atRisk.has(environment.id) ? (
                <StatusBadge label={t('At risk')} tone="warning" />
              ) : role ? (
                <StatusBadge {...envRoleView(role)} />
              ) : (
                <StatusBadge label={t('Idle')} tone="neutral" />
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
});
