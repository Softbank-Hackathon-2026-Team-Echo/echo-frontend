import { k, t } from '../i18n';
import { describeApiError, isApiError } from './errors';

// 422 details[].reason → 칸 아래 문구. 모르는 이유는 코드를 사람이 읽게 바꿔 보여 준다
const REASONS: Record<string, string> = {
  INVALID_SECRET_REF: k(
    'Use a secret location like env:ECHO_SECRET_…, k8s:ns/secret/key, aws-sm:… or gcp-sm:…',
  ),
  SECRET_REF_NOT_IN_ORGANIZATION: k(
    "env: secrets must start with this organization's ECHO_SECRET_<ORG>__ prefix.",
  ),
  INVALID_REPO_URL: k('Use https://github.com/<owner>/<repo>.'),
  EXACTLY_ONE_OF_BRANCH_OR_COMMIT_SHA: k('Enter a branch or a commit, not both.'),
  ENVIRONMENT_NAME_CONFLICT: k('This name is already used in this organization.'),
  SERVICE_NAME_CONFLICT: k('This name is already used in this organization.'),
  GITHUB_USER_NOT_FOUND: k('No GitHub user has this username.'),
  ALREADY_MEMBER: k('That GitHub user is already a member.'),
  EXPIRES_IN_DAYS_TOO_LONG: k('Tokens can last at most 90 days.'),
  SAME_ENVIRONMENT: k('The target must be a different environment from the source.'),
  NO_DEPLOYMENT: k('The target has no deployment of this service yet. Deploy to it first.'),
  VERSION_MISMATCH: k(
    'The target runs a different version. Wait for the standby to sync, or deploy to it.',
  ),
  LAST_SYNC_FAILED: k('The last standby sync failed.'),
  SIMULATE_NOT_ALLOWED: k('Failure injection only works while the API runs simulated executors.'),
  SIMULATE_REASON_STEP_MISMATCH: k('That failure cannot happen at this step.'),
};

function reasonText(reason: string): string | undefined {
  const text = REASONS[reason];
  return text ? t(text) : undefined;
}

function humanize(reason: string): string {
  const text = reason.toLowerCase().replaceAll('_', ' ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/**
 * 서버 오류를 폼 칸 오류로 바꾼다. details[].field 는 camelCase 경로(`config.region`)다.
 * 칸에 붙지 않는 오류는 `_form` 에 담는다.
 */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!error) return {};
  if (!isApiError(error)) return { _form: describeApiError(error) };
  const errors: Record<string, string> = {};
  for (const detail of error.details) {
    if (detail.field === 'installUrl') continue;
    const field = detail.field.replace(/^body\./, '');
    errors[field] = reasonText(detail.reason) ?? humanize(detail.reason);
  }
  if (Object.keys(errors).length === 0) {
    errors._form = reasonText(error.code) ?? describeApiError(error);
  }
  return errors;
}

/** 칸에 붙일 곳이 없는 오류(409 의 details 등)까지 한 문장으로. 폼 아래 한 줄 오류에 쓴다 */
export function formErrorMessage(
  error: unknown,
  shownFields: readonly string[],
): string | undefined {
  if (!error) return undefined;
  const errors = fieldErrors(error);
  if (shownFields.some((field) => errors[field])) return errors._form;
  const reasons = isApiError(error)
    ? error.details.map((detail) => reasonText(detail.reason)).filter(Boolean)
    : [];
  return [describeApiError(error), ...reasons].join(' ');
}
