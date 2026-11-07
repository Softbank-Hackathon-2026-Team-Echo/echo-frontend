import type { AuditLog } from '@/lib/api/types';
import { k, t } from '@/lib/i18n';
import type { StatusView } from '@/lib/status';

// 행위자와 행동은 두 칸이다. 문장으로 잇지 않고 '이전 계획 승인' 처럼 행동만 적는다
const ACTIONS: Record<string, string> = {
  ORGANIZATION_CREATED: k('created organization'),
  ORGANIZATION_SETTINGS_CHANGED: k('changed organization settings'),
  MEMBER_ROLE_CHANGED: k('changed member role'),
  MEMBER_REMOVED: k('removed member'),
  MEMBER_JOINED: k('joined organization'),
  INVITATION_CREATED: k('invited member'),
  INVITATION_REVOKED: k('revoked invitation'),
  AGENT_TOKEN_ISSUED: k('issued agent token'),
  AGENT_TOKEN_REVOKED: k('revoked agent token'),
  ENVIRONMENT_CREATED: k('registered environment'),
  ENVIRONMENT_UPDATED: k('updated environment'),
  ENVIRONMENT_DELETED: k('deleted environment'),
  ENVIRONMENT_CONNECTION_CHECKED: k('checked environment connection'),
  SERVICE_CREATED: k('registered service'),
  SERVICE_UPDATED: k('updated service'),
  SERVICE_DELETE_REQUESTED: k('requested service deletion'),
  SERVICE_DELETED: k('finished service deletion'),
  SERVICE_VARIABLE_SET: k('set app variable'),
  SERVICE_VARIABLE_DELETED: k('deleted app variable'),
  SERVICE_VARIABLE_COPIED: k('copied app variable'),
  DEPLOY_REQUESTED: k('requested deploy'),
  DEPLOY_FINISHED: k('finished deploy'),
  ROLLBACK_REQUESTED: k('requested rollback'),
  ROLLBACK_FINISHED: k('finished rollback'),
  MIGRATION_PLAN_CREATED: k('created migration plan'),
  MIGRATION_PLAN_APPROVED: k('approved migration plan'),
  MIGRATION_PLAN_REJECTED: k('rejected migration plan'),
  MIGRATION_PLAN_CANCELLED: k('cancelled migration plan'),
  MIGRATION_ABORT_REQUESTED: k('requested migration abort'),
  MIGRATION_FINISHED: k('finished migration'),
  MIGRATION_DB_CUTOVER_STARTED: k('started DB writer cutover'),
  MIGRATION_DB_CUTOVER_FINISHED: k('finished DB writer cutover'),
  DISASTER_DECLARED: k('declared disaster'),
  DISASTER_ENDED: k('ended disaster'),
  // echo-was #132: 예비가 없어 이전을 만들지 않은 서비스는 선언과 다른 행동으로 남긴다
  DISASTER_EVACUATION_SKIPPED: k('skipped evacuation (no safe standby)'),
  DISASTER_EVACUATION_REQUESTED: k('requested evacuation plan'),
  DISASTER_FEED_INJECTED: k('injected feed event'),
  DIAGNOSIS_REQUESTED: k('requested AI diagnosis'),
  CVE_DIAGNOSIS_REQUESTED: k('requested CVE diagnosis'),
  CVE_WATCH_CHECKED: k('checked CVE watch'),
  CVE_WATCH_INJECTED: k('injected CVE advisory'),
  SECURITY_EXCEPTION_REQUESTED: k('requested security exception'),
  SECURITY_EXCEPTION_APPROVED: k('approved security exception'),
  SECURITY_EXCEPTION_REVOKED: k('revoked security exception'),
  PRECHECK_REQUESTED: k('requested AI pre-check'),
  PRECHECK_CANCELLED: k('cancelled AI pre-check'),
  AGENT_PATCH_APPROVED: k('approved AI patch'),
  AGENT_PATCH_REJECTED: k('rejected AI patch'),
  AGENT_RUN_CLAIMED: k('started AI run'),
  AGENT_RUN_FINISHED: k('finished AI run'),
  AGENT_RUN_TIMED_OUT: k('AI run timed out'),
  RESOURCE_READ: k('read a resource'),
};

/** 표에 없는 행동(옛 거부 줄의 `POST /api/…` 등)은 null 이고, 화면은 서버 값을 그대로 보인다 */
export function auditActionLabel(action: string): string | null {
  const label = ACTIONS[action];
  return label ? t(label) : null;
}

export function auditActorName(actor: AuditLog['actor']): string {
  if (actor.type === 'USER') return actor.githubLogin ?? t('Unknown user');
  if (actor.type === 'AGENT') return actor.agentTokenName ?? t('AI Agent');
  return t('System');
}

const RESULTS: Record<string, StatusView> = {
  SUCCEEDED: { label: k('Succeeded'), tone: 'success' },
  DENIED: { label: k('Denied'), tone: 'danger' },
  FAILED: { label: k('Failed'), tone: 'danger' },
};

export function auditResultView(result: string): StatusView {
  const view = RESULTS[result];
  return view ? { ...view, label: t(view.label) } : { label: result, tone: 'neutral' };
}
