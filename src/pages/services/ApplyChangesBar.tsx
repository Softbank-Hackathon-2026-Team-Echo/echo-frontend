import { useState } from 'react';
import { FormError } from '@/components/FormField';
import { RoleButton } from '@/components/RoleButton';
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
import { useCreateDeploy, useDeployRequests } from '@/lib/api/services';
import type { ServiceDetail } from '@/lib/api/types';
import { useVariableMatrix } from '@/lib/api/variables';
import { t } from '@/lib/i18n';
import { shortSha } from '@/lib/status';

/** 환경마다 적용 전 변수와 다시 배포할 커밋. 값은 읽을 수 없어 키와 버전만 있다 */
function useApplyPlan(orgId: string, service: ServiceDetail) {
  const matrix = useVariableMatrix(orgId, service);
  const history = useDeployRequests(orgId, service.id);
  const plans = matrix.columns.flatMap(({ link, items }) => {
    const pending = items.filter((item) => item.pendingRedeploy);
    if (pending.length === 0) return [];
    // 첫 배포가 실패한 환경은 현재 배포가 없다. 그때 시도한 커밋으로 다시 배포한다
    const commitSha =
      link.currentDeployment?.commitSha ??
      history.data?.items.find((item) => item.environment.id === link.environment.id)?.commitSha ??
      null;
    return [{ link, pending, commitSha }];
  });
  return { plans, count: plans.reduce((sum, plan) => sum + plan.pending.length, 0) };
}

/** 변수를 저장해도 앱은 다시 배포해야 바뀐다. 어느 탭에서나 적용 전 변경을 보이고 한 번에 적용한다 */
export function ApplyChangesBar({
  orgId,
  service,
  disabledReason,
  onApplied,
  onChooseRef,
}: {
  orgId: string;
  service: ServiceDetail;
  disabledReason?: string;
  onApplied: () => void;
  onChooseRef: (environmentId: string) => void;
}) {
  const { plans, count } = useApplyPlan(orgId, service);
  const deploy = useCreateDeploy(orgId, service.id);
  const [details, setDetails] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string>();

  if (count === 0) return null;

  const deploying = plans.some(({ link }) => link.activeRequestId || link.queuedRequestId);
  const unknownRef = plans.find((plan) => !plan.commitSha);

  async function apply() {
    if (unknownRef) {
      setDetails(false);
      onChooseRef(unknownRef.link.environment.id);
      return;
    }
    setApplying(true);
    setError(undefined);
    try {
      for (const plan of plans) {
        await deploy.mutateAsync({
          environmentId: plan.link.environment.id,
          commitSha: plan.commitSha ?? '',
          simulate: null,
        });
      }
      setDetails(false);
      onApplied();
    } catch (failure) {
      setError(describeApiError(failure));
    } finally {
      setApplying(false);
    }
  }

  const label = count === 1 ? t('Apply 1 change') : t('Apply {{n}} changes', { n: count });
  const deployLabel = deploying ? t('Deploying…') : t('Deploy changes');

  return (
    <>
      <div
        role="status"
        className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-warning-bg px-3 py-2 text-warning-fg shadow-sm"
      >
        <span className="text-body-medium">{label}</span>
        <span className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setDetails(true)}>
            {t('Details')}
          </Button>
          <RoleButton
            requires="DEVELOPER"
            size="sm"
            disabledReason={disabledReason}
            disabled={applying || deploying}
            onClick={() => void apply()}
          >
            {deployLabel}
          </RoleButton>
        </span>
      </div>
      <FormError message={details ? undefined : error} />

      <Dialog open={details} onOpenChange={setDetails}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              {t('Saved values reach the app on its next deploy. Values are never shown.')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {plans.map(({ link, pending, commitSha }) => (
              <section key={link.serviceEnvironmentId} className="flex flex-col gap-1">
                <h3 className="text-title">{link.environment.name}</h3>
                <ul className="flex flex-col gap-0.5">
                  {pending.map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center justify-between gap-2 text-small"
                    >
                      <span className="font-mono text-mono">{item.key}</span>
                      <span className="font-mono text-mono text-fg-muted">
                        {item.appliedVersion ? `v${item.appliedVersion} → ` : ''}v{item.version}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-small text-fg-secondary">
                  {commitSha
                    ? t('{{service}} will redeploy {{sha}} on {{name}}.', {
                        service: service.name,
                        sha: shortSha(commitSha),
                        name: link.environment.name,
                      })
                    : t('{{name}} has no deploy yet. Choose what to deploy.', {
                        name: link.environment.name,
                      })}
                </p>
              </section>
            ))}
            <FormError message={error} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetails(false)}>
              {t('Cancel')}
            </Button>
            <RoleButton
              requires="DEVELOPER"
              disabledReason={disabledReason}
              disabled={applying || deploying}
              onClick={() => void apply()}
            >
              {unknownRef ? t('Choose what to deploy') : deployLabel}
            </RoleButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
