import {
  ChevronRight,
  ClipboardPaste,
  KeyRound,
  MoreHorizontal,
  Plus,
  TriangleAlert,
} from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { FormError } from '@/components/FormField';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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
import { useEnvironments } from '@/lib/api/environments';
import type { ServiceDetail, ServiceVariable } from '@/lib/api/types';
import {
  MAX_VARIABLES,
  missingKeys,
  useDeleteVariable,
  useSaveVariables,
  useVariableMatrix,
  type VariableColumn,
  variableKeyProblem,
} from '@/lib/api/variables';
import { t } from '@/lib/i18n';
import { hasRole } from '@/lib/roles';
import { EnvironmentChecks } from './EnvironmentChecks';
import { PasteEnvDialog } from './PasteEnvDialog';
import { VariableDialog } from './VariableDialog';

type CellTarget = { key: string; environmentId: string; environmentName: string; isNew: boolean };
type DeleteTarget = { key: string; environmentId: string; environmentName: string };

function storeLabel(secretRef: string) {
  if (secretRef.startsWith('gcp-sm:')) return 'GCP Secret Manager';
  if (secretRef.startsWith('fake-sm:')) return t('Test store');
  return secretRef.split(':')[0] ?? secretRef;
}

function keyProblemText(key: string) {
  const problem = key ? variableKeyProblem(key) : null;
  if (problem === 'reserved') return t('PORT and names starting with ECHO_ are reserved.');
  if (problem === 'invalid')
    return t('Use capital letters, numbers and _, starting with a letter.');
  return undefined;
}

/** 목록 위 한 줄에서 키 하나를 넣는다. 다이얼로그 없이 이어서 넣을 수 있다 */
function NewVariableRow({
  orgId,
  serviceId,
  columns,
  onClose,
}: {
  orgId: string;
  serviceId: string;
  columns: VariableColumn[];
  onClose: () => void;
}) {
  const save = useSaveVariables(orgId, serviceId);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [picked, setPicked] = useState(columns.map((column) => column.link.environment.id));
  const keyError = keyProblemText(key);
  const failure = save.data?.[0]?.message;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (keyError || !key || !value || picked.length === 0) return;
    save.mutate(
      picked.map((environmentId) => ({ key, value, environmentId })),
      {
        onSuccess: (failures) => {
          if (failures.length > 0) return;
          setKey('');
          setValue('');
          save.reset();
        },
      },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      autoComplete="off"
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={t('Key')}
          className="min-w-48 flex-1 font-mono"
          value={key}
          maxLength={64}
          placeholder="DATABASE_URL"
          spellCheck={false}
          aria-invalid={Boolean(keyError)}
          onChange={(event) => setKey(event.target.value)}
          autoFocus
        />
        <Input
          aria-label={t('Value')}
          className="min-w-48 flex-1 font-mono [-webkit-text-security:disc]"
          value={value}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button type="submit" size="sm" disabled={save.isPending || !key || !value}>
          {t('Add')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t('Done')}
        </Button>
      </div>
      {columns.length > 1 && (
        <EnvironmentChecks
          columns={columns}
          picked={picked}
          onChange={setPicked}
          label={t('Add to')}
        />
      )}
      <FormError message={keyError ?? failure} />
    </form>
  );
}

function VariableCell({
  variable,
  variableKey,
  column,
  servingHasKey,
  canWrite,
  canDelete,
  disabledReason,
  onWrite,
  onDelete,
}: {
  variable: ServiceVariable | undefined;
  variableKey: string;
  column: VariableColumn;
  servingHasKey: boolean;
  canWrite: boolean;
  canDelete: boolean;
  disabledReason?: string;
  onWrite: (isNew: boolean) => void;
  onDelete: () => void;
}) {
  const { environment } = column.link;
  if (!variable) {
    return (
      <span className="flex items-center gap-2">
        {servingHasKey ? (
          <StatusBadge label={t('Missing')} tone="warning" />
        ) : (
          <span className="text-fg-muted">—</span>
        )}
        <RoleButton
          requires="DEVELOPER"
          variant="ghost"
          size="sm"
          aria-label={t('Add {{key}} to {{name}}', { key: variableKey, name: environment.name })}
          disabledReason={disabledReason}
          onClick={() => onWrite(true)}
        >
          {t('Add')}
        </RoleButton>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className="font-mono text-mono" title={storeLabel(variable.secretRef)}>
        v{variable.version}
      </span>
      {variable.pendingRedeploy ? (
        <StatusBadge label={t('Redeploy to apply')} tone="warning" />
      ) : (
        <StatusBadge label={t('Applied')} tone="success" />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={t('Actions for {{key}} on {{name}}', {
              key: variableKey,
              name: environment.name,
            })}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={!canWrite || Boolean(disabledReason)}
            onSelect={() => onWrite(false)}
          >
            {t('Replace value')}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={!canDelete || Boolean(disabledReason)}
            onSelect={onDelete}
          >
            {t('Delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

function VariableTable({
  columns,
  disabledReason,
  onWrite,
  onDelete,
}: {
  columns: VariableColumn[];
  disabledReason?: string;
  onWrite: (target: CellTarget) => void;
  onDelete: (target: DeleteTarget) => void;
}) {
  const role = useRole();
  const keys = [
    ...new Set(columns.flatMap((column) => column.items.map((item) => item.key))),
  ].sort();
  const serving = columns.find((column) => column.link.role === 'SERVING');
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Key')}</TableHead>
            {columns.map((column) => (
              <TableHead key={column.link.serviceEnvironmentId}>
                {column.link.environment.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map((key) => (
            <TableRow key={key}>
              <TableCell className="font-mono text-mono">{key}</TableCell>
              {columns.map((column) => {
                const { id, name } = column.link.environment;
                return (
                  <TableCell key={column.link.serviceEnvironmentId}>
                    <VariableCell
                      variable={column.items.find((item) => item.key === key)}
                      variableKey={key}
                      column={column}
                      servingHasKey={Boolean(serving?.items.some((item) => item.key === key))}
                      canWrite={hasRole(role, 'DEVELOPER')}
                      canDelete={hasRole(role, 'ADMIN')}
                      disabledReason={disabledReason}
                      onWrite={(isNew) =>
                        onWrite({ key, environmentId: id, environmentName: name, isNew })
                      }
                      onDelete={() => onDelete({ key, environmentId: id, environmentName: name })}
                    />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DeleteVariableDialog({
  orgId,
  serviceId,
  target,
  onClose,
}: {
  orgId: string;
  serviceId: string;
  target: DeleteTarget;
  onClose: () => void;
}) {
  const remove = useDeleteVariable({ orgId, serviceId, environmentId: target.environmentId });
  return (
    <ConfirmDeleteDialog
      open
      onOpenChange={(open) => !open && onClose()}
      name={target.key}
      title={t('Delete {{name}}?', { name: target.key })}
      description={t('The running app keeps this value until the next deploy to this environment.')}
      pending={remove.isPending}
      onConfirm={() => remove.mutate(target.key, { onSuccess: onClose })}
    />
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
  onDeploy: (environmentId?: string) => void;
}) {
  const matrix = useVariableMatrix(orgId, service);
  const environments = useEnvironments(orgId);
  const [adding, setAdding] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [writing, setWriting] = useState<CellTarget>();
  const [deleting, setDeleting] = useState<DeleteTarget>();
  const { columns } = matrix;

  if (columns.length === 0) {
    return (
      <EmptyState
        icon={KeyRound}
        title={t('Deploy first')}
        description={t('Variables belong to an environment, so deploy to it once to add them.')}
        action={
          <RoleButton
            requires="DEVELOPER"
            disabledReason={disabledReason}
            onClick={() => onDeploy()}
          >
            {t('Deploy')}
          </RoleButton>
        }
      />
    );
  }
  if (matrix.error)
    return <ErrorState error={matrix.error} onRetry={() => void matrix.refetch()} />;
  if (matrix.isPending) return <Skeleton className="h-32 w-full" />;

  const connected = new Set(columns.map((column) => column.link.environment.id));
  const notConnected = (environments.data?.items ?? []).filter((item) => !connected.has(item.id));
  const gaps = columns.flatMap((column) => {
    const missing = missingKeys(columns, column.link.environment.id);
    return missing.length > 0 ? [{ name: column.link.environment.name, missing }] : [];
  });
  const empty = columns.every((column) => column.items.length === 0);
  const full = columns.every((column) => column.items.length >= MAX_VARIABLES);
  const addReason =
    disabledReason ??
    (full ? t('{{max}} variables is the limit', { max: MAX_VARIABLES }) : undefined);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-small text-fg-secondary">
          {t('Values stay in the secret store. Only names and versions show here.')}
          {matrix.simulated && <SimulatedBadge />}
        </p>
        <span className="flex items-center gap-2">
          <RoleButton
            requires="DEVELOPER"
            variant="outline"
            size="sm"
            disabledReason={addReason}
            onClick={() => setPasting(true)}
          >
            <ClipboardPaste aria-hidden />
            {t('Paste .env')}
          </RoleButton>
          <RoleButton
            requires="DEVELOPER"
            size="sm"
            disabledReason={addReason}
            onClick={() => setAdding(true)}
          >
            <Plus aria-hidden />
            {t('New variable')}
          </RoleButton>
        </span>
      </div>

      {adding && (
        <NewVariableRow
          orgId={orgId}
          serviceId={service.id}
          columns={columns}
          onClose={() => setAdding(false)}
        />
      )}

      {gaps.map(({ name, missing }) => (
        <p
          key={name}
          role="status"
          className="flex items-start gap-2 rounded-md bg-warning-bg px-3 py-2 text-body text-warning-fg"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('{{name}} is missing {{keys}}. Migration there is blocked until they are added.', {
            name,
            keys: missing.join(', '),
          })}
        </p>
      ))}

      {empty ? (
        <EmptyState
          icon={KeyRound}
          title={t('No variables yet')}
          description={t(
            'Paste your .env to add everything at once, for one or more environments.',
          )}
          action={
            <RoleButton
              requires="DEVELOPER"
              disabledReason={addReason}
              onClick={() => setPasting(true)}
            >
              {t('Paste .env')}
            </RoleButton>
          }
        />
      ) : (
        <VariableTable
          columns={columns}
          disabledReason={disabledReason}
          onWrite={setWriting}
          onDelete={setDeleting}
        />
      )}

      {notConnected.map((environment) => (
        <p
          key={environment.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-subtle px-3 py-2 text-small text-fg-secondary"
        >
          {t('{{name}} has no variables yet because this service was never deployed there.', {
            name: environment.name,
          })}
          <RoleButton
            requires="DEVELOPER"
            variant="outline"
            size="sm"
            disabledReason={disabledReason}
            onClick={() => onDeploy(environment.id)}
          >
            {t('Deploy to {{name}}', { name: environment.name })}
          </RoleButton>
        </p>
      ))}

      <details className="group rounded-md text-small text-fg-secondary">
        <summary className="flex cursor-pointer list-none items-center gap-1">
          <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" />
          {t('Variables set by EchoPort')}
        </summary>
        <p className="px-5 pt-1">
          {t(
            'EchoPort sets PORT and names starting with ECHO_ for every deploy, so you cannot set them here.',
          )}
        </p>
      </details>

      {pasting && (
        <PasteEnvDialog
          orgId={orgId}
          serviceId={service.id}
          columns={columns}
          onClose={() => setPasting(false)}
        />
      )}
      <VariableDialog
        open={writing !== undefined}
        onOpenChange={() => setWriting(undefined)}
        orgId={orgId}
        serviceId={service.id}
        environmentId={writing?.environmentId ?? ''}
        environmentName={writing?.environmentName ?? ''}
        fixedKey={writing?.key}
        isNew={writing?.isNew}
      />
      {deleting && (
        <DeleteVariableDialog
          orgId={orgId}
          serviceId={service.id}
          target={deleting}
          onClose={() => setDeleting(undefined)}
        />
      )}
    </div>
  );
}
