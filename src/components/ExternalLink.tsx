import { ExternalLinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** 새 탭으로 여는 주소 링크. 주소는 mono 로 보여 준다 */
export function ExternalLink({ href, className }: { href: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'inline-flex min-w-0 items-center gap-1 font-mono text-mono text-brand hover:underline',
        className,
      )}
    >
      <span className="truncate">{href.replace(/^https?:\/\//, '')}</span>
      <ExternalLinkIcon aria-hidden className="size-3 shrink-0" />
    </a>
  );
}
