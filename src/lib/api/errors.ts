import { k, t } from '../i18n';
import type { ErrorDetail } from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ErrorDetail[];
  readonly requestId: string | null;

  constructor(params: {
    status: number;
    code: string;
    message: string;
    details?: ErrorDetail[];
    requestId?: string | null;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status;
    this.code = params.code;
    this.details = params.details ?? [];
    this.requestId = params.requestId ?? null;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** 4xx 는 다시 보내도 결과가 같다. 재시도하지 않는다 */
export function isClientError(error: unknown): boolean {
  return isApiError(error) && error.status >= 400 && error.status < 500;
}

export const PERMISSION_MESSAGE = k("You don't have permission (Developer or above).");
export const UNAVAILABLE_MESSAGE = k('External service (GitHub, etc.) is not responding.');

// 409 이유 코드. 서버 message 는 개발용 문장이라 화면 문구는 code 로 고른다
const CONFLICT_MESSAGES: Record<string, string> = {
  ENVIRONMENT_UNHEALTHY: k(
    "This environment's last connection check failed. Fix it and check again.",
  ),
  ENVIRONMENT_IN_USE: k('This environment still has services on it.'),
  SERVICE_DELETING: k('This service is being deleted.'),
  LAST_ADMIN: k('An organization needs at least one admin.'),
  ORGANIZATION_SLUG_CONFLICT: k('This URL name is already taken.'),
  ORGANIZATION_SLUG_RESERVED: k('This URL name is reserved.'),
  ALREADY_MEMBER: k('That GitHub user is already a member.'),
  INVITATION_NOT_PENDING: k('This invitation was already accepted, expired or revoked.'),
  NOT_ROLLBACKABLE: k('This deploy can no longer be rolled back to.'),
  ALREADY_CURRENT: k('This version is already live on that environment.'),
  MIGRATION_IN_PROGRESS: k('A migration is running for this service. Try again after it finishes.'),
  MIGRATION_PLAN_OPEN: k('This service already has an open migration plan.'),
  SOURCE_NOT_SINGLE: k('The service must be serving 100% from exactly one environment.'),
  TARGET_SYNCING: k(
    'The standby is still catching up to the latest version. Try again in a moment.',
  ),
  DEPLOY_IN_PROGRESS: k('A deploy is running for this service. Wait for it to finish.'),
  TARGET_NOT_READY: k('The target has no deployment, or runs a different version.'),
  PLAN_NOT_PENDING: k('This plan is no longer waiting for approval.'),
  PLAN_NOT_RUNNING: k('This migration is not running.'),
  PLAN_STALE: k('Environments changed after this plan was made. Create a new plan.'),
  PLAN_EXPIRED: k('This plan expired after 24 hours. Create a new plan.'),
  SECURITY_GATE_BLOCKED: k('The security gate blocked this migration.'),
  DISASTER_ACTIVE: k('The target is inside an active disaster. End the disaster first.'),
  DISASTER_NOT_ACTIVE: k('This disaster has already ended.'),
  RUN_NOT_ACTIVE: k('This pre-check has already finished.'),
  RUN_NOT_SUCCEEDED: k('Only a finished pre-check can have its patches decided.'),
  PATCH_STALE: k('This patch changed. Refresh and try again.'),
  PATCH_ALREADY_DECIDED: k('Someone already decided this patch.'),
  PATCH_BLOCKED: k('This patch is blocked and cannot be approved.'),
  SECRET_STORE_NOT_CONFIGURED: k('The secret store is not set up, so the value was not saved.'),
};

/** 화면에 보여 줄 한 줄 문구. 모르는 코드는 서버 message 를 그대로 쓴다 */
export function describeApiError(error: unknown): string {
  if (!isApiError(error)) return t('Something went wrong. Please try again.');
  if (error.status === 403) return t(PERMISSION_MESSAGE);
  if (error.status === 502 || error.status === 503) return t(UNAVAILABLE_MESSAGE);
  if (error.status === 0) return t('Cannot reach the server. Check your connection.');
  if (error.code === 'PATCH_STALE' && error.details[0]?.reason === 'PRECHECK_EXPIRED') {
    return t('This pre-check expired. Run it again.');
  }
  const conflict = CONFLICT_MESSAGES[error.code];
  if (conflict) return t(conflict);
  // error.message 는 오류 추적에도 나가서 영어로 두고, 화면 문구만 여기서 바꾼다
  if (error.code === 'UNEXPECTED_RESPONSE') {
    return t('Unexpected response ({{status}})', { status: error.status });
  }
  return error.message;
}

// 로그인 콜백 실패 코드 (계약 1-3장, echo-was docs/api/auth.md)
export const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  OAUTH_DENIED: k('You cancelled the sign-in on GitHub.'),
  OAUTH_STATE_MISMATCH: k('Your sign-in session expired. Please try again.'),
  GITHUB_UNAVAILABLE: k('GitHub is not responding. Please try again in a moment.'),
  LOGIN_NOT_ALLOWED: k('This account is not allowed to sign in.'),
  LOGIN_NOT_CONFIGURED: k('Sign-in is not set up yet. Please contact the operators.'),
};

export const UNKNOWN_LOGIN_ERROR_MESSAGE = k('Sign-in failed. Please try again.');

export function describeLoginError(code: string): string {
  return t(LOGIN_ERROR_MESSAGES[code] ?? UNKNOWN_LOGIN_ERROR_MESSAGE);
}
