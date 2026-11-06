import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { DeployDialog } from '@/components/DeployDialog';
import { FormField } from '@/components/FormField';
import { ProviderLabel } from '@/components/ProviderLabel';
import { SharedTrafficNotice } from '@/components/SharedTrafficNotice';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEnvironments } from '@/lib/api/environments';
import { useServiceDetails } from '@/lib/api/services';
import type { EnvironmentSummary, ServiceDetail } from '@/lib/api/types';
import { t } from '@/lib/i18n';

type TargetState = 'ready' | 'not-deployed' | 'out-of-sync' | 'unreachable';

/** 서버의 계획 만들기 규칙과 같다: 도착에 출발과 같은 버전이 떠 있어야 한다 */
export function targetState(service: ServiceDetail, environment: EnvironmentSummary): TargetState {
  if (environment.connectionStatus === 'FAILED') return 'unreachable';
  const link = service.environments.find((item) => item.environment.id === environment.id);
  if (!link?.currentDeployment) return 'not-deployed';
  return link.versionStatus === 'OUT_OF_SYNC' ? 'out-of-sync' : 'ready';
}

export function targetStateLabel(state: TargetState) {
  if (state === 'ready') return t('Ready');
  if (state === 'not-deployed') return t('Not deployed');
  if (state === 'out-of-sync') return t('Out of sync');
  return t('Connection failed');
}

/** 서버가 이전을 받는 출발은 트래픽 100% 인 연결 하나다 */
function sourceLink(service: ServiceDetail) {
  return service.environments.find((link) => link.trafficWeight === 100);
}

type PlanMigrationDialogProps = {
  onClose: () => void;
  orgId: string;
  orgSlug: string;
  serviceIds: string[];
  /** 서비스 화면에서 열면 서비스를 고르지 않는다 */
  fixedServiceId?: string;
};

/** M01 이전 시작: 재난 없이 서비스와 도착 환경을 고른다. 다음 화면은 사전 점검 또는 계획이다 */
export function PlanMigrationDialog({
  onClose,
  orgId,
  orgSlug,
  serviceIds,
  fixedServiceId,
}: PlanMigrationDialogProps) {
  const navigate = useNavigate();
  const details = useServiceDetails(orgId, serviceIds);
  const environments = useEnvironments(orgId);
  const [serviceId, setServiceId] = useState(fixedServiceId ?? '');
  const [targetId, setTargetId] = useState('');
  const [deploying, setDeploying] = useState(false);

  const service = details.data.find((item) => item.id === serviceId);
  const source = service && sourceLink(service);
  const targets = (environments.data?.items ?? []).filter(
    (item) => item.id !== source?.environment.id,
  );
  const target = targets.find((item) => item.id === targetId);
  const state = service && target ? targetState(service, target) : undefined;
  const query = `service=${serviceId}&target=${targetId}`;

  if (deploying && service && target) {
    return (
      <DeployDialog
        open
        onOpenChange={(open) => !open && onClose()}
        orgId={orgId}
        orgSlug={orgSlug}
        serviceId={service.id}
        serviceName={service.name}
        defaultEnvironmentId={target.id}
      />
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Plan a migration')}</DialogTitle>
          <DialogDescription>
            {t('Move a service to another environment without a disaster.')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {!fixedServiceId && (
            <FormField id="migration-service" label={t('Service')}>
              <Select
                value={serviceId}
                onValueChange={(value) => {
                  setServiceId(value);
                  setTargetId('');
                }}
              >
                <SelectTrigger id="migration-service" className="w-full">
                  <SelectValue placeholder={t('Choose a service')} />
                </SelectTrigger>
                <SelectContent>
                  {details.data.map((item) => (
                    <SelectItem key={item.id} value={item.id} disabled={!sourceLink(item)}>
                      <span>{item.name}</span>
                      <span className="text-caption text-fg-muted">
                        {sourceLink(item)?.environment.name ?? t('Not serving traffic')}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          <FormField id="migration-target" label={t('Target environment')}>
            <Select value={targetId} onValueChange={setTargetId} disabled={!service}>
              <SelectTrigger id="migration-target" className="w-full">
                <SelectValue placeholder={t('Choose an environment')} />
              </SelectTrigger>
              <SelectContent>
                {service &&
                  targets.map((item) => {
                    const itemState = targetState(service, item);
                    return (
                      <SelectItem
                        key={item.id}
                        value={item.id}
                        disabled={itemState === 'unreachable'}
                      >
                        <ProviderLabel kind={item.kind} showLocation={false} />
                        <span>{item.name}</span>
                        <span className="text-caption text-fg-muted">
                          {targetStateLabel(itemState)}
                        </span>
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
          </FormField>

          {target && (state === 'not-deployed' || state === 'out-of-sync') && (
            <p className="text-small text-fg-secondary">
              {t('{{name}} needs the same version running before it can take traffic.', {
                name: target.name,
              })}
            </p>
          )}
          <SharedTrafficNotice orgId={orgId} />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          {state === 'ready' ? (
            <>
              <Button asChild variant="outline">
                <Link to={`/o/${orgSlug}/evacuation/plan?${query}`}>{t('Skip to plan')}</Link>
              </Button>
              <Button onClick={() => navigate(`/o/${orgSlug}/evacuation/pre-check?${query}`)}>
                {t('Run AI pre-check')}
              </Button>
            </>
          ) : state === 'not-deployed' || state === 'out-of-sync' ? (
            <Button onClick={() => setDeploying(true)}>
              {t('Deploy to {{name}} first', { name: target?.name ?? '' })}
            </Button>
          ) : (
            <Button disabled>{t('Run AI pre-check')}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
