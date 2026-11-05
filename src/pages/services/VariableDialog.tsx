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
import { Textarea } from '@/components/ui/textarea';
import { fieldErrors } from '@/lib/api/form-errors';
import { useSaveVariable, variableKeyProblem } from '@/lib/api/variables';
import { t } from '@/lib/i18n';

type VariableDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  serviceId: string;
  environmentId: string;
  environmentName: string;
  /** 있으면 그 키의 값을 바꾼다. 없으면 새 키를 넣는다 */
  fixedKey?: string;
};

function keyProblemText(key: string) {
  const problem = key ? variableKeyProblem(key) : null;
  if (problem === 'reserved') return t('PORT and names starting with ECHO_ are reserved.');
  if (problem === 'invalid')
    return t('Use capital letters, numbers and _, starting with a letter.');
  return undefined;
}

/** 값은 이 칸에만 잠깐 있고 닫으면 버린다. 서버도 다시 돌려주지 않는다 */
export function VariableDialog({
  open,
  onOpenChange,
  orgId,
  serviceId,
  environmentId,
  environmentName,
  fixedKey,
}: VariableDialogProps) {
  const save = useSaveVariable({ orgId, serviceId, environmentId });
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const errors = fieldErrors(save.error);
  const currentKey = fixedKey ?? key;
  const keyError = keyProblemText(currentKey) ?? errors.key;

  function close() {
    setKey('');
    setValue('');
    // 뮤테이션 상태에도 값이 남으므로 같이 지운다
    save.reset();
    onOpenChange(false);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (variableKeyProblem(currentKey)) return;
    save.mutate({ key: currentKey, value }, { onSuccess: close });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {fixedKey
                ? t('Replace {{key}}', { key: fixedKey })
                : t('Add variable to {{name}}', { name: environmentName })}
            </DialogTitle>
            <DialogDescription>
              {t(
                'The value goes to the secret store and is never shown again. The app gets it on the next deploy.',
              )}
            </DialogDescription>
          </DialogHeader>

          <FormError message={errors._form} />

          {!fixedKey && (
            <FormField id="variable-key" label={t('Key')} error={keyError}>
              <Input
                id="variable-key"
                className="font-mono"
                value={key}
                maxLength={64}
                onChange={(event) => setKey(event.target.value)}
                aria-invalid={Boolean(keyError)}
                placeholder="DATABASE_URL"
                spellCheck={false}
                required
              />
            </FormField>
          )}
          <FormField id="variable-value" label={t('New value')} error={errors.value}>
            <Textarea
              id="variable-value"
              className="font-mono [-webkit-text-security:disc]"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              aria-invalid={Boolean(errors.value)}
              autoComplete="off"
              spellCheck={false}
              required
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              {t('Cancel')}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {t('Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
