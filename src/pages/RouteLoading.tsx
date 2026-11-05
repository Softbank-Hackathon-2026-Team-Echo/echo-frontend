import { Logo } from '@/components/Logo';
import { t } from '@/lib/i18n';

/** 처음 연 화면의 코드를 받는 동안 보인다. 이게 없으면 그동안 빈 화면이다 */
export function RouteLoading() {
  return (
    <div
      role="status"
      aria-label={t('Loading')}
      className="flex min-h-dvh items-center justify-center bg-canvas"
    >
      <Logo variant="mark" className="size-10 motion-safe:animate-pulse" />
    </div>
  );
}
