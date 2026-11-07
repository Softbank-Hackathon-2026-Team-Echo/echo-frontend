// 보안 매트릭스 · 증거 · 이전 전후 비교 (echo-was docs/api/security.md). 이전을 막을지는 서버 게이트가 정한다
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, unwrap } from './client';
import { queryKeys } from './query-keys';
import type { SecurityMatrixCell } from './types';

const FINDINGS_PAGE_SIZE = 100;

export const SECURITY_CONTROLS = ['iam', 'encryption', 'auditLog', 'policy'] as const;
export type SecurityControl = (typeof SECURITY_CONTROLS)[number];

export type SecurityResult = 'PASS' | 'WARN' | 'FAIL' | 'NA' | 'UNKNOWN';
export type SecurityCell = { result: SecurityResult; findingCount: number };

export function useSecurityMatrix(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.securityMatrix(orgId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/security/matrix', {
          params: { path: { org_id: orgId ?? '' } },
        }),
      ),
    enabled: Boolean(orgId),
  });
}

/** 최신 증거 100건. 조직 전체 표에 쓴다 */
export function useSecurityFindings(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.securityFindings(orgId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/security/findings', {
          params: {
            path: { org_id: orgId ?? '' },
            query: { page: 0, size: FINDINGS_PAGE_SIZE },
          },
        }),
      ),
    enabled: Boolean(orgId),
  });
}

/** 기한부 예외 최신 100건. 만들기 · 승인 · 철회 화면은 아직 없다 */
export function useSecurityExceptions(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.securityExceptions(orgId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/security/exceptions', {
          params: {
            path: { org_id: orgId ?? '' },
            query: { page: 0, size: FINDINGS_PAGE_SIZE },
          },
        }),
      ),
    enabled: Boolean(orgId),
  });
}

/** 칸의 판정에 쓴 증거 id. 증거는 통제 ID 로 오므로 칸과는 이 id 로 잇는다 */
export function cellFindingIds(cell: SecurityMatrixCell | undefined): string[] {
  const ids = cell?.controls.flatMap((control) => control.findingIds) ?? [];
  return [...new Set(ids)].slice(0, FINDINGS_PAGE_SIZE);
}

export function useSecurityFindingsByIds(orgId: string | undefined, findingIds: string[]) {
  return useQuery({
    queryKey: queryKeys.securityCellFindings(orgId ?? '', findingIds),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/security/findings', {
          params: {
            path: { org_id: orgId ?? '' },
            query: { findingId: findingIds, page: 0, size: FINDINGS_PAGE_SIZE },
          },
        }),
      ),
    enabled: Boolean(orgId) && findingIds.length > 0,
  });
}

/** 칸 글자의 건수. 서버 findingCount 는 판정에 쓴 증거 수라 통과한 증거도 세므로, 문제 통제만 센다 */
export function cellIssueCount(cell: SecurityMatrixCell): number {
  return cell.controls.filter((control) => control.result === 'WARN' || control.result === 'FAIL')
    .length;
}

/** 두 환경의 칸을 나란히 준다. serviceId 를 넣으면 그 서비스 기준이라 게이트 판정과 같다 */
export function useSecurityCompare(
  orgId: string | undefined,
  source: string | undefined,
  target: string | undefined,
  serviceId?: string,
) {
  return useQuery({
    queryKey: queryKeys.securityCompare(orgId ?? '', source ?? '', target ?? '', serviceId ?? null),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/security/compare', {
          params: {
            path: { org_id: orgId ?? '' },
            query: { source: source ?? '', target: target ?? '', serviceId },
          },
        }),
      ),
    enabled: Boolean(orgId && source && target && source !== target),
  });
}

export function useFindingDiagnosis(orgId: string | undefined, findingId: string) {
  return useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/api/v1/orgs/{org_id}/security/findings/{finding_id}/diagnosis', {
          params: { path: { org_id: orgId ?? '', finding_id: findingId } },
        }),
      ),
  });
}
