import { type FormEvent, useState } from 'react';
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
import { fieldErrors } from '@/lib/api/form-errors';
import { useUpdateService } from '@/lib/api/services';
import type { ServiceDetail, UpdateService } from '@/lib/api/types';

function initial(service: ServiceDetail) {
  return {
    description: service.description ?? '',
    repoUrl: service.repoUrl,
    healthCheckPath: service.healthCheckPath,
    containerPort: String(service.containerPort),
    healthCheckTimeoutSeconds: String(service.healthCheckTimeoutSeconds),
  };
}

/** 서비스 설정 수정. 이름은 공개 주소에 들어가서 바꿀 수 없다. 바뀐 칸만 보낸다 */
export function EditServiceDialog({
  open,
  onOpenChange,
  orgId,
  service,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  service: ServiceDetail;
}) {
  const update = useUpdateService(orgId, service.id);
  const [form, setForm] = useState(() => initial(service));
  const errors = fieldErrors(update.error);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const before = initial(service);
    const body: UpdateService = {};
    if (form.description.trim() !== before.description) {
      body.description = form.description.trim() || null;
    }
    if (form.repoUrl.trim() !== before.repoUrl) body.repoUrl = form.repoUrl.trim();
    if (form.healthCheckPath.trim() !== before.healthCheckPath) {
      body.healthCheckPath = form.healthCheckPath.trim();
    }
    if (form.containerPort !== before.containerPort)
      body.containerPort = Number(form.containerPort);
    if (form.healthCheckTimeoutSeconds !== before.healthCheckTimeoutSeconds) {
      body.healthCheckTimeoutSeconds = Number(form.healthCheckTimeoutSeconds);
    }
    if (Object.keys(body).length === 0) {
      onOpenChange(false);
      return;
    }
    update.mutate(body, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setForm(initial(service));
        else update.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Edit {service.name}</DialogTitle>
            <DialogDescription>
              Changes apply from the next deploy. The name is part of the public URL and can't
              change.
            </DialogDescription>
          </DialogHeader>

          <FormError message={errors._form} />

          <FormField id="edit-repo" label="GitHub repository" error={errors.repoUrl}>
            <Input
              id="edit-repo"
              value={form.repoUrl}
              onChange={set('repoUrl')}
              aria-invalid={Boolean(errors.repoUrl)}
              required
            />
          </FormField>
          <FormField
            id="edit-description"
            label="Description (optional)"
            error={errors.description}
          >
            <Input id="edit-description" value={form.description} onChange={set('description')} />
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField id="edit-health" label="Health check path" error={errors.healthCheckPath}>
              <Input
                id="edit-health"
                className="font-mono text-mono"
                value={form.healthCheckPath}
                onChange={set('healthCheckPath')}
              />
            </FormField>
            <FormField id="edit-port" label="Container port" error={errors.containerPort}>
              <Input
                id="edit-port"
                type="number"
                min={1}
                max={65535}
                value={form.containerPort}
                onChange={set('containerPort')}
              />
            </FormField>
            <FormField
              id="edit-timeout"
              label="Health timeout (s)"
              error={errors.healthCheckTimeoutSeconds}
            >
              <Input
                id="edit-timeout"
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
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
