import { useState } from 'react';
import { FormError } from '@/components/FormField';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { describeApiError } from '@/lib/api/errors';
import { MAX_VARIABLES, useCopyVariables, type VariableColumn } from '@/lib/api/variables';
import { t } from '@/lib/i18n';
import { variableCopyFailureLabel } from '@/lib/status';
import { EnvironmentChecks } from './EnvironmentChecks';

// 서버가 받는 대상 환경 수의 한도(CopyServiceVariablesRequest.targetEnvironmentIds)
const MAX_TARGETS = 10;

function defaultSource(columns: VariableColumn[]): VariableColumn | undefined {
  const withKeys = columns.filter((column) => column.items.length > 0);
  return withKeys.find((column) => column.link.role === 'SERVING') ?? withKeys[0];
}

/**
 * 한 환경의 변수를 다른 환경으로 복사한다(도현 님 개선 목록 5번). 값은 서버 안에서 옮겨져
 * 이 화면을 지나지 않는다. 이미 있는 키는 덮어쓰기를 켰을 때만 바꾼다
 */
export function CopyVariablesDialog({
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
  const copy = useCopyVariables(orgId, serviceId);
  const [sourceId, setSourceId] = useState(defaultSource(columns)?.link.environment.id ?? '');
  const source = columns.find((column) => column.link.environment.id === sourceId);
  const sourceKeys = (source?.items ?? []).map((item) => item.key).sort();
  const [keys, setKeys] = useState(sourceKeys);
  const others = columns.filter((column) => column.link.environment.id !== sourceId);
  const [picked, setPicked] = useState(others.map((column) => column.link.environment.id));
  const [overwrite, setOverwrite] = useState(false);
  const names = new Map(columns.map(({ link }) => [link.environment.id, link.environment.name]));
  const targets = others.filter((column) => picked.includes(column.link.environment.id));
  const result = copy.data;

  function chooseSource(id: string) {
    const next = columns.find((column) => column.link.environment.id === id);
    setSourceId(id);
    setKeys((next?.items ?? []).map((item) => item.key));
    setPicked(columns.map((column) => column.link.environment.id).filter((item) => item !== id));
    copy.reset();
  }

  function toggleKey(key: string, checked: boolean) {
    setKeys(checked ? [...keys, key] : keys.filter((item) => item !== key));
  }

  function skippedIn(column: VariableColumn) {
    return keys.filter((key) => column.items.some((item) => item.key === key)).length;
  }

  function handleCopy() {
    copy.mutate({
      sourceEnvironmentId: sourceId,
      targetEnvironmentIds: targets.map((column) => column.link.environment.id),
      keys,
      overwrite,
    });
  }

  const tooMany = targets.length > MAX_TARGETS || keys.length > MAX_VARIABLES;
  // 덮어쓰기가 꺼져 있으면 이미 있는 키는 서버가 건너뛴다. 실제로 복사될 키가 없으면 보내지 않는다
  const willCopy = overwrite
    ? keys.length * targets.length
    : targets.reduce((sum, column) => sum + keys.length - skippedIn(column), 0);
  const nothingToCopy = keys.length > 0 && targets.length > 0 && willCopy === 0;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('Copy variables to other environments')}</DialogTitle>
          <DialogDescription>
            {t(
              'Values are copied inside the secret store and never pass through this screen. Redeploy each environment to apply them.',
            )}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-2 text-body">
            <p className="flex items-center gap-2">
              {result.copied.length === 1
                ? t('Copied 1 variable.')
                : t('Copied {{n}} variables.', { n: result.copied.length })}
              {result.simulated && <SimulatedBadge />}
            </p>
            {result.failed.length > 0 && (
              <div role="alert" className="flex flex-col gap-0.5 text-small text-warning-fg">
                <p>{t('Not copied:')}</p>
                {result.failed.map((failure) => (
                  <p key={`${failure.environmentId}-${failure.key}`}>
                    <span className="font-mono text-mono">{failure.key}</span> ·{' '}
                    {names.get(failure.environmentId) ?? failure.environmentId} ·{' '}
                    {variableCopyFailureLabel(failure.code)}
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <legend className="mb-1 text-small text-fg-secondary">{t('Copy from')}</legend>
              {columns.map(({ link, items }) => (
                <label key={link.environment.id} className="flex items-center gap-1.5 text-body">
                  <input
                    type="radio"
                    name="copy-source"
                    className="accent-brand"
                    disabled={items.length === 0}
                    checked={sourceId === link.environment.id}
                    onChange={() => chooseSource(link.environment.id)}
                  />
                  {link.environment.name}
                </label>
              ))}
            </fieldset>

            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-small text-fg-secondary">{t('Keys')}</legend>
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                {sourceKeys.map((key) => (
                  <label key={key} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      className="accent-brand"
                      checked={keys.includes(key)}
                      onChange={(event) => toggleKey(key, event.target.checked)}
                    />
                    <span className="font-mono text-mono">{key}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <EnvironmentChecks
              columns={others}
              picked={picked}
              onChange={setPicked}
              label={t('Copy to')}
            />

            <label className="flex items-center gap-1.5 text-body">
              <input
                type="checkbox"
                className="accent-brand"
                checked={overwrite}
                onChange={(event) => setOverwrite(event.target.checked)}
              />
              {t('Replace keys that already exist')}
            </label>

            {!overwrite && (
              <ul className="flex flex-col gap-0.5 text-small text-fg-muted">
                {targets.map((column) => {
                  const skipped = skippedIn(column);
                  return skipped > 0 ? (
                    <li key={column.link.environment.id}>
                      {t('{{name}}: {{n}} existing keys will be skipped', {
                        name: column.link.environment.name,
                        n: skipped,
                      })}
                    </li>
                  ) : null;
                })}
              </ul>
            )}
            {tooMany && (
              <FormError
                message={t('Pick up to {{keys}} keys and {{targets}} environments.', {
                  keys: MAX_VARIABLES,
                  targets: MAX_TARGETS,
                })}
              />
            )}
            {nothingToCopy && (
              <FormError
                message={t('Every picked key already exists there. Turn on replace to overwrite.')}
              />
            )}
            {copy.isError && <FormError message={describeApiError(copy.error)} />}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={onClose}>{t('Done')}</Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('Cancel')}
              </Button>
              <Button
                disabled={
                  copy.isPending ||
                  !source ||
                  keys.length === 0 ||
                  targets.length === 0 ||
                  tooMany ||
                  nothingToCopy
                }
                onClick={handleCopy}
              >
                {keys.length === 1 ? t('Copy 1 key') : t('Copy {{n}} keys', { n: keys.length })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
