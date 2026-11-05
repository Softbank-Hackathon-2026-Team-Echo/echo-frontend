// 보안 매트릭스·증거는 운영 API 를 부른다(echo-was docs/api/security.md).
// 시뮬레이션: 이전 전후 비교(계약 4-7 compare 🆕)만 서버가 생기기 전까지 환경 종류별 고정 값을 쓰고 항상 simulated 다.
// 서버가 생기면 SECURITY_COMPARE_API_READY 를 켜고 api + unwrap 으로 바꾼다. 이전을 막을지는 서버 게이트가 정한다
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from './client';
import { useEnvironments } from './environments';
import { queryKeys } from './query-keys';
import type { EnvironmentSummary, SecurityMatrixCell } from './types';

export const SECURITY_COMPARE_API_READY = false;

const FINDINGS_PAGE_SIZE = 100;

export const SECURITY_CONTROLS = ['iam', 'encryption', 'auditLog', 'policy'] as const;
export type SecurityControl = (typeof SECURITY_CONTROLS)[number];

export type SecurityResult = 'PASS' | 'WARN' | 'FAIL' | 'NA' | 'UNKNOWN';
export type SecurityCell = { result: SecurityResult; findingCount: number };

export type SecurityCompareRow = {
  control: SecurityControl;
  source: SecurityCell;
  target: SecurityCell;
  blocksMigration: boolean;
};

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

// 데모가 막히지 않게 시뮬레이션 값에는 FAIL 이 없다
const SIMULATED_ISSUES: Record<string, Partial<Record<SecurityControl, number>>> = {
  gcp: { policy: 2 },
  onprem: { iam: 1 },
};

// 온프레 디스크 암호화는 수집기가 없어 미수집으로 둔다
const NOT_COLLECTED: Record<string, SecurityControl[]> = { onprem: ['encryption'] };
const KNOWN_KINDS = ['aws', 'gcp', 'onprem'];

// 접속하지 못한 환경은 검사할 수 없으니 통과로 보이지 않게 한다
const isScannable = (environment: EnvironmentSummary) =>
  environment.connectionStatus === 'CONNECTED' && KNOWN_KINDS.includes(environment.kind);

function cellOf(environment: EnvironmentSummary, control: SecurityControl): SecurityCell {
  const collected = isScannable(environment) && !NOT_COLLECTED[environment.kind]?.includes(control);
  if (!collected) return { result: 'UNKNOWN', findingCount: 0 };
  const findingCount = SIMULATED_ISSUES[environment.kind]?.[control] ?? 0;
  return { result: findingCount > 0 ? 'WARN' : 'PASS', findingCount };
}

/** 비교 시뮬레이션의 한 환경 값 */
export function simulatedCells(
  environment: EnvironmentSummary,
): Record<SecurityControl, SecurityCell> {
  return {
    iam: cellOf(environment, 'iam'),
    encryption: cellOf(environment, 'encryption'),
    auditLog: cellOf(environment, 'auditLog'),
    policy: cellOf(environment, 'policy'),
  };
}

/** 도착 환경이 통제를 어기면 이전을 막는다. 서버가 생기면 이 판단은 서버 값으로 바뀐다 */
export function compareCells(
  control: SecurityControl,
  source: SecurityCell,
  target: SecurityCell,
): SecurityCompareRow {
  return { control, source, target, blocksMigration: target.result === 'FAIL' };
}

export function useSecurityCompare(
  orgId: string | undefined,
  sourceId: string | undefined,
  targetId: string | undefined,
) {
  const environments = useEnvironments(orgId);
  const items = environments.data?.items;
  const source = items?.find((item) => item.id === sourceId);
  const target = items?.find((item) => item.id === targetId);
  const data = (() => {
    if (!items) return undefined;
    if (!source || !target) return [];
    const [from, to] = [simulatedCells(source), simulatedCells(target)];
    return SECURITY_CONTROLS.map((control) => compareCells(control, from[control], to[control]));
  })();
  return {
    data,
    isPending: environments.isPending,
    isError: environments.isError,
    error: environments.error,
    refetch: environments.refetch,
  };
}
