import { Boxes, Lock } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ExternalLink } from '@/components/ExternalLink';
import { PageHeader } from '@/components/PageHeader';
import { ProviderLabel } from '@/components/ProviderLabel';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCurrentOrg } from '@/lib/api/me';
import { useService, useServices } from '@/lib/api/services';
import type { ServiceSummary } from '@/lib/api/types';
import { shortSha } from '@/lib/status';
import { RegisterServiceDialog } from './RegisterServiceDialog';

function repoName(repoUrl: string) {
  return repoUrl.replace(/^https:\/\/github\.com\//, '');
}

/**
 * 목록 응답에는 어디서 서비스 중인지가 없어서 행마다 상세를 부른다(계약 §2 🔁 서비스 목록 요약).
 * 서비스 수가 적어 데모에는 문제없다.
 */
function ServingCell({ orgId, serviceId }: { orgId: string; serviceId: string }) {
  const { data, isPending } = useService(orgId, serviceId);
  if (isPending) return <Skeleton className="h-4 w-36" />;
  const serving = data?.environments.find((link) => link.role === 'SERVING');
  if (!serving) return <span className="text-fg-muted">Not deployed</span>;
  return (
    <span className="flex flex-col gap-0.5">
      <ProviderLabel kind={serving.environment.kind} showLocation={false} />
      <span className="text-caption text-fg-muted">
        {serving.environment.name} ·{' '}
        <span className="font-mono">{shortSha(serving.currentDeployment?.commitSha)}</span>
      </span>
    </span>
  );
}

function ServiceRow({
  orgId,
  orgSlug,
  service,
}: {
  orgId: string;
  orgSlug: string;
  service: ServiceSummary;
}) {
  return (
    <TableRow>
      <TableCell>
        <span className="flex items-center gap-2">
          <Link
            to={`/o/${orgSlug}/services/${service.id}`}
            className="text-body-medium hover:underline"
          >
            {service.name}
          </Link>
          {service.simulated && <SimulatedBadge />}
        </span>
        {service.description && (
          <span className="block text-caption text-fg-muted">{service.description}</span>
        )}
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 font-mono text-mono">
          {service.private && (
            <Lock aria-label="Private repository" className="size-3 text-fg-muted" />
          )}
          {repoName(service.repoUrl)}
        </span>
      </TableCell>
      <TableCell>
        <ServingCell orgId={orgId} serviceId={service.id} />
      </TableCell>
      <TableCell className="max-w-64">
        <ExternalLink href={service.url} />
      </TableCell>
      <TableCell>
        {service.status === 'DELETING' ? (
          <StatusBadge label="Deleting" tone="warning" />
        ) : (
          <StatusBadge label="Active" tone="success" />
        )}
      </TableCell>
    </TableRow>
  );
}

/** SVC 서비스 목록 */
export default function ServicesPage() {
  const { slug } = useParams();
  const { organization } = useCurrentOrg(slug);
  const { data, isPending, isError, error, refetch } = useServices(organization?.id);
  const [registerOpen, setRegisterOpen] = useState(false);

  const registerButton = (
    <RoleButton requires="DEVELOPER" size="sm" onClick={() => setRegisterOpen(true)}>
      Register service
    </RoleButton>
  );

  return (
    <>
      <PageHeader
        title="Services"
        description="Apps you deploy with one click. Each can run on several environments at once."
        actions={registerButton}
      />
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !isPending && data.items.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No services yet"
          description="Register a GitHub repository, then deploy it to an environment."
          action={registerButton}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Repository</TableHead>
                <TableHead>Serving on</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending || !organization
                ? Array.from({ length: 3 }, (_, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: 순서가 바뀌지 않는 자리 표시 행이다
                    <TableRow key={index}>
                      {Array.from({ length: 5 }, (__, cell) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: 자리 표시 칸이다
                        <TableCell key={cell}>
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : data.items.map((service) => (
                    <ServiceRow
                      key={service.id}
                      orgId={organization.id}
                      orgSlug={organization.slug}
                      service={service}
                    />
                  ))}
            </TableBody>
          </Table>
        </div>
      )}
      {organization && (
        <RegisterServiceDialog
          open={registerOpen}
          onOpenChange={setRegisterOpen}
          orgId={organization.id}
          orgSlug={organization.slug}
        />
      )}
    </>
  );
}
