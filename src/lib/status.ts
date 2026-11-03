// 서버 상태 값 → 화면 문구·색. 상태 표시는 여기와 StatusBadge 한 곳에서만 정한다 (ui-terms §4)

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'migrating' | 'ai';

export type StatusView = { label: string; tone: Tone };

const CONNECTION: Record<string, StatusView> = {
  UNCHECKED: { label: 'Not checked', tone: 'neutral' },
  CONNECTED: { label: 'Connected', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
};

/** 모르는 값은 원래 값을 그대로 중립 색으로 보여 준다 */
export function connectionStatusView(status: string): StatusView {
  return CONNECTION[status] ?? { label: status, tone: 'neutral' };
}

const PROVIDER_LABELS: Record<string, string> = { aws: 'AWS', gcp: 'GCP', onprem: 'On-prem' };

export function providerLabel(kind: string): string {
  return PROVIDER_LABELS[kind] ?? kind;
}

const DEPLOY_REQUEST: Record<string, StatusView> = {
  QUEUED: { label: 'Queued', tone: 'neutral' },
  BUILDING: { label: 'Building', tone: 'migrating' },
  DEPLOYING: { label: 'Deploying', tone: 'migrating' },
  VERIFYING: { label: 'Verifying', tone: 'migrating' },
  SUCCEEDED: { label: 'Succeeded', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

export function deployStatusView(status: string): StatusView {
  return DEPLOY_REQUEST[status] ?? { label: status, tone: 'neutral' };
}

const ENV_ROLE: Record<string, StatusView> = {
  SERVING: { label: 'Serving', tone: 'success' },
  STANDBY: { label: 'Standby', tone: 'neutral' },
  NONE: { label: 'Not deployed', tone: 'neutral' },
};

/** 서비스-환경 연결의 역할 (조직 역할과 다르다, ui-terms §5) */
export function envRoleView(role: string): StatusView {
  return ENV_ROLE[role] ?? { label: role, tone: 'neutral' };
}

const VERSION: Record<string, StatusView> = {
  IN_SYNC: { label: 'In sync', tone: 'success' },
  OUT_OF_SYNC: { label: 'Out of sync', tone: 'warning' },
};

export function versionStatusView(status: string): StatusView {
  return VERSION[status] ?? { label: status, tone: 'neutral' };
}

const MIGRATION_PLAN: Record<string, StatusView> = {
  PENDING_APPROVAL: { label: 'Waiting for approval', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'migrating' },
  RUNNING: { label: 'Migrating', tone: 'migrating' },
  ROLLING_BACK: { label: 'Rolling back', tone: 'warning' },
  SUCCEEDED: { label: 'Succeeded', tone: 'success' },
  ROLLED_BACK: { label: 'Rolled back', tone: 'warning' },
  FAILED: { label: 'Failed', tone: 'danger' },
  REJECTED: { label: 'Rejected', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
  STALE: { label: 'Stale', tone: 'neutral' },
};

/** 이전 계획 상태 (MigrationPlanStatus) */
export function migrationPlanStatusView(status: string): StatusView {
  return MIGRATION_PLAN[status] ?? { label: status, tone: 'neutral' };
}

// 배포 요청을 만든 계기 (DeployRequestTrigger)
const DEPLOY_TRIGGER: Record<string, string> = {
  MANUAL: 'Manual',
  STANDBY_SYNC: 'Standby sync',
  ROLLBACK: 'Rollback',
};

export function deployTriggerLabel(trigger: string): string {
  return DEPLOY_TRIGGER[trigger] ?? trigger;
}

// 배포 요청 실패 이유 (echo-was docs/api/deploy-requests.md)
const DEPLOY_ERRORS: Record<string, string> = {
  REPO_NOT_ACCESSIBLE: 'The repository is not accessible.',
  REF_NOT_FOUND: 'The branch or commit was not found.',
  SOURCE_PROVIDER_UNAVAILABLE: 'GitHub did not respond.',
  BUILD_FAILED: 'The build failed.',
  BUILD_TIMEOUT: 'The build timed out.',
  DEPLOY_FAILED: 'The deployment failed.',
  DEPLOY_TIMEOUT: 'The deployment timed out.',
  HEALTH_CHECK_FAILED: 'The health check failed.',
  HEALTH_CHECK_TIMEOUT: 'The health check timed out.',
  PUBLIC_URL_UNREACHABLE: 'The public URL could not be reached.',
  WORKER_LOST: 'The deploy worker stopped responding.',
  INTERNAL_ERROR: 'An internal error occurred.',
};

export function deployErrorLabel(code: string): string {
  return DEPLOY_ERRORS[code] ?? code;
}

/** 커밋 SHA 는 앞 7자만 보여 준다 (ui-terms §1) */
export function shortSha(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : '—';
}

// 접속 실패 이유 (echo-was docs/api/environments.md, ConnectionErrorCode)
const CONNECTION_ERRORS: Record<string, string> = {
  TIMEOUT: 'The cluster did not answer in time.',
  SECRET_REF_MISSING: 'No secret reference is set.',
  SECRET_REF_INVALID: 'The secret reference is not valid.',
  SECRET_NOT_FOUND: 'The secret was not found on the API server.',
  SECRET_STORE_UNSUPPORTED: 'This secret store is not supported yet. Use env:.',
  CONFIG_INVALID: 'The saved settings are not valid for this provider.',
  AUTH_FAILED: 'The cluster rejected the credentials.',
  UNREACHABLE: 'The cluster could not be reached.',
  UNKNOWN: 'The connection check failed.',
};

export function connectionErrorLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return CONNECTION_ERRORS[code] ?? code;
}
