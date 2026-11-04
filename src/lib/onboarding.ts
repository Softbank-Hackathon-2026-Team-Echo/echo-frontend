// 온보딩 진행은 따로 저장하지 않고 서버 데이터로 판단한다. 중간에 나갔다 와도 같은 단계에서 이어진다
import type { EnvironmentSummary, ServiceDetail } from '@/lib/api/types';
import { t } from './i18n';

export type OnboardingStep = 'signin' | 'primary' | 'standby' | 'deploy' | 'drill';

// 화면이 표를 바로 읽으므로 읽는 순간의 언어로 답하게 getter 로 둔다
export const ONBOARDING_STEPS: { key: OnboardingStep; title: string; meta: string }[] = [
  {
    key: 'signin',
    get title() {
      return t('Sign in with GitHub');
    },
    get meta() {
      return t('personal org created');
    },
  },
  {
    key: 'primary',
    get title() {
      return t('Connect primary');
    },
    get meta() {
      return t('where the app runs today');
    },
  },
  {
    key: 'standby',
    get title() {
      return t('Add standby');
    },
    get meta() {
      return t('where it can evacuate to');
    },
  },
  {
    key: 'deploy',
    get title() {
      return t('Deploy your app');
    },
    get meta() {
      return t('one-touch deploy');
    },
  },
  {
    key: 'drill',
    get title() {
      return t('Run a drill');
    },
    get meta() {
      return t('simulate a disaster safely');
    },
  },
];

export type OnboardingProgress = {
  done: Record<OnboardingStep, boolean>;
  /** 처음으로 끝나지 않은 단계. 다 끝났으면 훈련 */
  next: OnboardingStep;
  primary: EnvironmentSummary | undefined;
  standbys: EnvironmentSummary[];
  /** 배포 기록이 있는 첫 서비스 */
  deployed: ServiceDetail | undefined;
};

/**
 * 주 환경은 서비스를 받고 있는(SERVING) 환경, 없으면 먼저 등록한 환경이다.
 * 역할은 서비스 배포 단위라 환경에는 없다(API 서버 3)
 */
export function onboardingProgress(
  environments: EnvironmentSummary[],
  services: ServiceDetail[],
): OnboardingProgress {
  const byAge = [...environments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const servingId = services
    .flatMap((service) => service.environments)
    .find((link) => link.role === 'SERVING')?.environment.id;
  const primary = byAge.find((environment) => environment.id === servingId) ?? byAge[0];
  const standbys = byAge.filter((environment) => environment.id !== primary?.id);
  const deployed = services.find((service) =>
    service.environments.some((link) => link.currentDeployment !== null),
  );
  const done: Record<OnboardingStep, boolean> = {
    signin: true,
    primary: Boolean(primary),
    standby: standbys.length > 0,
    deploy: Boolean(deployed),
    drill: false,
  };
  const next = ONBOARDING_STEPS.find((step) => !done[step.key])?.key ?? 'drill';
  return { done, next, primary, standbys, deployed };
}
