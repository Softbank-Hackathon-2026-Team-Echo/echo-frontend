// API 타입은 `pnpm gen:api` 로 만든 schema.d.ts 에서 꺼낸다. 화면 코드는 이 파일의 이름만 쓴다.
// 스키마가 바뀌면 gen:api 를 다시 돌리고, 이름이 바뀐 곳만 여기서 고친다.
import type { components } from './schema';

type Schemas = components['schemas'];

/** 성공·실패 공통 봉투. 실패 봉투는 data 없이 code·message·details 를 싣는다 */
export type ApiEnvelope<T> = {
  success?: boolean;
  code?: string | null;
  message?: string | null;
  data?: T | null;
  details?: ErrorDetail[] | null;
};

export type ErrorDetail = Schemas['ErrorDetail'];

export type Page<T> = {
  items: T[];
  total: number;
  /** 0부터 */
  page: number;
  size: number;
};

export const MEMBER_ROLES = ['VIEWER', 'DEVELOPER', 'ADMIN'] as const;
export type MemberRole = Schemas['OrganizationRole'];

export type User = Schemas['UserResponse'];
export type Organization = Schemas['OrganizationResponse'];
export type Member = Schemas['MemberResponse'];
export type MigrationPlan = Schemas['MigrationPlanDetailResponse'];
export type MigrationPlanSummary = Schemas['MigrationPlanSummaryResponse'];
export type MigrationPlanStatus = Schemas['MigrationPlanStatus'];
/** minObserveSeconds 는 새 비율 단계에만 있다. 옛 계획은 칸이 없거나 null 이다 */
export type MigrationStep = Schemas['MigrationStepResponse'];
export type CreateMigrationPlan = Schemas['CreateMigrationPlanRequest'];
export type ApproveMigrationPlan = Schemas['ApproveMigrationPlanRequest'];
/** DB 쓰기 전환 단계(DB_CUTOVER)의 Job 과 결과. 그 밖의 단계는 null (echo-was API 서버 17) */
export type StepCutover = Schemas['StepCutoverResponse'];
export type RollbackConditions = Schemas['RollbackConditionsRequest'];
export type Invitation = Schemas['InvitationResponse'];
export type AgentToken = Schemas['AgentTokenResponse'];
export type IssuedAgentToken = Schemas['IssuedAgentTokenResponse'];
export type CreateInvitation = Schemas['CreateInvitationRequest'];
export type CreateAgentToken = Schemas['CreateAgentTokenRequest'];
export type Me = Schemas['MeResponse'];
export type Disaster = Schemas['DisasterResponse'];
export type DisasterPlan = Schemas['DisasterPlanResponse'];
export type DisasterType = Schemas['DisasterType'];
export type PrecheckDetail = Schemas['PrecheckDetailResponse'];
export type PrecheckStatus = Schemas['AgentRunStatus'];
export type PrecheckPatch = Schemas['PrecheckPatchResponse'];
export type PrecheckProcessing = Schemas['AgentRunProcessingResponse'];
export type AiResidencySummary = Schemas['AiResidencySummaryResponse'];
export type CloudCosts = Schemas['CloudCostsResponse'];
export type AuditLog = Schemas['AuditLogResponse'];
export type ServiceVariable = Schemas['ServiceVariableResponse'];
export type AuditActorType = Schemas['ActorType'];
export type SecurityMatrix = Schemas['SecurityMatrixResponse'];
export type SecurityMatrixRow = Schemas['SecurityMatrixRowResponse'];
export type SecurityMatrixCell = Schemas['SecurityCellResponse'];
export type SecurityCompare = Schemas['SecurityCompareResponse'];
export type SecurityCompareRow = Schemas['SecurityCompareRowResponse'];
export type ServiceMetrics = Schemas['ServiceMetricsResponse'];
export type ServiceMetricsStatus = Schemas['ServiceMetricsStatus'];
export type ServiceMetricsSummary = Schemas['ServiceMetricsSummaryResponse'];
export type EnvironmentMetricsSeries = Schemas['EnvironmentMetricsSeriesResponse'];
export type SecurityControlCheck = Schemas['SecurityControlResponse'];
export type SecurityFinding = Schemas['SecurityFindingResponse'];
export type SecurityException = Schemas['SecurityExceptionResponse'];

export type ConnectionStatus = Schemas['EnvironmentSummaryResponse']['connectionStatus'];
/** 목록 항목. 저장된 값만 담고 clusterInfo 는 없다 */
export type EnvironmentSummary = Schemas['EnvironmentSummaryResponse'];
export type ClusterInfo = Schemas['ClusterInfoResponse'];
/** 상세. 부를 때 어댑터로 clusterInfo 를 읽는다 */
export type EnvironmentDetail = Schemas['EnvironmentDetailResponse'];
export type EnvironmentKind = Schemas['EnvironmentKindResponse'];
export type CreateEnvironment = Schemas['CreateEnvironmentRequest'];
export type UpdateEnvironment = Schemas['UpdateEnvironmentRequest'];

export type ServiceSummary = Schemas['ServiceSummaryResponse'];
export type ServiceDetail = Schemas['ServiceDetailResponse'];
export type ServiceEnvironment = Schemas['ServiceEnvironmentResponse'];
export type CreateOrganization = Schemas['CreateOrganizationRequest'];
export type CreateService = Schemas['CreateServiceRequest'];
export type UpdateService = Schemas['UpdateServiceRequest'];

export type DeployRequestStatus = Schemas['DeployRequestStatus'];
export type DeployRequestSummary = Schemas['DeployRequestSummaryResponse'];
export type DeployRequestDetail = Schemas['DeployRequestDetailResponse'];
export type CreateDeploy = Schemas['CreateDeployRequest'];
export type DeployTrigger = Schemas['DeployRequestTrigger'];
export type LogSource = Schemas['LogSource'];
export type SimulatedFailureStage = Schemas['SimulatedFailureStage'];

export type ServiceMetricsSeries = Schemas['EnvironmentMetricsSeriesResponse'];
export type LogLine = Schemas['LogLineResponse'];

export type DeployFailure = Schemas['FailureResponse'];
export type DiagnosisCategory = Schemas['DiagnosisCategory'];
export type PrecheckDiagnosis = Schemas['PrecheckDiagnosisResponse'];
export type DisasterSource = Schemas['DisasterSource'];
export type LiveFeedStatus = Schemas['LiveFeedStatusResponse'];
export type LiveFeedConnectionStatus = Schemas['LiveFeedConnectionStatus'];

/** 실패 진단 칸. 예전 기록에는 없다 */
export function deployFailure(request: { failure?: DeployFailure | null }): DeployFailure | null {
  return request.failure ?? null;
}
