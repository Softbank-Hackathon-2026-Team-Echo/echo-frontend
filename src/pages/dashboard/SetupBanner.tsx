import { ArrowRight, Compass } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import type { OnboardingProgress } from '@/lib/onboarding';

/** 온보딩이 덜 끝났으면 다음에 할 일 한 줄 + 온보딩으로 가는 버튼 */
export function SetupBanner({
  orgSlug,
  progress,
}: {
  orgSlug: string;
  progress: OnboardingProgress;
}) {
  if (progress.next === 'drill') return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-brand-subtle px-3 py-2 text-brand-on-subtle">
      <Compass aria-hidden className="size-4 shrink-0" />
      <p className="flex-1 text-body">
        {progress.done.primary
          ? progress.done.standby
            ? t('Deploy your app to finish setup.')
            : t('Add a standby environment so the app has somewhere to evacuate to.')
          : t('Connect the environment your app runs on to get started.')}
      </p>
      <Button asChild size="sm">
        <Link to={`/o/${orgSlug}/onboarding`}>
          {t('Continue setup')} <ArrowRight aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
