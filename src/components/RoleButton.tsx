import type { ComponentProps, MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRole } from '@/hooks/useRole';
import type { MemberRole } from '@/lib/api/types';
import { hasRole, ROLE_LABELS } from '@/lib/roles';
import { cn } from '@/lib/utils';

type RoleButtonProps = ComponentProps<typeof Button> & {
  /** 이 역할 이상만 누를 수 있다 */
  requires: MemberRole;
  /** 권한은 있지만 지금 누를 수 없는 이유 (예: 아직 없는 기능) */
  disabledReason?: string;
};

/**
 * 권한이 필요한 버튼. 권한이 없으면 숨기지 않고 비활성 + "Requires Developer" 툴팁을 보여 준다.
 * 실제 거부는 서버가 한다(403). 이 버튼은 안내용이다.
 */
export function RoleButton({
  requires,
  disabledReason,
  className,
  onClick,
  ...props
}: RoleButtonProps) {
  const role = useRole();
  const reason = !hasRole(role, requires) ? `Requires ${ROLE_LABELS[requires]}` : disabledReason;

  if (!reason) return <Button className={className} onClick={onClick} {...props} />;

  // disabled 속성을 쓰면 포커스·호버를 받지 못해 툴팁이 안 뜬다. aria-disabled 로 막고 누름을 무시한다
  const ignoreClick = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-disabled="true"
          className={cn('cursor-not-allowed opacity-50', className)}
          onClick={ignoreClick}
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
