import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { FormError, FormField } from '@/components/FormField';
import { ProviderLabel } from '@/components/ProviderLabel';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEnvironments } from '@/lib/api/environments';
import { fieldErrors } from '@/lib/api/form-errors';
import { useCreateDeploy } from '@/lib/api/services';
import type { SimulatedFailureStage } from '@/lib/api/types';

type RefKind = 'branch' | 'commit';
const NO_FAILURE = 'none';

type DeployDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgSlug: string;
  serviceId: string;
  serviceName: string;
  /** 처음 고를 환경 (서비스 상세의 환경 줄에서 열 때) */
  defaultEnvironmentId?: string;
};

/** SVC 배포: 환경 하나 + 브랜치 또는 커밋. 접수되면 배포 진행 화면으로 간다 */
export function DeployDialog({
  open,
  onOpenChange,
  orgId,
  orgSlug,
  serviceId,
  serviceName,
  defaultEnvironmentId,
}: DeployDialogProps) {
  const navigate = useNavigate();
  const environments = useEnvironments(orgId);
  const deploy = useCreateDeploy(orgId, serviceId);
  const [environmentId, setEnvironmentId] = useState(defaultEnvironmentId ?? '');
  const [refKind, setRefKind] = useState<RefKind>('branch');
  const [ref, setRef] = useState('main');
  const [failAt, setFailAt] = useState<string>(NO_FAILURE);
  const errors = fieldErrors(deploy.error);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    deploy.mutate(
      {
        environmentId,
        ...(refKind === 'branch'
          ? { branch: ref.trim() }
          : { commitSha: ref.trim().toLowerCase() }),
        simulate: failAt === NO_FAILURE ? null : { failAt: failAt as SimulatedFailureStage },
      },
      {
        onSuccess: (request) => {
          onOpenChange(false);
          navigate(`/o/${orgSlug}/services/${serviceId}/deploys/${request.id}`);
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) deploy.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Deploy {serviceName}</DialogTitle>
            <DialogDescription>
              Build the branch or commit and roll it out to one environment. The first environment
              that succeeds starts serving traffic; others follow as standby.
            </DialogDescription>
          </DialogHeader>

          <FormError message={errors._form} />

          <FormField id="deploy-env" label="Environment" error={errors.environmentId}>
            <Select value={environmentId} onValueChange={setEnvironmentId}>
              <SelectTrigger id="deploy-env" className="w-full">
                <SelectValue placeholder="Choose an environment" />
              </SelectTrigger>
              <SelectContent>
                {environments.data?.items.map((environment) => (
                  <SelectItem
                    key={environment.id}
                    value={environment.id}
                    // 마지막 접속 확인이 실패한 환경은 서버가 409 ENVIRONMENT_UNHEALTHY 로 막는다
                    disabled={environment.connectionStatus === 'FAILED'}
                  >
                    <ProviderLabel kind={environment.kind} showLocation={false} />
                    <span>{environment.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            id="deploy-ref"
            label={refKind === 'branch' ? 'Branch' : 'Commit SHA'}
            error={errors.branch ?? errors.commitSha}
          >
            <Tabs
              value={refKind}
              onValueChange={(value) => {
                setRefKind(value as RefKind);
                setRef(value === 'branch' ? 'main' : '');
              }}
            >
              <TabsList>
                <TabsTrigger value="branch">Branch</TabsTrigger>
                <TabsTrigger value="commit">Commit</TabsTrigger>
              </TabsList>
            </Tabs>
            <Input
              id="deploy-ref"
              className="font-mono text-mono"
              value={ref}
              onChange={(event) => setRef(event.target.value)}
              placeholder={refKind === 'branch' ? 'main' : 'a1b2c3d'}
              required
            />
          </FormField>

          <FormField
            id="deploy-simulate"
            label="Simulate a failure (demo)"
            hint="Only works while the API runs simulated executors."
            error={errors.simulate}
          >
            <Select value={failAt} onValueChange={setFailAt}>
              <SelectTrigger id="deploy-simulate" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FAILURE}>No failure</SelectItem>
                <SelectItem value="BUILDING">Fail while building</SelectItem>
                <SelectItem value="DEPLOYING">Fail while deploying</SelectItem>
                <SelectItem value="VERIFYING">Fail health check</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!environmentId || !ref.trim() || deploy.isPending}>
              {deploy.isPending ? 'Starting…' : 'Deploy'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
