import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ErrorState } from '@/components/ErrorState';
import { Logo } from '@/components/Logo';
import { type Stage, StageList } from '@/components/StageList';
import { Skeleton } from '@/components/ui/skeleton';
import { useEnvironments } from '@/lib/api/environments';
import { useCurrentOrg } from '@/lib/api/me';
import { useServiceDetails, useServices } from '@/lib/api/services';
import { t } from '@/lib/i18n';
import { ONBOARDING_STEPS, type OnboardingStep, onboardingProgress } from '@/lib/onboarding';
import { DeployStep } from './DeployStep';
import { DrillStep } from './DrillStep';
import { PrimaryStep } from './PrimaryStep';
import { StandbyStep } from './StandbyStep';

/**
 * O01~O03 온보딩: 로그인 → 주 환경 → 예비 환경(지구본) → 배포 → 첫 재난 훈련.
 * 어느 단계에서 시작할지는 서버 데이터로 정한다. 언제든 Skip setup 으로 대시보드에 간다
 */
export default function OnboardingPage() {
  const { slug } = useParams();
  const { organization, isPending: mePending } = useCurrentOrg(slug);
  const orgId = organization?.id;
  const environments = useEnvironments(orgId);
  const services = useServices(orgId);
  const serviceItems = services.data?.items ?? [];
  const details = useServiceDetails(
    orgId,
    serviceItems.map((service) => service.id),
  );
  const progress = onboardingProgress(environments.data?.items ?? [], details.data);
  const loading = mePending || environments.isPending || services.isPending || details.isPending;

  // 처음 연 단계를 고정한다. 예비 환경을 하나 더한 뒤에도 그 화면에 머물러 더 고를 수 있게
  const [step, setStep] = useState<OnboardingStep>();
  useEffect(() => {
    if (!loading && step === undefined) setStep(progress.next);
  }, [loading, step, progress.next]);
  // 주 환경을 방금 등록했을 때만 다음 단계로 넘어간다. 끝난 단계를 다시 눌러 볼 때는 머문다
  const hadPrimary = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (loading) return;
    if (hadPrimary.current === false && progress.done.primary && step === 'primary') {
      setStep('standby');
    }
    hadPrimary.current = progress.done.primary;
  }, [loading, step, progress.done.primary]);

  const shown = step ?? progress.next;
  const index = ONBOARDING_STEPS.findIndex((item) => item.key === shown);
  const stages: Stage[] = ONBOARDING_STEPS.map((item) => {
    const reachable =
      item.key !== 'signin' && (progress.done[item.key] || item.key === progress.next);
    return {
      key: item.key,
      title:
        reachable && item.key !== shown ? (
          <button
            type="button"
            className="text-left hover:underline focus-visible:outline-2 focus-visible:outline-focus"
            onClick={() => setStep(item.key)}
          >
            {t(item.title)}
          </button>
        ) : (
          t(item.title)
        ),
      meta: t(item.meta),
      state: item.key === shown ? 'current' : progress.done[item.key] ? 'done' : 'pending',
    };
  });

  if (environments.isError) {
    return <ErrorState error={environments.error} onRetry={() => environments.refetch()} />;
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="flex items-center justify-between px-10 py-4 max-compact:px-gutter-compact">
        <Logo />
        <p className="text-small text-fg-secondary">
          {t('Step {{current}} of {{total}}', {
            current: index + 1,
            total: ONBOARDING_STEPS.length,
          })}{' '}
          ·{' '}
          <Link to={`/o/${slug}`} className="hover:underline">
            {t('Skip setup')}
          </Link>
        </p>
      </header>
      <main className="flex items-start gap-8 px-16 pt-4 pb-16 max-wide:px-10 max-compact:flex-col max-compact:px-gutter-compact">
        <nav aria-label={t('Setup steps')} className="w-75 shrink-0 max-compact:w-full">
          <StageList stages={stages} />
        </nav>
        {loading || !organization ? (
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-9 w-96" />
            <Skeleton className="h-6 w-120" />
            <Skeleton className="h-80 w-140" />
          </div>
        ) : shown === 'primary' || shown === 'signin' ? (
          <PrimaryStep
            orgId={organization.id}
            orgSlug={organization.slug}
            primaryName={progress.primary?.name}
            onContinue={() => setStep('standby')}
          />
        ) : shown === 'standby' ? (
          <StandbyStep
            orgId={organization.id}
            orgSlug={organization.slug}
            primary={progress.primary}
            standbys={progress.standbys}
            onContinue={() => setStep(progress.done.deploy ? 'drill' : 'deploy')}
          />
        ) : shown === 'deploy' ? (
          <DeployStep
            orgId={organization.id}
            orgSlug={organization.slug}
            services={serviceItems}
            primaryId={progress.primary?.id}
          />
        ) : (
          <DrillStep
            orgId={organization.id}
            orgSlug={organization.slug}
            primary={progress.primary}
            standbys={progress.standbys}
            service={progress.deployed}
          />
        )}
      </main>
    </div>
  );
}
