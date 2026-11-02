import { cn } from '@/lib/utils';

type LogoProps = {
  className?: string;
  /** wordmark: ECHOPORT 글자(사이드바), mark: 정사각 아이콘(접힌 사이드바·로그인) */
  variant?: 'wordmark' | 'mark';
};

export function Logo({ className, variant = 'wordmark' }: LogoProps) {
  if (variant === 'mark') {
    return (
      <span
        aria-hidden
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-md bg-brand text-fg-on-brand',
          className,
        )}
      >
        <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor">
          <circle cx="8" cy="8" r="5" strokeWidth="1.8" />
          <circle cx="11.5" cy="4.5" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      </span>
    );
  }
  // 와이어프레임 워드마크: 두 번째 O 만 브랜드색 고리
  return (
    <span className={cn('inline-flex items-center text-h3 tracking-widest', className)}>
      ECHOP
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="mx-px size-4 text-brand"
        fill="none"
        stroke="currentColor"
      >
        <circle cx="8" cy="8" r="6" strokeWidth="2" />
        <circle cx="12.5" cy="3.5" r="1.6" fill="currentColor" stroke="none" />
      </svg>
      RT
      <span className="sr-only">EchoPort</span>
    </span>
  );
}
