import { FormField } from '@/components/FormField';
import { ProviderLabel } from '@/components/ProviderLabel';
import type { EnvironmentSummary } from '@/lib/api/types';
import { t } from '@/lib/i18n';

/** 서버가 배포 요청 하나에 받는 예비 환경 수의 상한 */
export const MAX_STANDBY_ENVIRONMENTS = 5;

type StandbyPickerProps = {
  environments: EnvironmentSummary[];
  primaryEnvironmentId: string;
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
};

/** 이번 배포에서 새로 올릴 예비 환경. 주 환경은 후보에서 뺀다 */
export function StandbyPicker({
  environments,
  primaryEnvironmentId,
  value,
  onChange,
  error,
}: StandbyPickerProps) {
  const candidates = environments.filter((item) => item.id !== primaryEnvironmentId);
  if (candidates.length === 0) return null;
  const isFull = value.length >= MAX_STANDBY_ENVIRONMENTS;

  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...value, id] : value.filter((item) => item !== id));
  }

  return (
    <FormField
      id="deploy-standby"
      label={t('Standby environments (optional)')}
      error={error}
      // 빈 목록은 이번 요청에 새 예비를 더하지 않는다는 뜻일 뿐, 이미 있는 예비를 멈추지 않는다
      hint={t(
        'Also deploy to these environments as standby, up to {{max}}. Leaving this empty does not stop existing standbys.',
        { max: MAX_STANDBY_ENVIRONMENTS },
      )}
    >
      <div id="deploy-standby" className="flex flex-col gap-1.5">
        {candidates.map((environment) => {
          const checked = value.includes(environment.id);
          const failed = environment.connectionStatus === 'FAILED';
          return (
            <label key={environment.id} className="flex items-center gap-2 text-body">
              <input
                type="checkbox"
                className="size-4 accent-brand"
                checked={checked}
                disabled={failed || (isFull && !checked)}
                onChange={(event) => toggle(environment.id, event.target.checked)}
              />
              <ProviderLabel kind={environment.kind} showLocation={false} />
              <span>{environment.name}</span>
              {failed && (
                <span className="text-caption text-danger-fg">{t('connection failed')}</span>
              )}
              {environment.connectionStatus === 'UNCHECKED' && (
                <span className="text-caption text-fg-muted">{t('Not checked')}</span>
              )}
            </label>
          );
        })}
      </div>
    </FormField>
  );
}
