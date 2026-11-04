import { Building2 } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { Logo } from '@/components/Logo';
import { pickDefaultOrganization, useSession } from '@/lib/api/me';
import { t } from '@/lib/i18n';

// 로그인한 사람은 소개 화면 코드를 받지 않게 따로 불러온다
const LandingPage = lazy(() => import('@/pages/landing/LandingPage'));

function Loading() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3" aria-busy>
      {/* L00 앱 첫 진입 로딩: 마크 72 + 워드마크 (와이어프레임) */}
      <Logo variant="mark" className="size-18" />
      <Logo />
    </main>
  );
}

/**
 * `/` 첫 진입. /me 를 조용히 불러 로그인했으면 첫 조직(개인 조직 먼저)으로 보내고,
 * 로그인 전(401)이거나 API 에 닿지 않으면 L01 소개 화면을 보여 준다
 */
export default function RootRedirect() {
  const { data, isPending, isError } = useSession();

  if (isPending) return <Loading />;
  if (isError || data === null) {
    return (
      <Suspense fallback={<Loading />}>
        <LandingPage />
      </Suspense>
    );
  }

  const organization = pickDefaultOrganization(data.organizations);
  if (!organization) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-content items-center p-gutter">
        <EmptyState
          className="w-full"
          icon={Building2}
          title={t('No organizations yet')}
          description={t('Ask an admin to invite your GitHub account to an organization.')}
        />
      </main>
    );
  }
  return <Navigate to={`/o/${organization.slug}`} replace />;
}
