import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** 대시보드·상세 화면의 흰 카드 한 칸 (와이어프레임 벤토 칸) */
export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn('flex flex-col gap-3 rounded-lg border border-line bg-surface p-4', className)}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-2">
          {title && <h2 className="text-title">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
