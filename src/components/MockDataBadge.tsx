import { USE_MOCKS } from '@/lib/env';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

/** 프론트 MSW 목업으로 동작할 때 상단 바에 보인다. 서버의 simulated 와는 다른 표시다 */
export function MockDataBadge() {
  if (!USE_MOCKS) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="rounded-sm bg-warning-bg px-2 py-0.5 text-label text-warning-fg">
          Mock data
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Data on this screen comes from frontend mocks (MSW), not the API.
      </TooltipContent>
    </Tooltip>
  );
}
