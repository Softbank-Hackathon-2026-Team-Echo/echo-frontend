import { KeyRound, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ServiceDetail } from '@/lib/api/types';
import { MAX_VARIABLES, useDeleteVariable, useServiceVariables } from '@/lib/api/variables';
import { timeAgo } from '@/lib/format';
import { t } from '@/lib/i18n';
import { VariableDialog } from './VariableDialog';

function storeLabel(secretRef: string) {
  if (secretRef.startsWith('gcp-sm:')) return 'GCP Secret Manager';
  if (secretRef.startsWith('fake-sm:')) return t('Test store');
  return secretRef.split(':')[0] ?? secretRef;
}

function EnvironmentVariables({
  orgId,
  serviceId,
  environmentId,
  environmentName,
  disabledReason,
  onDeploy,
}: {
  orgId: string;
  serviceId: string;
  environmentId: string;
  environmentName: string;
  disabledReason?: string;
  onDeploy: () => void;
}) {
  const target = { orgId, serviceId, environmentId };
  const variables = useServiceVariables(target);
  const remove = useDeleteVariable(target);
  const [adding, setAdding] = useState(false);
  const [replacing, setReplacing] = useState<string>();
  const [deleting, setDeleting] = useState<string>();

  if (variables.isError)
    return <ErrorState error={variables.error} onRetry={() => variables.refetch()} />;
  if (variables.isPending) return <Skeleton className="h-32 w-full" />;

  const { items, simulated } = variables.data;
  const pending = items.filter((item) => item.pendingRedeploy).length;
  const full = items.length >= MAX_VARIABLES;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-small text-fg-secondary">
          {t('Values stay in the secret store. Only names and versions show here.')}
          {simulated && <SimulatedBadge />}
        </p>
        <RoleButton
          requires="DEVELOPER"
          variant="outline"
          size="sm"
          disabledReason={
            disabledReason ??
            (full ? t('{{max}} variables is the limit', { max: MAX_VARIABLES }) : undefined)
          }
          onClick={() => setAdding(true)}
        >
          {t('Add variable')}
        </RoleButton>
      </div>

      {pending > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-warning-bg px-3 py-2 text-body text-warning-fg"
        >
          {pending === 1
            ? t('1 variable applies on the next deploy to {{name}}.', { name: environmentName })
            : t('{{n}} variables apply on the next deploy to {{name}}.', {
                n: pending,
                name: environmentName,
              })}
          <RoleButton
            requires="DEVELOPER"
            size="sm"
            disabledReason={disabledReason}
            onClick={onDeploy}
          >
            {t('Deploy')}
          </RoleButton>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title={t('No variables yet')}
          description={t('Add keys like DATABASE_URL for this environment.')}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Key')}</TableHead>
                <TableHead>{t('Stored in')}</TableHead>
                <TableHead>{t('Version')}</TableHead>
                <TableHead>{t('Updated')}</TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">{t('Actions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.key}>
                  <TableCell className="font-mono text-mono">{item.key}</TableCell>
                  <TableCell className="text-fg-secondary" title={item.secretRef}>
                    {storeLabel(item.secretRef)}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono text-mono">v{item.version}</span>
                      {item.pendingRedeploy ? (
                        <StatusBadge label={t('Redeploy to apply')} tone="warning" />
                      ) : (
                        <StatusBadge label={t('Applied')} tone="success" />
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-fg-secondary">
                    {item.updatedBy?.githubLogin ?? '—'} · {timeAgo(item.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center justify-end gap-1">
                      <RoleButton
                        requires="DEVELOPER"
                        variant="ghost"
                        size="sm"
                        disabledReason={disabledReason}
                        onClick={() => setReplacing(item.key)}
                      >
                        {t('Replace value')}
                      </RoleButton>
                      <RoleButton
                        requires="ADMIN"
                        variant="ghost"
                        size="sm"
                        aria-label={t('Delete {{name}}', { name: item.key })}
                        disabledReason={disabledReason}
                        onClick={() => setDeleting(item.key)}
                      >
                        <Trash2 aria-hidden />
                      </RoleButton>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <VariableDialog
        open={adding || replacing !== undefined}
        onOpenChange={() => {
          setAdding(false);
          setReplacing(undefined);
        }}
        orgId={orgId}
        serviceId={serviceId}
        environmentId={environmentId}
        environmentName={environmentName}
        fixedKey={replacing}
      />
      <ConfirmDeleteDialog
        open={deleting !== undefined}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        name={deleting ?? ''}
        title={t('Delete {{name}}?', { name: deleting ?? '' })}
        description={t(
          'The running app keeps this value until the next deploy to this environment.',
        )}
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting, {
            onSuccess: () => setDeleting(undefined),
          })
        }
      />
    </>
  );
}

/** 서비스 × 환경의 앱 환경 변수. 연결은 그 환경의 첫 배포 때 생긴다 */
export function ServiceVariables({
  orgId,
  service,
  disabledReason,
  onDeploy,
}: {
  orgId: string;
  service: ServiceDetail;
  disabledReason?: string;
  onDeploy: () => void;
}) {
  const [picked, setPicked] = useState<string>();
  const links = service.environments;
  const current = links.find((link) => link.environment.id === picked) ?? links[0];

  if (!current) {
    return (
      <EmptyState
        icon={KeyRound}
        title={t('Deploy first')}
        description={t('Variables belong to an environment, so deploy to it once to add them.')}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Tabs value={current.environment.id} onValueChange={setPicked}>
        <TabsList>
          {links.map((link) => (
            <TabsTrigger key={link.serviceEnvironmentId} value={link.environment.id}>
              {link.environment.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <EnvironmentVariables
        key={current.environment.id}
        orgId={orgId}
        serviceId={service.id}
        environmentId={current.environment.id}
        environmentName={current.environment.name}
        disabledReason={disabledReason}
        onDeploy={onDeploy}
      />
    </div>
  );
}
