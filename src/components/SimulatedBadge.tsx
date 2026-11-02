import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** 서버가 준 가짜 값(simulated: true) 옆에 붙인다. 심사 규칙상 숨기지 않는다 */
export function SimulatedBadge() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex rounded-xs bg-subtle px-1.5 text-caption text-fg-muted">
          simulated
        </span>
      </TooltipTrigger>
      <TooltipContent>
        This value comes from a simulated adapter, not a real cluster.
      </TooltipContent>
    </Tooltip>
  );
}
