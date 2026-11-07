import { ArrowRight, MapPinOff, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { LiveFeedBadge } from '@/components/disaster/LiveFeedBadge';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCloudCosts } from '@/lib/api/costs';
import { EVACUATION_MIN_MAGNITUDE, useActiveDisasters } from '@/lib/api/disasters';
import { useEnvironments } from '@/lib/api/environments';
import {
  type ExcludedReason,
  estimatedMigrationSeconds,
  rankEvacuationTargets,
  SCORE_RULES,
  servingEnvironmentId,
} from '@/lib/api/evacuation';
import { useCurrentOrg } from '@/lib/api/me';
import { useServiceDetails, useServices } from '@/lib/api/services';
import { t } from '@/lib/i18n';
import { providerLabel } from '@/lib/status';
import { CandidateCard } from './CandidateCard';
import { WizardSteps } from './WizardSteps';

const EXCLUDED_TEXT: Record<ExcludedReason, (km: number | null) => string> = {
  INSIDE_RADIUS: (km) =>
    t('Inside impact radius ({{km}} km from the epicenter).', { km: km ?? '—' }),
  UNHEALTHY: () => t('Connection check failed. Fix the environment to use it as a target.'),
  UNKNOWN_LOCATION: () => t('Location unknown, so distance from the epicenter cannot be checked.'),
};

function duration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`;
}

/** E01-1 대피 마법사 1단계: 재난 반경 밖 후보 환경을 규칙 점수로 비교해 고른다 */
export default function EvacuationPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { organization } = useCurrentOrg(slug);
  const orgId = organization?.id;
  const environments = useEnvironments(orgId);
  const costs = useCloudCosts(orgId);
  const services = useServices(orgId);
  const details = useServiceDetails(orgId, services.data?.items.map((service) => service.id) ?? []);
  const disasters = useActiveDisasters(orgId);
  const [picked, setPicked] = useState<string>();

  if (environments.isError) {
    return <ErrorState error={environments.error} onRetry={() => environments.refetch()} />;
  }
  if (services.isError) {
    return <ErrorState error={services.error} onRetry={() => services.refetch()} />;
  }
  if (!organization || environments.isPending || services.isPending || disasters.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-16" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  const disaster = disasters.data?.at(-1);
  if (!disaster) {
    return (
      <>
        <PageHeader title={t('Evacuation')} actions={<LiveFeedBadge orgId={orgId} />} />
        <EmptyState
          icon={ShieldCheck}
          title={t('No active disaster')}
          description={t(
            'Evacuation targets appear when a disaster puts an environment at risk. Use Simulate disaster in the top bar to try it.',
          )}
        />
      </>
    );
  }

  const envList = environments.data.items;
  const byId = new Map(envList.map((item) => [item.id, item]));
  const affected = new Set(disaster.affectedEnvironmentIds);
  const atRisk = details.data.filter((service) => {
    const serving = servingEnvironmentId(service);
    return serving !== null && affected.has(serving);
  });
  const disasterTitle = `M${disaster.magnitude.toFixed(1)} ${disaster.epicenterLabel.replace(/^near /, '')}`;

  if (atRisk.length === 0) {
    return (
      <>
        <PageHeader
          title={t('Evacuation')}
          description={disaster.simulated ? `${disasterTitle} · simulated` : disasterTitle}
          actions={<LiveFeedBadge orgId={orgId} />}
        />
        <EmptyState
          icon={ShieldCheck}
          title={details.isPending ? t('Checking services…') : t('No services at risk')}
          description={t('No service is serving from an environment inside the impact radius.')}
        />
      </>
    );
  }

  const service = atRisk.find((item) => item.id === searchParams.get('service')) ?? atRisk[0];
  if (!service) return null;
  const ranking = rankEvacuationTargets(disaster, service, envList, costs.data);
  const source = ranking.source ? byId.get(ranking.source.environmentId) : undefined;
  const selected =
    ranking.candidates.find((item) => item.environmentId === picked) ?? ranking.candidates[0];
  const selectedEnv = selected ? byId.get(selected.environmentId) : undefined;

  function startPrecheck() {
    if (!selected || !service) return;
    const params = new URLSearchParams({ service: service.id, target: selected.environmentId });
    navigate(`pre-check?${params}`);
  }

  return (
    <>
      <PageHeader
        title={t('Choose an evacuation target')}
        description={t(
          '{{name}} is at risk. Candidates are registered environments outside the {{km}} km radius.',
          { name: source?.name ?? service.name, km: disaster.radiusKm },
        )}
        actions={
          <>
            <LiveFeedBadge orgId={orgId} />
            <Button asChild variant="outline">
              <Link to={`/o/${organization.slug}`}>{t('Back to dashboard')}</Link>
            </Button>
            <RoleButton requires="DEVELOPER" disabled={!selected} onClick={startPrecheck}>
              {t('Run AI pre-check')}
            </RoleButton>
          </>
        }
      />

      <WizardSteps current={0} />

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-small text-fg-secondary">{disasterTitle}</span>
        {disaster.simulated && <SimulatedBadge />}
        {details.data.length > 1 && (
          <Select
            value={service.id}
            onValueChange={(value) => {
              setPicked(undefined);
              setSearchParams({ service: value });
            }}
          >
            <SelectTrigger className="ml-auto w-56" aria-label={t('Service')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* 반경 밖이거나 아직 서비스 중이 아닌 서비스도 보이되 고를 수 없게 이유를 단다 */}
              {details.data.map((item) => {
                const isAtRisk = atRisk.includes(item);
                return (
                  <SelectItem key={item.id} value={item.id} disabled={!isAtRisk}>
                    {item.name}
                    {!isAtRisk && (
                      <span className="text-caption text-fg-muted">
                        {servingEnvironmentId(item) === null
                          ? t('not serving yet')
                          : t('outside the radius')}
                      </span>
                    )}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* 한 화면은 서비스 하나씩 보지만, 재난 반경 안 서비스는 모두 함께 옮겨 간다 */}
      {(atRisk.length > 1 || disaster.meetsThreshold) && (
        <p role="status" className="rounded-lg bg-subtle px-3 py-2 text-small text-fg-secondary">
          {disaster.meetsThreshold
            ? t('All services in the radius move together, one migration plan each: {{names}}.', {
                names: atRisk.map((item) => item.name).join(', '),
              })
            : t(
                '{{count}} services are at risk: {{names}}. Plan each one with the service picker above.',
                {
                  count: atRisk.length,
                  names: atRisk.map((item) => item.name).join(', '),
                },
              )}{' '}
          <Link className="underline" to={`/o/${organization.slug}/migrations`}>
            {t('See all migrations')}
          </Link>
        </p>
      )}

      {service.activeMigrationPlanId && (
        <p
          role="status"
          className="rounded-lg bg-migrating-bg px-3 py-2 text-body text-migrating-fg"
        >
          {t('{{name}} already has an open migration plan.', { name: service.name })}{' '}
          <Link
            className="underline"
            to={`plan?service=${service.id}&target=${selected?.environmentId ?? ''}&plan=${service.activeMigrationPlanId}`}
          >
            {t('Open the plan')}
          </Link>
        </p>
      )}

      {!disaster.meetsThreshold && (
        <p role="status" className="rounded-lg bg-subtle px-3 py-2 text-small text-fg-secondary">
          {t(
            'This earthquake is below the M{{magnitude}} evacuation threshold, so EchoPort does not propose a move. You can still plan one.',
            { magnitude: EVACUATION_MIN_MAGNITUDE.toFixed(1) },
          )}
        </p>
      )}

      {source && ranking.source && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg bg-warning-bg p-3 text-warning-fg"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <p className="text-body-medium">
              {t('Source: {{name}} ({{place}})', {
                name: source.name,
                place: source.location
                  ? `${providerLabel(source.kind)} · ${source.location}`
                  : providerLabel(source.kind),
              })}
            </p>
            <p className="text-small">
              {t(
                'Inside the impact radius ({{km}} km from the epicenter). Traffic and writes must move before the disaster escalates.',
                { km: ranking.source.distanceKm ?? '—' },
              )}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 max-wide:flex-col">
        <fieldset className="grid flex-1 grid-cols-2 gap-3 max-compact:grid-cols-1 max-wide:w-full">
          <legend className="sr-only">{t('Evacuation target')}</legend>
          {ranking.candidates.length === 0 ? (
            <EmptyState
              className="col-span-full"
              icon={MapPinOff}
              title={t('No safe environment')}
              description={t(
                'Every registered environment is inside the radius or unavailable. Register an environment in another region.',
              )}
              action={
                <Button asChild variant="outline" size="sm">
                  <Link to={`/o/${organization.slug}/settings/environments`}>
                    {t('Add environment')}
                  </Link>
                </Button>
              }
            />
          ) : (
            ranking.candidates.map((candidate) => {
              const environment = byId.get(candidate.environmentId);
              if (!environment) return null;
              return (
                <CandidateCard
                  key={candidate.environmentId}
                  candidate={candidate}
                  environment={environment}
                  selected={candidate.environmentId === selected?.environmentId}
                  onSelect={() => setPicked(candidate.environmentId)}
                />
              );
            })
          )}
        </fieldset>

        <aside className="flex w-80 shrink-0 flex-col gap-3 max-wide:w-full">
          {ranking.excluded.length > 0 && (
            <section className="flex flex-col gap-2 rounded-xl border border-dashed border-line-strong bg-subtle p-4">
              <h2 className="text-label text-fg-secondary">{t('Excluded')}</h2>
              {ranking.excluded.map((item) => (
                <div key={item.environmentId} className="flex flex-col gap-0.5">
                  <span className="font-mono text-mono">
                    {byId.get(item.environmentId)?.name ?? item.environmentId}
                  </span>
                  <span className="text-small text-fg-secondary">
                    {EXCLUDED_TEXT[item.reason](item.distanceKm)}
                    {item.environmentId === ranking.source?.environmentId &&
                      ` ${t('Source of this migration.')}`}
                  </span>
                </div>
              ))}
            </section>
          )}
          <section className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-4">
            <h2 className="text-title">{t('Why this ranking')}</h2>
            <dl className="flex flex-col gap-2.5">
              {SCORE_RULES.map((rule) => (
                <div key={rule.key} className="flex flex-col gap-0.5">
                  <dt className="text-body-medium">
                    {rule.label}{' '}
                    <span className="font-mono text-mono text-fg-muted">
                      ×{rule.weight.toFixed(2)}
                    </span>
                  </dt>
                  <dd className="text-small text-fg-secondary">{rule.rule}</dd>
                </div>
              ))}
            </dl>
            <p className="text-caption text-fg-muted">
              {t(
                'Scores are rule-based. The AI pre-check (next) tests the chosen target in a sandbox.',
              )}
            </p>
          </section>
        </aside>
      </div>

      {selected && selectedEnv && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3">
          <p className="text-body-medium">
            {t('Selected: {{name}} · score {{score}} · est. migration {{duration}}', {
              name: selectedEnv.name,
              score: selected.score,
              duration: duration(estimatedMigrationSeconds(selected)),
            })}
          </p>
          <RoleButton requires="DEVELOPER" onClick={startPrecheck}>
            {t('Run AI pre-check on {{name}}', { name: selectedEnv.name })}
            <ArrowRight aria-hidden />
          </RoleButton>
        </div>
      )}
    </>
  );
}
