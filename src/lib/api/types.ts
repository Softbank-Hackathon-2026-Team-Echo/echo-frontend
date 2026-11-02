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
export type Me = Schemas['MeResponse'];

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
export type CreateService = Schemas['CreateServiceRequest'];

export type DeployRequestStatus = Schemas['DeployRequestStatus'];
export type DeployRequestSummary = Schemas['DeployRequestSummaryResponse'];
export type DeployRequestDetail = Schemas['DeployRequestDetailResponse'];
export type CreateDeploy = Schemas['CreateDeployRequest'];
export type SimulatedFailureStage = Schemas['SimulatedFailureStage'];
