import { Navigate } from 'react-router';
import { ErrorState } from '@/components/ErrorState';
import { Logo } from '@/components/Logo';
import { pickDefaultOrganization, useMe } from '@/lib/api/me';
import { t } from '@/lib/i18n';

/** 시연 조직. 개인 조직으로 가면 재난이 시연 대시보드에 나타나지 않는다 */
const DEMO_ORG_SLUG = 'echo-demo';

/**
 * `/remote` 짧은 주소(휴대폰에 치기 쉽게). 로그인이 필요하다 — useMe 가 401 이면 로그인 화면으로 보낸다.
 * 시연 조직, 없으면 기본 조직의 충격 트리거 화면으로 넘긴다
 */
export default function RemoteShakeRedirect() {
  const { data, isPending, isError, error, refetch } = useMe();

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending || !data) {
    return (
      <main className="flex min-h-dvh items-center justify-center" aria-busy>
        <Logo />
      </main>
    );
  }
  const organization =
    data.organizations.find((org) => org.slug === DEMO_ORG_SLUG) ??
    pickDefaultOrganization(data.organizations);
  if (!organization) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4 text-center text-fg-secondary">
        {t('No organizations yet')}
      </main>
    );
  }
  return <Navigate to={`/o/${organization.slug}/remote/shake`} replace />;
}
