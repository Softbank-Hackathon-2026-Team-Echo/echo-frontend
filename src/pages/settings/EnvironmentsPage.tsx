import { MoreHorizontal, Pencil, RefreshCw, Server, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { ProviderLabel } from '@/components/ProviderLabel';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useRole } from '@/hooks/useRole';
import {
  useCheckConnection,
  useDeleteEnvironment,
  useEnvironment,
  useEnvironments,
} from '@/lib/api/environments';
import { useCurrentOrg } from '@/lib/api/me';
import type { EnvironmentSummary } from '@/lib/api/types';
import { hasRole } from '@/lib/roles';
import { connectionErrorLabel, connectionStatusView } from '@/lib/status';
import { EnvironmentFormDialog } from './EnvironmentFormDialog';
import { SettingsTabs } from './SettingsTabs';

const SKELETON_ROWS = 5;

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
          {connectionErrorLabel(data?.clusterInfoError) ?? '—'}
        </span>
      )}
    </div>
  );
}

type RowActionsProps = {
  environment: EnvironmentSummary;
  onEdit: () => void;
  onDelete: () => void;
  onCheck: () => void;
  checking: boolean;
};

/** 행 메뉴. 권한이 없는 항목은 숨기지 않고 비활성 + 필요한 역할을 적는다 */
function RowActions({ environment, onEdit, onDelete, onCheck, checking }: RowActionsProps) {
  const role = useRole();
  const canWrite = hasRole(role, 'DEVELOPER');
  const canDelete = hasRole(role, 'ADMIN');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${environment.name}`}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem disabled={!canWrite || checking} onSelect={onCheck}>
          <RefreshCw aria-hidden />
          <span className="flex-1">Check connection</span>
          {!canWrite && <span className="text-caption text-fg-muted">Developer</span>}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canWrite} onSelect={onEdit}>
          <Pencil aria-hidden />
          <span className="flex-1">Edit</span>
          {!canWrite && <span className="text-caption text-fg-muted">Developer</span>}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={!canDelete} onSelect={onDelete}>
          <Trash2 aria-hidden />
          <span className="flex-1">Delete</span>
          {!canDelete && <span className="text-caption text-fg-muted">Admin</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EnvironmentRow({
  orgId,
  environment,
  actions,
}: {
  orgId: string;
  environment: EnvironmentSummary;
  actions: React.ReactNode;
}) {
  const status = connectionStatusView(environment.connectionStatus);
  return (
    <TableRow>
      <TableCell className="text-body-medium">{environment.name}</TableCell>
      <TableCell>
        <ProviderLabel kind={environment.kind} location={environment.location} />
      </TableCell>
      <TableCell>
        <ClusterCell orgId={orgId} environment={environment} />
      </TableCell>
      <TableCell>
        <span className="flex flex-col items-start gap-1">
          <StatusBadge {...status} />
          {environment.connectionError && (
            <span className="text-caption text-danger-fg">
              {connectionErrorLabel(environment.connectionError)}
            </span>
          )}
        </span>
      </TableCell>
      <TableCell className="w-10 text-right">{actions}</TableCell>
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
      <TableCell />
    </TableRow>
  ));
}

/** SET 환경 탭 */
export default function EnvironmentsPage() {
  const { slug } = useParams();
  const { organization } = useCurrentOrg(slug);
  const orgId = organization?.id;
  const { data, isPending, isError, error, refetch } = useEnvironments(orgId);
  const checkConnection = useCheckConnection(orgId ?? '');
  const deleteEnvironment = useDeleteEnvironment(orgId ?? '');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EnvironmentSummary | undefined>();
  const [deleting, setDeleting] = useState<EnvironmentSummary | undefined>();

  const addButton = (
    <RoleButton
      requires="DEVELOPER"
      size="sm"
      onClick={() => {
        setEditing(undefined);
        setFormOpen(true);
      }}
    >
      Add environment
    </RoleButton>
  );

  return (
    <>
      <PageHeader
        title="Environments"
        description="Each environment = one cloud region or one on-prem site. Whether it serves or stands by is decided per service."
        actions={addButton}
      />
      <SettingsTabs />
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !isPending && data.items.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No environments yet"
          description="Register an AWS, GCP or on-prem cluster to deploy services to it."
          action={addButton}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Environment</TableHead>
                <TableHead>Provider · region</TableHead>
                <TableHead>Cluster (simulated)</TableHead>
                <TableHead>Connection</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending || !orgId ? (
                <SkeletonRows />
              ) : (
                data.items.map((environment) => (
                  <EnvironmentRow
                    key={environment.id}
                    orgId={orgId}
                    environment={environment}
                    actions={
                      <RowActions
                        environment={environment}
                        checking={
                          checkConnection.isPending && checkConnection.variables === environment.id
                        }
                        onCheck={() => checkConnection.mutate(environment.id)}
                        onEdit={() => {
                          setEditing(environment);
                          setFormOpen(true);
                        }}
                        onDelete={() => setDeleting(environment)}
                      />
                    }
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {organization && (
        <EnvironmentFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          orgId={organization.id}
          orgSlug={organization.slug}
          environment={editing}
        />
      )}
      {deleting && (
        <ConfirmDeleteDialog
          open
          onOpenChange={(open) => !open && setDeleting(undefined)}
          name={deleting.name}
          title={`Delete ${deleting.name}?`}
          description="Environments with services on them cannot be deleted. Move or delete those services first."
          pending={deleteEnvironment.isPending}
          onConfirm={() =>
            deleteEnvironment.mutate(deleting.id, { onSuccess: () => setDeleting(undefined) })
          }
        />
      )}
    </>
  );
}
