import { ArrowRightLeft, CircleCheck, Gauge, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { RoleButton } from '@/components/RoleButton';
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
import { useCurrentOrg } from '@/lib/api/me';
import { useOrgMigrationPlans } from '@/lib/api/migrations';
import { useServices } from '@/lib/api/services';
import { t } from '@/lib/i18n';
import { duration } from '@/lib/migration-stages';
import { migrationErrorLabel, migrationModeLabel, migrationPlanStatusView } from '@/lib/status';
import { PlanMigrationDialog } from './PlanMigrationDialog';

function ModeBadge({ mode }: { mode: string }) {
  return (
    <span className="rounded-sm bg-subtle px-1.5 text-label text-fg-secondary">
      {migrationModeLabel(mode)}
    </span>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-1 items-center gap-3 px-4 py-3">
      <span className="flex size-8 items-center justify-center rounded-md bg-brand-subtle text-brand-on-subtle">
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="flex flex-col">
        <span className="text-caption text-fg-secondary">{label}</span>
        <span className="text-body-medium tabular-nums">{value}</span>
      </span>
    </div>
  );
}

const took = (from: string | null, to: string | null) =>
  from && to ? Math.round((Date.parse(to) - Date.parse(from)) / 1000) : null;

/** M01 이전 기록: 계획 · 실행 · 롤백. 행을 누르면 M02 결과로 간다 */
export default function MigrationsPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { organization } = useCurrentOrg(slug);
  const orgId = organization?.id;
  const services = useServices(orgId);
  const environments = useEnvironments(orgId);
  const [planOpen, setPlanOpen] = useState(false);
  const serviceItems = services.data?.items ?? [];
  const plans = useOrgMigrationPlans(
    orgId,
    serviceItems.map((service) => service.id),
  );

  if (services.isError)
    return <ErrorState error={services.error} onRetry={() => services.refetch()} />;
  if (plans.error) return <ErrorState error={plans.error} />;

  const envNames = new Map(environments.data?.items.map((item) => [item.id, item.name]));
  const serviceNames = new Map(serviceItems.map((item) => [item.id, item.name]));
  const runs = plans.data;
  const succeeded = runs.filter((plan) => plan.status === 'SUCCEEDED');
  const ran = runs.filter((plan) => plan.startedAt);
  const fastest = succeeded
    .map((plan) => took(plan.startedAt, plan.finishedAt))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b)[0];

  return (
    <>
      <PageHeader
        title={t('Migrations')}
        description={t('Every evacuation and failback with its measured result.')}
        actions={
          <RoleButton requires="DEVELOPER" onClick={() => setPlanOpen(true)}>
            {t('Plan a migration')}
          </RoleButton>
        }
      />
      {!organization || services.isPending || plans.isPending ? (
        <Skeleton className="h-64" />
      ) : runs.length === 0 ? (
        <EmptyState
          icon={ArrowRightLeft}
          title={t('No migrations yet')}
          description={t(
            'Choose a service and a target with Plan a migration. Approved plans and their results show up here.',
          )}
        />
      ) : (
        <>
          <div className="flex divide-x divide-line rounded-xl border border-line bg-surface max-compact:flex-col max-compact:divide-x-0 max-compact:divide-y">
            <Summary icon={ArrowRightLeft} label={t('Plans')} value={String(runs.length)} />
            <Summary
              icon={CircleCheck}
              label={t('Succeeded')}
              value={`${succeeded.length} / ${ran.length}`}
            />
            <Summary
              icon={Gauge}
              label={t('Fastest run')}
              value={fastest === undefined ? '—' : duration(fastest)}
            />
            <Summary
              icon={ShieldCheck}
              label={t('Rolled back')}
              value={String(runs.filter((plan) => plan.status === 'ROLLED_BACK').length)}
            />
          </div>
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Plan')}</TableHead>
                  <TableHead>{t('Service')}</TableHead>
                  <TableHead>{t('Route')}</TableHead>
                  <TableHead>{t('Status')}</TableHead>
                  <TableHead>{t('Result')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((plan) => {
                  const seconds = took(plan.startedAt, plan.finishedAt);
                  return (
                    <TableRow
                      key={plan.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/o/${slug}/migrations/${plan.id}`)}
                    >
                      <TableCell>
                        <Link
                          to={`/o/${slug}/migrations/${plan.id}`}
                          className="font-mono text-mono hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {plan.id.slice(0, 8)}
                        </Link>
                        <span className="text-caption text-fg-muted">
                          {' '}
                          ·{' '}
                          {new Date(plan.createdAt).toLocaleString('en-GB', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </TableCell>
                      <TableCell>{serviceNames.get(plan.serviceId) ?? '—'}</TableCell>
                      <TableCell>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-mono">
                            {envNames.get(plan.sourceEnvironmentId) ?? '?'} →{' '}
                            {envNames.get(plan.targetEnvironmentId) ?? '?'}
                          </span>
                          {plan.mode !== 'PLANNED' && <ModeBadge mode={plan.mode} />}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          <StatusBadge {...migrationPlanStatusView(plan.status)} />
                          {plan.simulated && <SimulatedBadge />}
                        </span>
                      </TableCell>
                      <TableCell className="text-fg-secondary">
                        {plan.errorCode
                          ? migrationErrorLabel(plan.errorCode)
                          : seconds === null
                            ? '—'
                            : t('took {{duration}}', { duration: duration(seconds) })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      {organization && planOpen && (
        <PlanMigrationDialog
          onClose={() => setPlanOpen(false)}
          orgId={organization.id}
          orgSlug={organization.slug}
          serviceIds={serviceItems.map((service) => service.id)}
        />
      )}
    </>
  );
}
