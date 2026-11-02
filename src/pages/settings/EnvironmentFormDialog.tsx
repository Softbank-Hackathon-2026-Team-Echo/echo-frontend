import { Cloud, Server } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { FormError, FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCreateEnvironment,
  useEnvironmentKinds,
  useUpdateEnvironment,
} from '@/lib/api/environments';
import { fieldErrors } from '@/lib/api/form-errors';
import type { EnvironmentKind, EnvironmentSummary } from '@/lib/api/types';
import { placeLabel } from '@/lib/geo';
import { providerLabel } from '@/lib/status';
import { cn } from '@/lib/utils';

type PropertySchema = {
  type?: string;
  enum?: unknown[];
  title?: string;
  description?: string;
  examples?: unknown[];
};

type ConfigField = {
  key: string;
  label: string;
  required: boolean;
  options?: string[];
  hint?: string;
};

/** 종류별 configSchema(JSON Schema) → 입력칸 목록. 문자열 enum 은 선택 상자, 나머지는 글 입력 */
export function configFields(kind: EnvironmentKind | undefined): ConfigField[] {
  const schema = kind?.configSchema as
    | { properties?: Record<string, PropertySchema>; required?: string[] }
    | undefined;
  const required = new Set(schema?.required ?? []);
  return Object.entries(schema?.properties ?? {}).map(([key, property]) => ({
    key,
    label: humanizeKey(key),
    required: required.has(key),
    options: property.enum?.filter((value): value is string => typeof value === 'string'),
    hint:
      property.description ??
      (property.examples?.[0] !== undefined ? `e.g. ${String(property.examples[0])}` : undefined),
  }));
}

// 와이어프레임: 프로바이더 카드에 연결 방식을 한 줄로 적는다
const PROVIDER_HINTS: Record<string, string> = {
  aws: 'IAM role',
  gcp: 'Service account',
  onprem: 'K3s agent',
};

function ProviderCards({
  kinds,
  value,
  onChange,
  disabled,
}: {
  kinds: EnvironmentKind[];
  value: string;
  onChange: (kind: string) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="grid grid-cols-3 gap-2">
      <legend className="sr-only">Provider</legend>
      {kinds.map((item) => {
        const selected = item.kind === value;
        const Icon = item.kind === 'onprem' ? Server : Cloud;
        return (
          <label
            key={item.kind}
            className={cn(
              'flex cursor-pointer flex-col items-start gap-1 rounded-lg border p-3 transition-colors has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus',
              selected
                ? 'border-brand bg-brand-subtle ring-1 ring-brand'
                : 'border-line hover:bg-subtle',
            )}
          >
            <input
              type="radio"
              name="environment-provider"
              value={item.kind}
              checked={selected}
              disabled={disabled && !selected}
              onChange={() => onChange(item.kind)}
              className="sr-only"
            />
            <span className="flex items-center gap-2 text-body-medium">
              <Icon aria-hidden className="size-4" />
              {providerLabel(item.kind)}
            </span>
            <span className="text-caption text-fg-muted">
              {PROVIDER_HINTS[item.kind] ?? item.kind}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

function humanizeKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\bid\b/g, 'ID');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** env: 비밀 참조는 조직 열쇠로 시작해야 한다 (echo-was environments.md, `team-echo` → `TEAM_ECHO`) */
export function orgSecretPrefix(slug: string): string {
  return `env:ECHO_SECRET_${slug.replaceAll('-', '_').toUpperCase()}__`;
}

type EnvironmentFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgSlug: string;
  /** 있으면 수정, 없으면 등록 */
  environment?: EnvironmentSummary;
};

export function EnvironmentFormDialog({
  open,
  onOpenChange,
  orgId,
  orgSlug,
  environment,
}: EnvironmentFormDialogProps) {
  const isEdit = Boolean(environment);
  const kinds = useEnvironmentKinds();
  const create = useCreateEnvironment(orgId);
  const update = useUpdateEnvironment(orgId, environment?.id ?? '');
  const mutation = isEdit ? update : create;

  const [name, setName] = useState('');
  const [kind, setKind] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [secretRef, setSecretRef] = useState('');

  // 열 때마다 처음 값으로 되돌린다. mutation 객체는 렌더마다 바뀌어서 의존성에 넣지 않는다
  // biome-ignore lint/correctness/useExhaustiveDependencies: 열림 상태가 바뀔 때만 초기화한다
  useEffect(() => {
    if (!open) return;
    setName(environment?.name ?? '');
    setKind(environment?.kind ?? '');
    setConfig(
      Object.fromEntries(
        Object.entries(environment?.config ?? {}).map(([key, value]) => [key, String(value ?? '')]),
      ),
    );
    setSecretRef(environment?.secretRef ?? orgSecretPrefix(orgSlug));
    create.reset();
    update.reset();
  }, [open, environment, orgSlug]);

  const selectedKind = kinds.data?.find((item) => item.kind === kind);
  const fields = useMemo(() => configFields(selectedKind), [selectedKind]);
  const errors = fieldErrors(mutation.error);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const configBody = Object.fromEntries(
      fields.map((field) => [field.key, config[field.key]?.trim() ?? '']),
    );
    const onSuccess = () => onOpenChange(false);
    if (isEdit) {
      update.mutate(
        { name: name.trim(), config: configBody, secretRef: secretRef.trim() },
        { onSuccess },
      );
    } else {
      create.mutate(
        { name: name.trim(), kind, config: configBody, secretRef: secretRef.trim() },
        { onSuccess },
      );
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <SheetHeader className="p-0">
            <SheetTitle>{isEdit ? `Edit ${environment?.name}` : 'Add environment'}</SheetTitle>
            <SheetDescription>
              Each environment is one cloud region or one on-prem site. Any registered environment
              can become an evacuation target.
            </SheetDescription>
          </SheetHeader>

          <FormError message={errors._form} />

          {kinds.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <ProviderCards
              kinds={kinds.data ?? []}
              value={kind}
              onChange={setKind}
              disabled={isEdit}
            />
          )}
          {errors.kind && <p className="text-small text-danger-fg">{errors.kind}</p>}

          <FormField
            id="env-name"
            label="Name"
            hint="Lowercase letters, numbers and -"
            error={errors.name}
          >
            <Input
              id="env-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="aws-tokyo-prod"
              aria-invalid={Boolean(errors.name)}
              required
            />
          </FormField>

          {fields.map((field) => {
            const id = `env-config-${field.key}`;
            const error = errors[`config.${field.key}`] ?? errors[field.key];
            const value = config[field.key] ?? '';
            const setValue = (next: string) =>
              setConfig((prev) => ({ ...prev, [field.key]: next }));
            return (
              <FormField
                key={field.key}
                id={id}
                label={field.label}
                hint={field.hint}
                error={error}
              >
                {field.options ? (
                  <Select value={value} onValueChange={setValue}>
                    <SelectTrigger id={id} className="w-full" aria-invalid={Boolean(error)}>
                      <SelectValue placeholder={`Choose ${field.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((option) => {
                        const place = placeLabel({ location: option });
                        return (
                          <SelectItem key={option} value={option}>
                            {place && place !== option ? (
                              <>
                                {place}{' '}
                                <span className="font-mono text-mono text-fg-muted">{option}</span>
                              </>
                            ) : (
                              option
                            )}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={id}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    aria-invalid={Boolean(error)}
                    required={field.required}
                  />
                )}
              </FormField>
            );
          })}

          {kind && (
            <FormField
              id="env-secret-ref"
              label="Secret reference"
              hint={`Where the kubeconfig is stored. EchoPort keeps only this reference, never the secret itself. env: names start with ${orgSecretPrefix(orgSlug)}`}
              error={errors.secretRef}
            >
              <Input
                id="env-secret-ref"
                className="font-mono text-mono"
                value={secretRef}
                onChange={(event) => setSecretRef(event.target.value)}
                aria-invalid={Boolean(errors.secretRef)}
                required
              />
            </FormField>
          )}

          <SheetFooter className="flex-row justify-end p-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!kind || mutation.isPending}>
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save' : 'Add environment'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
