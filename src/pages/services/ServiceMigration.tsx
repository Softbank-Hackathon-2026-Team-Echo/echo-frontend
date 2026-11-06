import { ArrowRightLeft } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ProviderLabel } from '@/components/ProviderLabel';
import { RoleButton } from '@/components/RoleButton';
import { SharedTrafficNotice } from '@/components/SharedTrafficNotice';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEnvironments } from '@/lib/api/environments';
import { useOrgMigrationPlans } from '@/lib/api/migrations';
import type { ServiceDetail } from '@/lib/api/types';
import { missingKeys, useVariableMatrix } from '@/lib/api/variables';
import { dateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { migrationModeLabel, migrationPlanStatusView, type Tone } from '@/lib/status';
import {
  PlanMigrationDialog,
  targetState,
  targetStateLabel,
} from '@/pages/migrations/PlanMigrationDialog';

const STATE_TONE: Record<ReturnType<typeof targetState>, Tone> = {
  ready: 'success',
  'not-deployed': 'neutral',
  'out-of-sync': 'warning',
  unreachable: 'danger',
};

/** 이전 탭: 어느 환경으로 옮길 수 있는지, 이 서비스의 이전 기록 */
export function ServiceMigration({
  orgId,
  orgSlug,
  service,
}: {
  orgId: string;
  orgSlug: string;
  service: ServiceDetail;
}) {
  const environments = useEnvironments(orgId);
  const matrix = useVariableMatrix(orgId, service);
  const plans = useOrgMigrationPlans(orgId, [service.id]);
  const [planning, setPlanning] = useState(false);
  const source = service.environments.find((link) => link.trafficWeight === 100);
  const names = new Map(environments.data?.items.map((item) => [item.id, item.name]));
  const targets = (environments.data?.items ?? []).filter(
    (item) => item.id !== source?.environment.id,
  );

  return (
    <div className="flex flex-col gap-6">
      <SharedTrafficNotice orgId={orgId} />
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col">
            <h2 className="text-h3">{t('Where it can move')}</h2>
            <p className="text-small text-fg-secondary">
              {source
                ? t('Serving from {{name}} now.', { name: source.environment.name })
                : t('This service is not serving traffic yet.')}
            </p>
          </div>
          <RoleButton
            requires="DEVELOPER"
            disabledReason={source ? undefined : t('Deploy this service first')}
            onClick={() => setPlanning(true)}
          >
            {t('Plan a migration')}
          </RoleButton>
        </div>
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Environment')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead>{t('Variables')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.map((target) => {
                const state = targetState(service, target);
                const missing = missingKeys(matrix.columns, target.id);
                return (
                  <TableRow key={target.id}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <ProviderLabel kind={target.kind} showLocation={false} />
                        {target.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge label={targetStateLabel(state)} tone={STATE_TONE[state]} />
                    </TableCell>
                    <TableCell className="text-fg-secondary">
                      {state === 'not-deployed' ? (
                        '—'
                      ) : missing.length > 0 ? (
                        <Link to="?tab=variables" className="text-warning-fg underline">
                          {t('Missing {{keys}}', { keys: missing.join(', ') })}
                        </Link>
                      ) : (
                        t('All keys present')
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-h3">{t('Migration history')}</h2>
        {plans.isPending ? (
          <Skeleton className="h-24" />
        ) : plans.data.length === 0 ? (
          <EmptyState
            icon={ArrowRightLeft}
            title={t('No migrations yet')}
            description={t('Plans for this service and their results show up here.')}
          />
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {plans.data.map((plan) => (
              <li key={plan.id}>
                <Link
                  to={`/o/${orgSlug}/migrations/${plan.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 hover:bg-subtle"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-mono">
                      {names.get(plan.sourceEnvironmentId) ?? '?'} →{' '}
                      {names.get(plan.targetEnvironmentId) ?? '?'}
                    </span>
                    {plan.mode !== 'PLANNED' && (
                      <span className="text-caption text-fg-muted">
                        {migrationModeLabel(plan.mode)}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 text-small text-fg-secondary">
                    {dateTime(plan.createdAt)}
                    <StatusBadge {...migrationPlanStatusView(plan.status)} />
                    {plan.simulated && <SimulatedBadge />}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {planning && (
        <PlanMigrationDialog
          onClose={() => setPlanning(false)}
          orgId={orgId}
          orgSlug={orgSlug}
          serviceIds={[service.id]}
          fixedServiceId={service.id}
        />
      )}
    </div>
  );
}
