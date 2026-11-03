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

export const PERMISSION_MESSAGE = "You don't have permission (Developer or above).";
export const UNAVAILABLE_MESSAGE = 'External service (GitHub, etc.) is not responding.';

// 409 이유 코드. 서버 message 는 개발용 문장이라 화면 문구는 code 로 고른다
const CONFLICT_MESSAGES: Record<string, string> = {
  ENVIRONMENT_UNHEALTHY: "This environment's last connection check failed. Fix it and check again.",
  ENVIRONMENT_IN_USE: 'This environment still has services on it.',
  SERVICE_DELETING: 'This service is being deleted.',
  LAST_ADMIN: 'An organization needs at least one admin.',
  ORGANIZATION_SLUG_CONFLICT: 'This URL name is already taken.',
  ORGANIZATION_SLUG_RESERVED: 'This URL name is reserved.',
  ALREADY_MEMBER: 'That GitHub user is already a member.',
  INVITATION_NOT_PENDING: 'This invitation was already accepted, expired or revoked.',
  NOT_ROLLBACKABLE: 'This deploy can no longer be rolled back to.',
  ALREADY_CURRENT: 'This version is already live on that environment.',
  MIGRATION_IN_PROGRESS: 'A migration is running for this service. Try again after it finishes.',
  MIGRATION_PLAN_OPEN: 'This service already has an open migration plan.',
  SOURCE_NOT_SINGLE: 'The service must be serving 100% from exactly one environment.',
  TARGET_SYNCING: 'The standby is still catching up to the latest version. Try again in a moment.',
  DEPLOY_IN_PROGRESS: 'A deploy is running for this service. Wait for it to finish.',
  TARGET_NOT_READY: 'The target has no deployment, or runs a different version.',
  PLAN_NOT_PENDING: 'This plan is no longer waiting for approval.',
  PLAN_NOT_RUNNING: 'This migration is not running.',
  PLAN_STALE: 'Environments changed after this plan was made. Create a new plan.',
  PLAN_EXPIRED: 'This plan expired after 24 hours. Create a new plan.',
};

/** 화면에 보여 줄 한 줄 문구. 모르는 코드는 서버 message 를 그대로 쓴다 */
export function describeApiError(error: unknown): string {
  if (!isApiError(error)) return 'Something went wrong. Please try again.';
  if (error.status === 403) return PERMISSION_MESSAGE;
  if (error.status === 502 || error.status === 503) return UNAVAILABLE_MESSAGE;
  if (error.status === 0) return 'Cannot reach the server. Check your connection.';
  return CONFLICT_MESSAGES[error.code] ?? error.message;
}

// 로그인 콜백 실패 코드 (계약 1-3장, echo-was docs/api/auth.md)
export const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  OAUTH_DENIED: 'You cancelled the sign-in on GitHub.',
  OAUTH_STATE_MISMATCH: 'Your sign-in session expired. Please try again.',
  GITHUB_UNAVAILABLE: 'GitHub is not responding. Please try again in a moment.',
  LOGIN_NOT_ALLOWED: 'This account is not allowed to sign in.',
  LOGIN_NOT_CONFIGURED: 'Sign-in is not set up yet. Please contact the operators.',
};

export const UNKNOWN_LOGIN_ERROR_MESSAGE = 'Sign-in failed. Please try again.';

export function describeLoginError(code: string): string {
  return LOGIN_ERROR_MESSAGES[code] ?? UNKNOWN_LOGIN_ERROR_MESSAGE;
}
