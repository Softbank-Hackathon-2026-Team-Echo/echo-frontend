// 서버 상태 값 → 화면 문구·색. 상태 표시는 여기와 StatusBadge 한 곳에서만 정한다 (ui-terms §4)
import type { PrecheckProcessing } from '@/lib/api/types';
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
  CRITICAL: k('Critical'),
  HIGH: k('High'),
  MEDIUM: k('Medium'),
  LOW: k('Low'),
};

export function securitySeverityLabel(severity: string): string {
  return labelOf(SECURITY_SEVERITIES, severity);
}

const SECURITY_EXCEPTION_STATUSES: Record<string, StatusView> = {
  ACTIVE: { label: k('Active'), tone: 'warning' },
  PENDING: { label: k('Waiting for approval'), tone: 'neutral' },
  EXPIRED: { label: k('Expired'), tone: 'neutral' },
  REVOKED: { label: k('Revoked'), tone: 'neutral' },
};

export function securityExceptionStatusView(status: string): StatusView {
  return viewOf(SECURITY_EXCEPTION_STATUSES, status);
}

const SECURITY_REASONS: Record<string, string> = {
  CONTROL_FAILED: k('Failed this control'),
  CONTROL_WARNING: k('Warning on this control'),
  EVIDENCE_UNKNOWN: k('Evidence could not be read'),
  EVIDENCE_MISSING: k('No evidence collected'),
  EVIDENCE_EXPIRED: k('Evidence expired'),
  EVIDENCE_SIMULATED: k('Evidence is simulated'),
  EVIDENCE_INCOMPLETE: k('Evidence is incomplete'),
  SOURCE_NOT_ALLOWED: k('Source is not allowed for this control'),
  SCOPE_MISMATCH: k('Evidence is for a different version'),
  POLICY_VERSION_MISMATCH: k('Evidence is from another policy version'),
  PRECHECK_MISSING: k('AI pre-check has not run'),
  AI_UNCONFIRMED: k('AI finding is not confirmed by a person'),
  AI_ESCALATED: k('AI finding was escalated by a person'),
  EXCEPTION_APPLIED: k('Time-limited exception applied'),
  EXCEPTION_EXPIRED: k('Exception expired'),
  NOT_APPLICABLE: k('Does not apply here'),
};

export function securityReasonLabel(reason: string): string {
  return labelOf(SECURITY_REASONS, reason);
}

// 재난이 만든 이전 계획 (echo-was docs/api/disasters.md)
const DISASTER_PLAN_REASONS: Record<string, string> = {
  NO_SAFE_TARGET: k('No safe standby to move to'),
  SELF_APPROVAL_DISABLED: k('Self-approval is off, so another developer has to approve'),
  SOURCE_NOT_AFFECTED: k('Traffic already left the affected environment'),
  SECURITY_GATE_BLOCKED: k('The security gate is holding it'),
  MIGRATION_PLAN_OPEN: k('This service already has an open migration plan'),
  TARGET_NOT_READY: k('The target has no deployment, or runs a different version'),
  TARGET_SYNCING: k('The standby is still catching up'),
  DEPLOY_IN_PROGRESS: k('A deploy is running for this service'),
  SOURCE_NOT_SINGLE: k('The service is not on exactly one environment'),
  SERVICE_DELETING: k('This service is being deleted'),
  ENVIRONMENT_UNHEALTHY: k('The target failed its last connection check'),
  DISASTER_ACTIVE: k('The target is inside an active disaster'),
  INTERNAL_ERROR: k('Internal error'),
};

export function disasterPlanReasonLabel(reason: string): string {
  return labelOf(DISASTER_PLAN_REASONS, reason);
}

// AI 사전 점검
const PRECHECK_STATUSES: Record<string, StatusView> = {
  QUEUED: { label: k('Waiting for a runner'), tone: 'neutral' },
  CLAIMED: { label: k('Running'), tone: 'ai' },
  RUNNING: { label: k('Running'), tone: 'ai' },
  SUCCEEDED: { label: k('Succeeded'), tone: 'success' },
  FAILED: { label: k('Failed'), tone: 'danger' },
  TIMED_OUT: { label: k('Timed out'), tone: 'danger' },
  CANCELLED: { label: k('Cancelled'), tone: 'neutral' },
};

export function precheckStatusView(status: string): StatusView {
  return viewOf(PRECHECK_STATUSES, status);
}

const PRECHECK_STEPS: Record<string, string> = {
  SANDBOX_CREATE: k('Sandbox created'),
  INPUT_LOAD: k('Input loaded'),
  CONFIG_DIFF: k('Config diff'),
  ANALYZE: k('Analysis'),
  PATCH_PROPOSE: k('Patch proposed'),
  PATCH_VERIFY: k('Patch verified'),
  SANDBOX_DELETE: k('Sandbox deleted'),
};

export function precheckStepLabel(step: string): string {
  return labelOf(PRECHECK_STEPS, step);
}

const PRECHECK_FAILURES: Record<string, string> = {
  RUNNER_ERROR: k('The runner hit an error.'),
  DEADLINE: k('The runner ran out of time.'),
  DEADLINE_EXCEEDED: k('No result arrived before the 15 minute deadline.'),
  LEASE_EXPIRED: k('The runner stopped responding.'),
  INPUT_INVALID: k('The runner could not read the input.'),
  KIND_UNSUPPORTED: k('The runner does not support this check.'),
  PATCH_HASH_MISMATCH: k('The patch changed after approval, so it was not applied.'),
  PATCH_TARGET_FORBIDDEN: k('The patch targets a file it may not change.'),
  PATCH_APPLY_FAILED: k('The patch did not apply to the sandbox copy.'),
  VERIFY_UNAVAILABLE: k('The sandbox tools were unavailable, so nothing was verified.'),
  SOURCE_UNAVAILABLE: k('The sandbox could not fetch the source.'),
  IMAGE_BUILD_FAILED: k('The image build failed in the sandbox.'),
  IMAGE_SCAN_FAILED: k('The image scan found problems in the sandbox.'),
  HEALTHZ_FAILED: k('The app failed its health check in the sandbox.'),
};

export function precheckFailureLabel(code: string): string {
  return labelOf(PRECHECK_FAILURES, code);
}

const PATCH_BLOCK_REASONS: Record<string, string> = {
  PROTECTED_FILES_TOUCHED: k('Touches protected files'),
  CHECKS_MISSING: k('No verification checks ran'),
  CHECK_NOT_PASSED: k('A verification check did not pass'),
};

export function patchBlockReasonLabel(reason: string): string {
  return labelOf(PATCH_BLOCK_REASONS, reason);
}

const PATCH_STATUSES: Record<string, StatusView> = {
  BLOCKED: { label: k('Blocked'), tone: 'danger' },
  REJECTED: { label: k('Rejected'), tone: 'neutral' },
  APPROVED: { label: k('Approved · waiting to apply'), tone: 'success' },
  APPLIED: { label: k('Applied'), tone: 'success' },
  APPLY_FAILED: { label: k('Apply failed'), tone: 'danger' },
};

/** 승인 전(PROPOSED)은 버튼을 보여서 배지가 없다 */
export function patchStatusView(status: string): StatusView | null {
  if (status === 'PROPOSED') return null;
  return viewOf(PATCH_STATUSES, status);
}

/** 사전 점검 처리 위치. 기록이 없다고 밖으로 안 나갔다는 뜻은 아니다 */
export function processingView(processing: PrecheckProcessing | null | undefined): StatusView {
  if (!processing) return { label: t('No processing record'), tone: 'neutral' };
  if (!processing.externalTransfer) {
    const place = processing.sandbox ? t('sandbox') : null;
    return {
      label: [t('No external transfer'), processing.location, place].filter(Boolean).join(' · '),
      tone: 'success',
    };
  }
  // 리전을 고를 수 없는 Anthropic 호출은 금지 등급을 안 넘기면 정책이 허용한다(echo-was #80). 위반으로 보이지 않게 한다
  const regionlessAllowed =
    processing.modelProvider === 'ANTHROPIC' &&
    !processing.modelRegion &&
    !processing.dataClasses.includes('SECRETS');
  if (regionlessAllowed) {
    return {
      label: [t('Overseas model · no secrets sent'), processing.model].filter(Boolean).join(' · '),
      tone: 'ai',
    };
  }
  return {
    label: [
      t('External transfer'),
      [processing.modelProvider, processing.model].filter(Boolean).join(' '),
      processing.dataClasses.join(', '),
    ]
      .filter(Boolean)
      .join(' · '),
    tone: processing.dataClasses.includes('SECRETS') ? 'danger' : 'warning',
  };
}

const RESIDENCY_REASONS: Record<string, string> = {
  MODEL_REGION_NOT_ALLOWED: k('Model region is not on the allowed list'),
  FORBIDDEN_CLASS_SENT_EXTERNALLY: k('A forbidden data class was sent outside'),
};

export function residencyReasonLabel(reason: string): string {
  return labelOf(RESIDENCY_REASONS, reason);
}

/** 비교 표 판정 칸 */
export function securityCompareNote(row: {
  source: { result: string };
  target: { result: string };
  blocksMigration: boolean;
  change: string;
}): string {
  if (row.blocksMigration) return t('blocks migration');
  if (row.source.result === 'UNKNOWN' || row.target.result === 'UNKNOWN') return t('not collected');
  if (row.target.result === 'WARN') return t('warning only');
  if (row.change === 'WORSE') return t('worse on target');
  if (row.change === 'BETTER') return t('better on target');
  return row.change === 'SAME' ? t('same') : t('differs');
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
  SECURITY_GATE_BLOCKED: k('Blocked by the security gate'),
  DB_CUTOVER_FAILED: k('DB writer cutover failed'),
  DB_CUTOVER_TIMEOUT: k('DB writer cutover timed out'),
  DB_CUTOVER_PARTIAL: k('DB writer cutover stopped halfway'),
  DATA_INTEGRITY_FAILED: k('Rows are missing or duplicated after the cutover'),
  WORKER_LOST: k('The worker stopped responding'),
  INTERNAL_ERROR: k('Internal error'),
};

/**
 * 단계까지 아는 실패 이유. 데이터 확인에서 지표를 못 받으면 역방향 복제가 없는 복귀일 수 있다.
 * 역방향 복제는 DB 쓰기 전환 때 생겨서, 시연 순서를 놓쳐도 화면에서 바로 알게 한다
 */
export function migrationFailureLabel(code: string, stepKind: string | undefined): string {
  if (code === 'METRICS_UNAVAILABLE' && stepKind === 'DATA_SYNC_CHECK') {
    return t('Replication lag could not be read. A failback needs the DB cutover first');
  }
  return migrationErrorLabel(code);
}

/** 계획이 끝난 이유. 어느 단계에서 실패했는지 찾아 위 문구를 고른다 */
export function planFailureLabel(plan: {
  errorCode: string | null;
  steps: { kind: string; result?: { failureCode?: string | null } | null }[];
}): string | null {
  if (!plan.errorCode) return null;
  const failed = plan.steps.find((step) => step.result?.failureCode === plan.errorCode);
  return migrationFailureLabel(plan.errorCode, failed?.kind);
}

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
