import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { FormError, FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { isApiError } from '@/lib/api/errors';
import { fieldErrors } from '@/lib/api/form-errors';
import { useCreateService } from '@/lib/api/services';

const DEFAULTS = {
  healthCheckPath: '/healthz',
  containerPort: '8080',
  healthCheckTimeoutSeconds: '300',
};

/** 비공개 저장소에 GitHub App 이 없으면 서버가 설치 주소를 details 에 실어 준다 */
function installUrl(error: unknown): string | undefined {
  if (!isApiError(error) || error.code !== 'REPO_NOT_ACCESSIBLE') return undefined;
  return error.details.find((detail) => detail.field === 'installUrl')?.value ?? undefined;
}

export function RegisterServiceDialog({
  open,
  onOpenChange,
  orgId,
  orgSlug,
  onRegistered,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgSlug: string;
  /** 있으면 서비스 목록으로 가지 않고 이것을 부른다(온보딩) */
  onRegistered?: (service: { id: string; name: string }) => void;
}) {
  const navigate = useNavigate();
  const create = useCreateService(orgId);
  const [form, setForm] = useState({ name: '', repoUrl: '', description: '', ...DEFAULTS });
  const errors = fieldErrors(create.error);
  const install = installUrl(create.error);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      {
        name: form.name.trim(),
        repoUrl: form.repoUrl.trim(),
        description: form.description.trim() || null,
        healthCheckPath: form.healthCheckPath.trim(),
        containerPort: Number(form.containerPort),
        healthCheckTimeoutSeconds: Number(form.healthCheckTimeoutSeconds),
      },
      {
        onSuccess: (service) => {
          onOpenChange(false);
          if (onRegistered) onRegistered(service);
          else navigate(`/o/${orgSlug}/services?service=${service.id}`);
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) create.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Register service</DialogTitle>
            <DialogDescription>
              Connect a GitHub repository. You choose where to deploy it on the next step.
            </DialogDescription>
          </DialogHeader>

          {install ? (
            <p
              role="alert"
              className="rounded-md bg-warning-bg px-3 py-2 text-body text-warning-fg"
            >
              We can't reach this repository. If it is private, install the EchoPort GitHub App on
              it first:{' '}
              <a href={install} target="_blank" rel="noreferrer" className="underline">
                Install GitHub App
              </a>
            </p>
          ) : (
            <FormError message={errors._form} />
          )}

          <FormField
            id="svc-name"
            label="Name"
            hint="Lowercase letters, numbers and -. It becomes part of the public URL and can't change."
            error={errors.name}
          >
            <Input
              id="svc-name"
              value={form.name}
              onChange={set('name')}
              placeholder="shop-api"
              aria-invalid={Boolean(errors.name)}
              required
            />
          </FormField>
          <FormField id="svc-repo" label="GitHub repository" error={errors.repoUrl}>
            <Input
              id="svc-repo"
              value={form.repoUrl}
              onChange={set('repoUrl')}
              placeholder="https://github.com/team-echo/shop-api"
              aria-invalid={Boolean(errors.repoUrl)}
              required
            />
          </FormField>
          <FormField id="svc-description" label="Description (optional)" error={errors.description}>
            <Input id="svc-description" value={form.description} onChange={set('description')} />
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField id="svc-health" label="Health check path" error={errors.healthCheckPath}>
              <Input
                id="svc-health"
                className="font-mono text-mono"
                value={form.healthCheckPath}
                onChange={set('healthCheckPath')}
              />
            </FormField>
            <FormField id="svc-port" label="Container port" error={errors.containerPort}>
              <Input
                id="svc-port"
                type="number"
                min={1}
                max={65535}
                value={form.containerPort}
                onChange={set('containerPort')}
              />
            </FormField>
            <FormField
              id="svc-timeout"
              label="Health timeout (s)"
              error={errors.healthCheckTimeoutSeconds}
            >
              <Input
                id="svc-timeout"
                type="number"
                min={10}
                max={1800}
                value={form.healthCheckTimeoutSeconds}
                onChange={set('healthCheckTimeoutSeconds')}
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Checking repository…' : 'Register service'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
