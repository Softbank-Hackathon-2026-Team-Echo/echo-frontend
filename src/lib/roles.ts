import { MEMBER_ROLES, type MemberRole } from './api/types';

const RANK: Record<MemberRole, number> = { VIEWER: 0, DEVELOPER: 1, ADMIN: 2 };

function isMemberRole(value: unknown): value is MemberRole {
  return typeof value === 'string' && (MEMBER_ROLES as readonly string[]).includes(value);
}

/** 역할 비교는 이 함수 하나로 한다. 모르는 역할·역할 없음은 권한이 없다고 본다 */
export function hasRole(role: unknown, min: MemberRole): boolean {
  return isMemberRole(role) && RANK[role] >= RANK[min];
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  VIEWER: 'Viewer',
  DEVELOPER: 'Developer',
  ADMIN: 'Admin',
};

export function roleLabel(role: unknown): string {
  return isMemberRole(role) ? ROLE_LABELS[role] : String(role ?? '—');
}
