import markBrand from '@/assets/logo/mark-brand.svg';
import markInverse from '@/assets/logo/mark-inverse.svg';
import wordmarkO from '@/assets/logo/wordmark-o.svg';
import { cn } from '@/lib/utils';

type LogoProps = {
  className?: string;
  /**
   * wordmark: ECHOPORT 글자(사이드바) · mark: 고리 마크만 · app-icon: 브랜드 바탕 + 흰 마크(접힌 사이드바·로그인·파비콘)
   * Figma 「Design System › Logo」 Direction B — PORT 의 O 는 두 점을 잇는 호가 있는 지구본이다
   */
  variant?: 'wordmark' | 'mark' | 'app-icon';
};

// Figma 텍스트 스타일 EchoPort/Wordmark: Inter Semi Bold 16 / 20, 자간 28% (토큰에 없는 로고 전용 값)
const WORDMARK_TRACKING = '0.28em';

export function Logo({ className, variant = 'wordmark' }: LogoProps) {
  if (variant === 'mark') {
    return (
      <img src={markBrand} alt="" width={24} height={24} className={cn('shrink-0', className)} />
    );
  }
  if (variant === 'app-icon') {
    // 32 칸 안에 22 마크를 5 띄워 둔다 (Logo/App Icon 22/32). 크기를 바꿀 때는 그 비율을 유지한다
    return (
      <span
        aria-hidden
        className={cn(
          'relative flex size-8 shrink-0 items-center justify-center rounded-md bg-brand',
          className,
        )}
      >
        <img
          src={markInverse}
          alt=""
          width={22}
          height={22}
          style={{ width: '68.75%', height: '68.75%' }}
        />
      </span>
    );
  }
  return (
    <span className={cn('inline-flex items-center gap-1 text-h3 leading-5 text-fg', className)}>
      <span aria-hidden style={{ letterSpacing: WORDMARK_TRACKING }}>
        ECHOP
      </span>
      <img src={wordmarkO} alt="" width={12.5} height={12.5} aria-hidden className="shrink-0" />
      <span aria-hidden style={{ letterSpacing: WORDMARK_TRACKING }}>
        RT
      </span>
      <span className="sr-only">EchoPort</span>
    </span>
  );
}
