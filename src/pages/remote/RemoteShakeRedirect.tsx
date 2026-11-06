import { Navigate } from 'react-router';
import { ErrorState } from '@/components/ErrorState';
import { Logo } from '@/components/Logo';
import { pickDefaultOrganization, useMe } from '@/lib/api/me';
import { t } from '@/lib/i18n';

/**
 * `/remote` 짧은 주소(휴대폰에 치기 쉽게). 로그인이 필요하다 — useMe 가 401 이면 로그인 화면으로 보낸다.
 * 첫 조직(개인 조직 먼저)의 충격 트리거 화면으로 넘긴다
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
  const organization = pickDefaultOrganization(data.organizations);
  if (!organization) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4 text-center text-fg-secondary">
        {t('No organizations yet')}
      </main>
    );
  }
  return <Navigate to={`/o/${organization.slug}/remote/shake`} replace />;
}
