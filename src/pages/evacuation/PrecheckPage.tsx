import { CircleAlert, FlaskConical } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { type Stage, StageList } from '@/components/StageList';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNow } from '@/hooks/useNow';
import { useRole } from '@/hooks/useRole';
import { useEnvironments } from '@/lib/api/environments';
import { useCurrentOrg } from '@/lib/api/me';
import {
  type PrecheckStepName,
  type PrecheckView,
  useDecidePatch,
  usePrecheck,
  useStartPrecheck,
  useStopPrecheck,
  viewPrecheck,
} from '@/lib/api/prechecks';
import { useService } from '@/lib/api/services';
import { hasRole } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { PatchReview } from './PatchReview';
import { WizardSteps } from './WizardSteps';

const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB') : '');

const STEP_TITLES: Record<PrecheckStepName, string> = {
  SANDBOX: 'Sandbox created',
  CONFIG_DIFF: 'Config diff',
  FEATURE_GAPS: 'Feature gap mapping',
  PATCH_VERIFY: 'Patch & verify',
  APPROVAL: 'Human approval',
};

function progress(view: PrecheckView): Stage[] {
  const verifying = view.patches.find((patch) => patch.status === 'VERIFYING');
  const meta: Record<PrecheckStepName, string> = {
    SANDBOX: `${view.sandboxId} · ${clock(view.startedAt)}`,
    CONFIG_DIFF: `${view.configDiff.length} keys differ`,
    FEATURE_GAPS: `${view.featureGaps.length} gaps found`,
    PATCH_VERIFY: verifying
      ? `patch #${verifying.number} · testing`
      : `${view.patches.length} patches tested`,
    APPROVAL: 'Developer or above',
  };
  return view.steps.map((step) => ({
    key: step.name,
    title: STEP_TITLES[step.name],
    meta: step.state === 'PENDING' && step.name !== 'APPROVAL' ? undefined : meta[step.name],
    state: step.state === 'DONE' ? 'done' : step.state === 'RUNNING' ? 'current' : 'pending',
  }));
}

/** E01-2 AI 사전 점검: 샌드박스에서 도착 환경을 시험하고, 수정안은 사람이 승인한다 */
export default function PrecheckPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const serviceId = searchParams.get('service') ?? undefined;
  const targetId = searchParams.get('target') ?? undefined;
  const { organization } = useCurrentOrg(slug);
  const orgId = organization?.id;
  const role = useRole();
  const service = useService(orgId, serviceId);
  const environments = useEnvironments(orgId);
  const precheck = usePrecheck(orgId, serviceId, targetId);
  const start = useStartPrecheck(orgId ?? '');
  const stop = useStopPrecheck(orgId ?? '');
  const decide = useDecidePatch(orgId ?? '');
  const [tab, setTab] = useState('patches');
  const now = useNow(true);

  // E01-1 에서 "Run AI pre-check" 를 눌러 들어왔으니, 아직 점검이 없으면 바로 시작한다(개발자 이상만)
  const missing = precheck.isSuccess && precheck.data === null;
  const canStart = hasRole(role, 'DEVELOPER');
  const { mutate: startPrecheck, isIdle } = start;
  useEffect(() => {
    if (missing && canStart && isIdle && serviceId && targetId) {
      startPrecheck({ serviceId, targetEnvironmentId: targetId });
    }
  }, [missing, canStart, isIdle, serviceId, targetId, startPrecheck]);

  if (!serviceId || !targetId) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="Choose a target first"
        description="Pick an evacuation target, then run the AI pre-check on it."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={`/o/${slug}/evacuation`}>Choose target</Link>
          </Button>
        }
      />
    );
  }
  if (service.isError)
    return <ErrorState error={service.error} onRetry={() => service.refetch()} />;
  if (!organization || service.isPending || environments.isPending || precheck.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-16" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const envs = environments.data?.items ?? [];
  const target = envs.find((item) => item.id === targetId);
  const source = envs.find(
    (item) =>
      item.id === service.data.environments.find((link) => link.role === 'SERVING')?.environment.id,
  );
  const planUrl = `/o/${organization.slug}/evacuation/plan?service=${serviceId}&target=${targetId}`;

  if (!precheck.data) {
    return (
      <>
        <PageHeader title={`AI pre-check · ${target?.name ?? 'target'}`} />
        <WizardSteps current={1} />
        <EmptyState
          icon={FlaskConical}
          title={canStart ? 'Starting the sandbox…' : 'Pre-check has not started'}
          description={
            canStart
              ? 'EchoPort Agent is creating a sandbox on the target.'
              : 'A developer or admin has to start the AI pre-check.'
          }
        />
      </>
    );
  }

  const view = viewPrecheck(precheck.data, source?.name ?? 'source', now);
  const running = !view.ready && !view.stoppedAt;

  return (
    <>
      <PageHeader
        title={`AI pre-check · ${target?.name ?? 'target'}`}
        description={`Sandbox ${view.sandboxId} · started ${clock(view.startedAt)} · EchoPort Agent tests the app on the target before any production change.`}
        actions={
          <>
            {running && (
              <RoleButton
                requires="DEVELOPER"
                variant="outline"
                disabled={stop.isPending}
                onClick={() => stop.mutate(view.id)}
              >
                Stop
              </RoleButton>
            )}
            <RoleButton
              requires="DEVELOPER"
              disabledReason={view.ready ? undefined : 'Decide every verified patch first'}
              onClick={() => navigate(planUrl)}
            >
              Continue to plan
            </RoleButton>
          </>
        }
      />
      <WizardSteps current={1} />

      <div className="flex items-center gap-2">
        <SimulatedBadge />
        <span className="text-small text-fg-muted">
          AI pre-check API is not ready yet. This run is simulated in the browser.
        </span>
      </div>

      {view.stoppedAt && (
        <p role="status" className="rounded-lg bg-subtle px-3 py-2 text-body text-fg-secondary">
          Stopped at {clock(view.stoppedAt)}. Nothing was applied.{' '}
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={() => start.mutate({ serviceId, targetEnvironmentId: targetId })}
          >
            Run again
          </button>
        </p>
      )}

      <div className="flex items-start gap-3 max-wide:flex-col">
        <section className="flex w-72 shrink-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4 max-wide:w-full">
          <h2 className="text-title">Progress</h2>
          <StageList stages={progress(view)} />
        </section>

        <div className="flex min-w-0 flex-1 flex-col gap-3 max-wide:w-full">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="patches">Patches ({view.patches.length})</TabsTrigger>
              <TabsTrigger value="gaps">Feature gaps ({view.featureGaps.length})</TabsTrigger>
              <TabsTrigger value="config">Config diff</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>
            <TabsContent value="patches" className="flex flex-col gap-3">
              {view.patches.length === 0 ? (
                <p className="text-small text-fg-muted">
                  Patches appear after feature gaps are mapped.
                </p>
              ) : (
                view.patches.map((patch) => (
                  <PatchReview
                    key={patch.id}
                    patch={patch}
                    pending={decide.isPending}
                    onDecide={(decision) =>
                      decide.mutate({ precheckId: view.id, patchId: patch.id, decision })
                    }
                  />
                ))
              )}
            </TabsContent>
            <TabsContent value="gaps">
              <div className="overflow-hidden rounded-xl border border-line bg-surface">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{source?.kind.toUpperCase() ?? 'Source'} (source)</TableHead>
                      <TableHead>{target?.kind.toUpperCase() ?? 'Target'} (target)</TableHead>
                      <TableHead>Gap</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.featureGaps.map((gap) => (
                      <TableRow key={gap.source}>
                        <TableCell>{gap.source}</TableCell>
                        <TableCell>{gap.target}</TableCell>
                        <TableCell className="font-mono text-mono">{gap.gap}</TableCell>
                        <TableCell
                          className={cn(
                            gap.action === 'manual' ? 'text-warning-fg' : 'text-fg-secondary',
                          )}
                        >
                          {gap.action}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="config">
              <div className="overflow-hidden rounded-xl border border-line bg-surface">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>{source?.name ?? 'Source'}</TableHead>
                      <TableHead>{target?.name ?? 'Target'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.configDiff.map((change) => (
                      <TableRow key={change.key}>
                        <TableCell className="font-mono text-mono">{change.key}</TableCell>
                        <TableCell className="font-mono text-mono">{change.source}</TableCell>
                        <TableCell className="font-mono text-mono">{change.target}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="logs">
              <ol className="flex flex-col gap-1 rounded-xl border border-line bg-subtle p-4 font-mono text-mono">
                {view.logs.map((line) => (
                  <li key={`${line.at}-${line.message}`} className="flex gap-4">
                    <span className="shrink-0 text-fg-muted">{clock(line.at)}</span>
                    <span
                      className={cn(
                        'w-10 shrink-0',
                        line.level === 'ERROR'
                          ? 'text-danger-fg'
                          : line.level === 'WARN'
                            ? 'text-warning-fg'
                            : 'text-fg-muted',
                      )}
                    >
                      {line.level}
                    </span>
                    <span className="break-all">{line.message}</span>
                  </li>
                ))}
              </ol>
            </TabsContent>
          </Tabs>

          {view.blockedAttempts.map((attempt) => (
            <div
              key={attempt.at}
              role="alert"
              className="flex items-start gap-3 rounded-lg bg-danger-bg p-3 text-danger-fg"
            >
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <p className="text-body-medium">
                  Blocked: agent tried to change production ({attempt.target})
                </p>
                <p className="text-small">
                  <span className="font-mono">{attempt.action}</span> · {attempt.reason} The real
                  check records this in the audit log as actor AI Agent; this one is simulated.
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
