import type { ReactNode } from 'react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type IllustrationProps = {
  /** 화면 읽기 프로그램에 읽어 줄 설명 */
  label: string;
  children: ReactNode;
  className?: string;
  captionClassName?: string;
};

/**
 * 소개 화면의 미니 UI. 실제 컴포넌트에 예시 값을 넣어 그린 그림이라 "Illustration" 을 달아 둔다.
 * 실제 데이터로 오해하지 않게 하고, 안의 버튼은 눌리지 않는다
 */
export function Illustration({ label, children, className, captionClassName }: IllustrationProps) {
  return (
    <figure className={cn('flex flex-col gap-1.5', className)}>
      <div aria-hidden className="pointer-events-none select-none">
        {children}
      </div>
      <figcaption className={cn('text-caption text-fg-muted', captionClassName)}>
        {t('Illustration')}
        <span className="sr-only">: {label}</span>
      </figcaption>
    </figure>
  );
}
