import { useState } from 'react';
import { FormError } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  MAX_VARIABLES,
  useSaveVariables,
  type VariableColumn,
  type VariableWrite,
} from '@/lib/api/variables';
import { type EnvProblem, parseEnvFile } from '@/lib/env-file';
import { t } from '@/lib/i18n';
import { EnvironmentChecks } from './EnvironmentChecks';

function problemText(problem: EnvProblem) {
  if (problem.reason === 'reserved')
    return t('Line {{line}}: {{key}} is reserved.', { line: problem.line, key: problem.key ?? '' });
  if (problem.reason === 'invalid')
    return t('Line {{line}}: {{key}} is not a valid name.', {
      line: problem.line,
      key: problem.key ?? '',
    });
  return t('Line {{line}}: use KEY=value.', { line: problem.line });
}

/** .env 를 붙여 넣어 여러 환경에 한 번에 넣는다. 값은 이 state 에만 있고 닫으면 지운다 */
export function PasteEnvDialog({
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
  const [text, setText] = useState('');
  const [picked, setPicked] = useState(columns.map((column) => column.link.environment.id));
  const [retry, setRetry] = useState<VariableWrite[]>([]);
  const { entries, problems } = parseEnvFile(text);
  const names = new Map(columns.map(({ link }) => [link.environment.id, link.environment.name]));
  const targets = columns.filter((column) => picked.includes(column.link.environment.id));
  const overLimit = targets.find((column) => {
    const keys = new Set([...column.items.map((item) => item.key), ...entries.map((e) => e.key)]);
    return keys.size > MAX_VARIABLES;
  });
  const failures = save.data ?? [];

  function close() {
    setText('');
    setRetry([]);
    save.reset();
    onClose();
  }

  function submit(writes: VariableWrite[]) {
    save.mutate(writes, {
      onSuccess: (failed) => {
        if (failed.length === 0) close();
        else
          setRetry(failed.map(({ key, value, environmentId }) => ({ key, value, environmentId })));
      },
    });
  }

  function handleSave() {
    submit(
      targets.flatMap(({ link }) =>
        entries.map((entry) => ({ ...entry, environmentId: link.environment.id })),
      ),
    );
  }

  return (
    <Dialog open onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('Paste .env')}</DialogTitle>
          <DialogDescription>
            {t(
              'Values go to the secret store and are never shown again. Keys that already exist get a new version.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Textarea
            aria-label={t('.env contents')}
            className="h-40 font-mono [-webkit-text-security:disc]"
            value={text}
            autoComplete="off"
            spellCheck={false}
            placeholder={'DATABASE_URL=postgres://…\nAPI_KEY=…'}
            onChange={(event) => setText(event.target.value)}
          />
          {columns.length > 1 && (
            <EnvironmentChecks
              columns={columns}
              picked={picked}
              onChange={setPicked}
              label={t('Add to')}
            />
          )}
          {entries.length > 0 && (
            <ul
              aria-label={t('Keys found')}
              className="flex max-h-40 flex-col gap-1 overflow-y-auto"
            >
              {entries.map(({ key }) => {
                const exists = targets.some((column) =>
                  column.items.some((item) => item.key === key),
                );
                return (
                  <li key={key} className="flex items-center justify-between gap-2 text-small">
                    <span className="font-mono text-mono">{key}</span>
                    <span className="text-fg-muted">
                      {exists ? t('New version') : t('New key')}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {problems.length > 0 && (
            <ul className="flex flex-col gap-0.5 text-small text-warning-fg">
              {problems.map((problem) => (
                <li key={problem.line}>{problemText(problem)}</li>
              ))}
            </ul>
          )}
          {overLimit && (
            <FormError
              message={t('{{name}} would go over the limit of {{max}} variables.', {
                name: overLimit.link.environment.name,
                max: MAX_VARIABLES,
              })}
            />
          )}
          {failures.length > 0 && (
            <div role="alert" className="flex flex-col gap-0.5 text-small text-danger-fg">
              <p>{t("These weren't saved:")}</p>
              {failures.map((failure) => (
                <p key={`${failure.environmentId}-${failure.key}`}>
                  <span className="font-mono text-mono">{failure.key}</span> ·{' '}
                  {names.get(failure.environmentId)} · {failure.message}
                </p>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {t('Cancel')}
          </Button>
          {retry.length > 0 ? (
            <Button disabled={save.isPending} onClick={() => submit(retry)}>
              {t('Retry failed')}
            </Button>
          ) : (
            <Button
              disabled={
                save.isPending || entries.length === 0 || targets.length === 0 || Boolean(overLimit)
              }
              onClick={handleSave}
            >
              {entries.length === 1
                ? t('Save 1 variable')
                : t('Save {{n}} variables', { n: entries.length })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
