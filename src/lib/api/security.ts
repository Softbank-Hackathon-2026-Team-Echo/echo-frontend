// 시뮬레이션: 보안 API(계약 4-7 🆕, echo-was #28)가 생기기 전까지 환경 종류별 고정 값을 보여 준다.
// 모양은 계약과 같고 항상 simulated 다. 서버가 생기면 SECURITY_API_READY 를 켜고 api + unwrap 으로 바꾼다.
// 데모가 막히지 않게 지금 값에는 FAIL 이 없다. 이전을 막을지는 서버의 blocksMigration 이 정한다
import { k, t } from '../i18n';
import { useEnvironments } from './environments';
import type { EnvironmentSummary } from './types';

export const SECURITY_API_READY = false;

export const SECURITY_CONTROLS = ['iam', 'encryption', 'auditLog', 'policy'] as const;
export type SecurityControl = (typeof SECURITY_CONTROLS)[number];

export type SecurityResult = 'PASS' | 'WARN' | 'FAIL' | 'NA' | 'UNKNOWN';
export type SecurityCell = { result: SecurityResult; findingCount: number };

export type SecurityMatrixRow = {
  environmentId: string;
  cells: Record<SecurityControl, SecurityCell>;
};

export type SecurityFinding = {
  id: string;
  environmentId: string;
  control: SecurityControl;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  source: string;
  evidence: Record<string, unknown>;
  normalized: Record<string, unknown>;
  suggestedFix: string;
  checkedAt: string;
};

export type SecurityCompareRow = {
  control: SecurityControl;
  source: SecurityCell;
  target: SecurityCell;
  blocksMigration: boolean;
};

type Seed = Pick<SecurityFinding, 'control' | 'severity' | 'title' | 'source' | 'suggestedFix'> & {
  rule: string;
};

const FINDINGS: Record<string, Seed[]> = {
  gcp: [
    {
      control: 'policy',
      severity: 'MEDIUM',
      title: k('Bucket without retention policy'),
      source: 'PROWLER',
      rule: 'storage-retention',
      suggestedFix: k('Set a retention policy on the bucket.'),
    },
    {
      control: 'policy',
      severity: 'MEDIUM',
      title: k('Service account key older than 90 days'),
      source: 'SCC',
      rule: 'iam-key-rotation',
      suggestedFix: k('Rotate the key, or move to workload identity.'),
    },
  ],
  onprem: [
    {
      control: 'iam',
      severity: 'MEDIUM',
      title: k('K3s API reachable from LAN'),
      source: 'KUBESCAPE',
      rule: 'api-server-exposure',
      suggestedFix: k('Limit the API server to the management network.'),
    },
  ],
};

// 온프레 디스크 암호화는 수집기가 없어 미수집으로 둔다
const NOT_COLLECTED: Record<string, SecurityControl[]> = { onprem: ['encryption'] };
const KNOWN_KINDS = ['aws', 'gcp', 'onprem'];

// 접속하지 못한 환경은 검사할 수 없으니 통과로 보이지 않게 한다
const isScannable = (environment: EnvironmentSummary) =>
  environment.connectionStatus === 'CONNECTED' && KNOWN_KINDS.includes(environment.kind);

function findingsOf(environment: EnvironmentSummary): SecurityFinding[] {
  if (!isScannable(environment)) return [];
  return (FINDINGS[environment.kind] ?? []).map(({ rule, ...seed }, index) => ({
    ...seed,
    title: t(seed.title),
    suggestedFix: t(seed.suggestedFix),
    id: `${environment.id}-${index}`,
    environmentId: environment.id,
    evidence: { rule, resource: environment.name, status: 'OPEN' },
    normalized: { control: seed.control, severity: seed.severity, environment: environment.name },
    checkedAt: environment.connectionCheckedAt ?? environment.updatedAt,
  }));
}

function cellOf(environment: EnvironmentSummary, control: SecurityControl): SecurityCell {
  const findingCount = findingsOf(environment).filter((item) => item.control === control).length;
  const collected = isScannable(environment) && !NOT_COLLECTED[environment.kind]?.includes(control);
  if (!collected) return { result: 'UNKNOWN', findingCount: 0 };
  return { result: findingCount > 0 ? 'WARN' : 'PASS', findingCount };
}

export function matrixRow(environment: EnvironmentSummary): SecurityMatrixRow {
  return {
    environmentId: environment.id,
    cells: {
      iam: cellOf(environment, 'iam'),
      encryption: cellOf(environment, 'encryption'),
      auditLog: cellOf(environment, 'auditLog'),
      policy: cellOf(environment, 'policy'),
    },
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

function useFromEnvironments<T>(
  orgId: string | undefined,
  build: (environments: EnvironmentSummary[]) => T,
) {
  const environments = useEnvironments(orgId);
  return {
    data: environments.data ? build(environments.data.items) : undefined,
    isPending: environments.isPending,
    isError: environments.isError,
    error: environments.error,
    refetch: environments.refetch,
  };
}

export function useSecurityMatrix(orgId: string | undefined) {
  return useFromEnvironments(orgId, (environments) => environments.map(matrixRow));
}

export function useSecurityFindings(orgId: string | undefined) {
  return useFromEnvironments(orgId, (environments) => environments.flatMap(findingsOf));
}

export function useSecurityCompare(
  orgId: string | undefined,
  sourceId: string | undefined,
  targetId: string | undefined,
) {
  return useFromEnvironments(orgId, (environments) => {
    const source = environments.find((item) => item.id === sourceId);
    const target = environments.find((item) => item.id === targetId);
    if (!source || !target) return [];
    const [from, to] = [matrixRow(source), matrixRow(target)];
    return SECURITY_CONTROLS.map((control) =>
      compareCells(control, from.cells[control], to.cells[control]),
    );
  });
}
