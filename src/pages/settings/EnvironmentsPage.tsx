import { Server } from 'lucide-react';
import { useParams } from 'react-router';
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
import { useEnvironment, useEnvironments } from '@/lib/api/environments';
import { useCurrentOrg } from '@/lib/api/me';
import type { EnvironmentSummary } from '@/lib/api/types';
import { connectionStatusView, providerLabel } from '@/lib/status';
import { cn } from '@/lib/utils';

const SKELETON_ROWS = 5;

const PROVIDER_DOT: Record<string, string> = {
  aws: 'bg-aws',
  gcp: 'bg-gcp',
  onprem: 'bg-onprem',
};

function clusterName(environment: EnvironmentSummary): string | null {
  const value = environment.config?.clusterName ?? environment.config?.kubeContext;
  return typeof value === 'string' ? value : null;
}

/** 목록 응답에는 clusterInfo 가 없어서 행마다 상세를 불러 버전·노드 수를 채운다 */
function ClusterCell({ orgId, environment }: { orgId: string; environment: EnvironmentSummary }) {
  const { data, isPending } = useEnvironment(orgId, environment.id);
  const name = clusterName(environment);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-mono">{name ?? '—'}</span>
      {isPending ? (
        <Skeleton className="h-4 w-28" />
      ) : data?.clusterInfo ? (
        <span className="flex items-center gap-1.5 text-caption text-fg-muted">
          {data.clusterInfo.serverVersion} · {data.clusterInfo.nodeCount}{' '}
          {data.clusterInfo.nodeCount === 1 ? 'node' : 'nodes'}
          {data.clusterInfo.simulated && <SimulatedBadge />}
        </span>
      ) : (
        <span className="text-caption text-fg-muted">
          {data?.clusterInfoError ? `Unavailable (${data.clusterInfoError})` : '—'}
        </span>
      )}
    </div>
  );
}

function EnvironmentRow({
  orgId,
  environment,
}: {
  orgId: string;
  environment: EnvironmentSummary;
}) {
  const status = connectionStatusView(environment.connectionStatus);
  return (
    <TableRow>
      <TableCell className="text-body-medium">{environment.name}</TableCell>
      <TableCell>
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn('size-2 rounded-full', PROVIDER_DOT[environment.kind] ?? 'bg-fg-muted')}
          />
          {providerLabel(environment.kind)}
          <span className="text-fg-muted">· {environment.location ?? '—'}</span>
        </span>
      </TableCell>
      <TableCell>
        <ClusterCell orgId={orgId} environment={environment} />
      </TableCell>
      <TableCell>
        <StatusBadge
          {...status}
          title={environment.connectionError ? `Reason: ${environment.connectionError}` : undefined}
        />
      </TableCell>
    </TableRow>
  );
}

function SkeletonRows() {
  return Array.from({ length: SKELETON_ROWS }, (_, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: 순서가 바뀌지 않는 자리 표시 행이다
    <TableRow key={index}>
      <TableCell>
        <Skeleton className="h-4 w-36" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-40" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-32" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-24" />
      </TableCell>
    </TableRow>
  ));
}

/** SET 환경 탭 */
export default function EnvironmentsPage() {
  const { slug } = useParams();
  const { organization } = useCurrentOrg(slug);
  const orgId = organization?.id;
  const { data, isPending, isError, error, refetch } = useEnvironments(orgId);

  const addButton = (
    <RoleButton requires="DEVELOPER" disabledReason="Coming soon" size="sm">
      Add environment
    </RoleButton>
  );

  return (
    <>
      <PageHeader
        title="Environments"
        description="Clusters your services can run on. Services move between these during evacuation."
        actions={addButton}
      />
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !isPending && data.items.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No environments yet"
          description="Register an AWS, GCP or on-prem cluster to deploy services to it."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Provider · location</TableHead>
                <TableHead>Cluster</TableHead>
                <TableHead>Connection</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending || !orgId ? (
                <SkeletonRows />
              ) : (
                data.items.map((environment) => (
                  <EnvironmentRow key={environment.id} orgId={orgId} environment={environment} />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
