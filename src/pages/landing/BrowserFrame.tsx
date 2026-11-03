import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** 브라우저 창 틀(점 3개 + 주소 칸). 제품 화면 그림을 담는다 */
export function BrowserFrame({
  url,
  children,
  className,
}: {
  url: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-line bg-surface shadow-xl',
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-line bg-subtle px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
        </span>
        <span className="truncate rounded-sm bg-surface px-2 py-0.5 font-mono text-mono text-fg-secondary">
          {url}
        </span>
      </div>
      {children}
    </div>
  );
}
