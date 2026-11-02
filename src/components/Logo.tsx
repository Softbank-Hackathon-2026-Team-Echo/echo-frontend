import { cn } from '@/lib/utils';

export function Logo({ className, showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand text-fg-on-brand"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor">
          <path d="M3 4.5h10M3 8h7M3 11.5h10" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
      {showName && <span className="text-title">EchoPort</span>}
    </span>
  );
}
