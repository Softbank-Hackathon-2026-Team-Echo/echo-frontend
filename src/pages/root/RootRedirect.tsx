import { Building2 } from 'lucide-react';
import { Navigate } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Logo } from '@/components/Logo';
import { pickDefaultOrganization, useMe } from '@/lib/api/me';

/** L00 앱 첫 진입: /me 를 불러 첫 조직(개인 조직 먼저)으로 보낸다 */
export default function RootRedirect() {
  const { data, isPending, isError, error, refetch } = useMe();

  if (isPending) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3" aria-busy>
        <Logo />
        <p className="text-small text-fg-muted">Loading your organizations…</p>
      </main>
    );
  }
  if (isError) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-content items-center p-gutter">
        <div className="w-full">
          <ErrorState error={error} onRetry={() => refetch()} />
        </div>
      </main>
    );
  }

  const organization = pickDefaultOrganization(data.organizations);
  if (!organization) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-content items-center p-gutter">
        <EmptyState
          className="w-full"
          icon={Building2}
          title="No organizations yet"
          description="Ask an admin to invite your GitHub account to an organization."
        />
      </main>
    );
  }
  return <Navigate to={`/o/${organization.slug}`} replace />;
}
