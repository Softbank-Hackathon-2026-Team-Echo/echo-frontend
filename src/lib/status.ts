// 서버 상태 값 → 화면 문구·색. 상태 표시는 여기와 StatusBadge 한 곳에서만 정한다 (ui-terms §4)
import { k, t } from './i18n';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'migrating' | 'ai';

export type StatusView = { label: string; tone: Tone };

function viewOf(table: Record<string, StatusView>, value: string): StatusView {
  const found = table[value];
  return found ? { ...found, label: t(found.label) } : { label: value, tone: 'neutral' };
}

function labelOf(table: Record<string, string>, value: string): string {
  const found = table[value];
  return found ? t(found) : value;
}

const CONNECTION: Record<string, StatusView> = {
  UNCHECKED: { label: k('Not checked'), tone: 'neutral' },
  CONNECTED: { label: k('Connected'), tone: 'success' },
  FAILED: { label: k('Failed'), tone: 'danger' },
};

/** 모르는 값은 원래 값을 그대로 중립 색으로 보여 준다 */
export function connectionStatusView(status: string): StatusView {
  return viewOf(CONNECTION, status);
}

const PROVIDER_LABELS: Record<string, string> = { aws: 'AWS', gcp: 'GCP', onprem: k('On-prem') };

export function providerLabel(kind: string): string {
  return labelOf(PROVIDER_LABELS, kind);
}

const DEPLOY_REQUEST: Record<string, StatusView> = {
  QUEUED: { label: k('Queued'), tone: 'neutral' },
  BUILDING: { label: k('Building'), tone: 'migrating' },
  DEPLOYING: { label: k('Deploying'), tone: 'migrating' },
  VERIFYING: { label: k('Verifying'), tone: 'migrating' },
  SUCCEEDED: { label: k('Succeeded'), tone: 'success' },
  FAILED: { label: k('Failed'), tone: 'danger' },
  CANCELLED: { label: k('Cancelled'), tone: 'neutral' },
};

export function deployStatusView(status: string): StatusView {
  return viewOf(DEPLOY_REQUEST, status);
}

const ENV_ROLE: Record<string, StatusView> = {
  SERVING: { label: k('Serving'), tone: 'success' },
  STANDBY: { label: k('Standby'), tone: 'neutral' },
  NONE: { label: k('Not deployed'), tone: 'neutral' },
};

/** 서비스-환경 연결의 역할 (조직 역할과 다르다, ui-terms §5) */
export function envRoleView(role: string): StatusView {
  return viewOf(ENV_ROLE, role);
}

const VERSION: Record<string, StatusView> = {
  IN_SYNC: { label: k('In sync'), tone: 'success' },
  OUT_OF_SYNC: { label: k('Out of sync'), tone: 'warning' },
};

export function versionStatusView(status: string): StatusView {
  return viewOf(VERSION, status);
}

const MIGRATION_PLAN: Record<string, StatusView> = {
  PENDING_APPROVAL: { label: k('Waiting for approval'), tone: 'warning' },
  APPROVED: { label: k('Approved'), tone: 'migrating' },
  RUNNING: { label: k('Migrating'), tone: 'migrating' },
  ROLLING_BACK: { label: k('Rolling back'), tone: 'warning' },
  SUCCEEDED: { label: k('Succeeded'), tone: 'success' },
  ROLLED_BACK: { label: k('Rolled back'), tone: 'warning' },
  FAILED: { label: k('Failed'), tone: 'danger' },
  REJECTED: { label: k('Rejected'), tone: 'neutral' },
  CANCELLED: { label: k('Cancelled'), tone: 'neutral' },
  EXPIRED: { label: k('Expired'), tone: 'neutral' },
  STALE: { label: k('Stale'), tone: 'neutral' },
};

/** 이전 계획 상태 (MigrationPlanStatus) */
export function migrationPlanStatusView(status: string): StatusView {
  return viewOf(MIGRATION_PLAN, status);
}

// 배포 요청을 만든 계기 (DeployRequestTrigger)
const DEPLOY_TRIGGER: Record<string, string> = {
  MANUAL: k('Manual'),
  STANDBY_SYNC: k('Standby sync'),
  ROLLBACK: k('Rollback'),
};

export function deployTriggerLabel(trigger: string): string {
  return labelOf(DEPLOY_TRIGGER, trigger);
}

// 배포 요청 실패 이유 (echo-was docs/api/deploy-requests.md)
const DEPLOY_ERRORS: Record<string, string> = {
  REPO_NOT_ACCESSIBLE: k('The repository is not accessible.'),
  REF_NOT_FOUND: k('The branch or commit was not found.'),
  SOURCE_PROVIDER_UNAVAILABLE: k('GitHub did not respond.'),
  BUILD_FAILED: k('The build failed.'),
  BUILD_TIMEOUT: k('The build timed out.'),
  DEPLOY_FAILED: k('The deployment failed.'),
  DEPLOY_TIMEOUT: k('The deployment timed out.'),
  HEALTH_CHECK_FAILED: k('The health check failed.'),
  HEALTH_CHECK_TIMEOUT: k('The health check timed out.'),
  PUBLIC_URL_UNREACHABLE: k('The public URL could not be reached.'),
  WORKER_LOST: k('The deploy worker stopped responding.'),
  INTERNAL_ERROR: k('An internal error occurred.'),
  BUILD_DISPATCH_FAILED: k('The build could not be started.'),
  CLUSTER_UNAUTHORIZED: k('The cluster rejected the deploy credentials.'),
  IMAGE_PULL_FAILED: k('The cluster could not pull the image.'),
  CONTAINER_START_FAILED: k('The container failed to start.'),
};

export function deployErrorLabel(code: string): string {
  return labelOf(DEPLOY_ERRORS, code);
}

// 보안 결과 (계약 4-7). UNKNOWN 은 아직 수집하지 못한 칸이다
const SECURITY_RESULTS: Record<string, StatusView> = {
  PASS: { label: k('Pass'), tone: 'success' },
  WARN: { label: k('Warn'), tone: 'warning' },
  FAIL: { label: k('Fail'), tone: 'danger' },
  NA: { label: 'N/A', tone: 'neutral' },
  UNKNOWN: { label: k('Unknown'), tone: 'neutral' },
};

export function securityResultView(result: string): StatusView {
  return viewOf(SECURITY_RESULTS, result);
}

/** 칸 글자. 건수가 있으면 건수를 쓴다 */
export function securityCellLabel(result: string, findingCount: number): string {
  if ((result === 'WARN' || result === 'FAIL') && findingCount > 0) {
    return findingCount === 1 ? t('1 issue') : t('{{total}} issues', { total: findingCount });
  }
  return securityResultView(result).label;
}

const SECURITY_CONTROL_LABELS: Record<string, string> = {
  iam: 'IAM',
  encryption: k('Encryption'),
  auditLog: k('Audit log'),
  policy: k('Policy'),
};

export function securityControlLabel(control: string): string {
  return labelOf(SECURITY_CONTROL_LABELS, control);
}

const SECURITY_SEVERITIES: Record<string, string> = {
  HIGH: k('High'),
  MEDIUM: k('Medium'),
  LOW: k('Low'),
};

export function securitySeverityLabel(severity: string): string {
  return labelOf(SECURITY_SEVERITIES, severity);
}

/** 비교 표 판정 칸 */
export function securityCompareNote(row: {
  source: { result: string };
  target: { result: string };
  blocksMigration: boolean;
}): string {
  if (row.blocksMigration) return t('blocks migration');
  if (row.source.result === 'UNKNOWN' || row.target.result === 'UNKNOWN') return t('not collected');
  if (row.target.result === 'WARN') return t('warning only');
  return row.source.result === row.target.result ? t('same') : t('differs');
}

// 이전 종류 (서버가 만들 때 판정한 mode)
const MIGRATION_MODES: Record<string, string> = {
  PLANNED: k('Planned'),
  EMERGENCY: k('Emergency'),
  FAILBACK: k('Failback'),
};

export function migrationModeLabel(mode: string): string {
  return labelOf(MIGRATION_MODES, mode);
}

// 이전 실패·되돌림 이유 (echo-was docs/api/migration-plans.md, MigrationErrorCode)
const MIGRATION_ERRORS: Record<string, string> = {
  PREFLIGHT_FAILED: k('Pre-check failed'),
  TRAFFIC_APPLY_FAILED: k('Traffic weight could not be applied'),
  HEALTH_CHECK_FAILED: k('Health check failed'),
  METRICS_UNAVAILABLE: k('Metrics were not available'),
  THRESHOLD_EXCEEDED: k('Too many 5xx on the target'),
  DATA_LAG_EXCEEDED: k('Replication lag too high'),
  TARGET_NOT_RECEIVING: k('Target received no traffic'),
  ABORTED: k('Stopped by a person'),
  WORKER_LOST: k('The worker stopped responding'),
  INTERNAL_ERROR: k('Internal error'),
};

export function migrationErrorLabel(code: string): string {
  return labelOf(MIGRATION_ERRORS, code);
}

// 연결 내리기 실패 이유 (echo-was docs/api/services.md, TeardownErrorCode)
const TEARDOWN_ERRORS: Record<string, string> = {
  TEARDOWN_FAILED: k('Removing it from this cluster failed.'),
  TEARDOWN_TIMEOUT: k('Removing it from this cluster timed out.'),
  WORKER_LOST: k('The worker stopped responding while removing it.'),
};

export function teardownErrorLabel(code: string): string {
  return labelOf(TEARDOWN_ERRORS, code);
}

/** 커밋 SHA 는 앞 7자만 보여 준다 (ui-terms §1) */
export function shortSha(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : '—';
}

// 접속 실패 이유 (echo-was docs/api/environments.md, ConnectionErrorCode)
const CONNECTION_ERRORS: Record<string, string> = {
  TIMEOUT: k('The cluster did not answer in time.'),
  SECRET_REF_MISSING: k('No secret reference is set.'),
  SECRET_REF_INVALID: k('The secret reference is not valid.'),
  SECRET_NOT_FOUND: k('The secret was not found on the API server.'),
  SECRET_STORE_UNSUPPORTED: k('This secret store is not supported yet. Use env:.'),
  CONFIG_INVALID: k('The saved settings are not valid for this provider.'),
  AUTH_FAILED: k('The cluster rejected the credentials.'),
  UNREACHABLE: k('The cluster could not be reached.'),
  UNKNOWN: k('The connection check failed.'),
};

export function connectionErrorLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return labelOf(CONNECTION_ERRORS, code);
}

/** 접속은 되는데 노드 목록 권한만 없으면 서버가 CONNECTED 로 둔다. 이때는 접속 실패 문구를 쓰지 않는다 */
export function clusterInfoErrorLabel(
  connectionStatus: string | undefined,
  code: string | null | undefined,
): string | null {
  if (code && connectionStatus === 'CONNECTED') {
    return t('Connected, but the version and node count could not be read with this account.');
  }
  return connectionErrorLabel(code);
}
