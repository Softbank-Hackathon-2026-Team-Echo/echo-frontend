import { lazy, Suspense, useState } from 'react';
import { useParams } from 'react-router';
import { FormError } from '@/components/FormField';
import { RoleButton } from '@/components/RoleButton';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError } from '@/lib/api/errors';
import { useCurrentOrg } from '@/lib/api/me';
import { isActivePrecheck, redeployRequestIdOf, usePrecheck } from '@/lib/api/prechecks';
import { useFindingDiagnosis } from '@/lib/api/security';
import { useService } from '@/lib/api/services';
import type { SecurityFinding } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { precheckFailureLabel, precheckStepLabel } from '@/lib/status';
import { PatchReview } from '@/pages/evacuation/PatchReview';

const RedeployFollow = lazy(() =>
  import('@/pages/services/DeployProgressPage').then((module) => ({
    default: module.RedeployFollow,
  })),
);

export function CveDiagnosis({ finding }: { finding: SecurityFinding }) {
  const { slug } = useParams();
  const { organization } = useCurrentOrg(slug);
  const orgId = organization?.id;
  const create = useFindingDiagnosis(orgId, finding.id);
  const [runId, setRunId] = useState<string>();
  const query = usePrecheck(orgId, runId);
  const service = useService(orgId, finding.serviceId ?? undefined);
  const run = query.data;
  const lastStep = run?.steps.at(-1);
  const redeployId = redeployRequestIdOf(run);
  const deployLink = (id: string) => `/o/${slug}/services/${finding.serviceId}/deploys/${id}`;
  if (!orgId || finding.remediation?.kind !== 'DEPENDENCY_BUMP') return null;
  return (
    <section
      aria-label={t('Dependency remediation')}
      className="flex flex-col gap-2 border-t border-line pt-3"
    >
      {finding.mode === 'SIMULATED' && (
        <p className="text-small text-warning-fg">
          {t('Synthetic advisory · sandbox checks and approved redeploy are real.')}
        </p>
      )}
      {!runId && (
        <RoleButton
          requires="DEVELOPER"
          size="sm"
          variant="outline"
          disabled={create.isPending}
          onClick={() => create.mutate(undefined, { onSuccess: (value) => setRunId(value.id) })}
        >
          {create.isPending ? t('Starting diagnosis…') : t('Create dependency fix')}
        </RoleButton>
      )}
      {(create.isError || query.isError) && (
        <FormError message={describeApiError(create.error ?? query.error)} />
      )}
      {runId && !run && !query.isError && <Skeleton className="h-16 w-full" />}
      {run && (
        <>
          {isActivePrecheck(run.status) && (
            <p role="status" className="text-small">
              {lastStep ? precheckStepLabel(lastStep.name) : t('Waiting for the AI agent')}
            </p>
          )}
          {run.failureCode && (
            <p role="alert" className="text-small text-danger-fg">
              {precheckFailureLabel(run.failureCode)}
            </p>
          )}
          {run.diagnosis?.cause && <p className="text-body">{run.diagnosis.cause}</p>}
          {run.diagnosis?.unfixableReason && (
            <p className="text-small text-fg-secondary">{run.diagnosis.unfixableReason}</p>
          )}
          <ul aria-label={t('Evidence')} className="flex flex-col gap-1">
            {run.diagnosis?.evidence.map((item) => (
              <li
                key={`${item.source}-${item.path}-${item.line}-${item.text}`}
                className="text-small break-all"
              >
                {item.source === 'ADVISORY'
                  ? t('Advisory')
                  : `${item.path ?? item.source}:${item.line ?? ''}`}{' '}
                · <code>{item.text}</code>
              </li>
            ))}
          </ul>
          {run.patches.length > 0 && (
            <p className="text-small text-fg-secondary">
              {t('Build and startup checks passed. Functional compatibility has not been tested.')}
            </p>
          )}
          {run.patches.map((patch, index) => (
            <PatchReview
              key={patch.id}
              orgId={orgId}
              precheckId={run.id}
              patch={patch}
              number={index + 1}
              deployLink={deployLink}
            />
          ))}
          {!isActivePrecheck(run.status) && (
            <Button size="sm" variant="ghost" onClick={() => query.refetch()}>
              {t('Check again')}
            </Button>
          )}
        </>
      )}
      {redeployId && (
        <Suspense fallback={<Skeleton className="h-16 w-full" />}>
          <RedeployFollow
            orgId={orgId}
            redeployRequestId={redeployId}
            service={service.data}
            requestLink={deployLink}
          />
        </Suspense>
      )}
    </section>
  );
}
