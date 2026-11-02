// TODO(김도영, 2026-11-02): echo-was OpenAPI 를 받으면 `pnpm gen:api` 로 만든 schema.d.ts 의 타입으로 바꾼다.
// 지금은 echo-was app/schemas 와 docs/api/*.md 모양대로 손으로 쓴다. 칸은 항상 있고 값이 없으면 null 이다.

/** 성공 봉투. 실패 봉투는 data 없이 code·message·details 를 싣는다 */
export type ApiEnvelope<T> = {
  success: boolean;
  code?: string;
  message?: string;
  data?: T | null;
  details?: ErrorDetail[];
};

export type ErrorDetail = {
  field: string;
  reason: string;
  value?: string;
};

export type Page<T> = {
  items: T[];
  total: number;
  /** 0부터 */
  page: number;
  size: number;
};

export const MEMBER_ROLES = ['VIEWER', 'DEVELOPER', 'ADMIN'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export type User = {
  id: string;
  githubLogin: string;
  name: string | null;
  avatarUrl: string | null;
};

export type Organization = {
  id: string;
  slug: string;
  name: string;
  personal: boolean;
  /** 서버는 모르는 값을 보낼 수 있다. 화면은 MemberRole 이 아니면 권한 없음으로 본다 */
  role: MemberRole | null;
  createdAt: string;
};

export type Me = {
  user: User;
  organizations: Organization[];
};

export type ConnectionStatus = 'UNCHECKED' | 'CONNECTED' | 'FAILED';

/** 목록 항목. 저장된 값만 담고 clusterInfo 는 없다 */
export type EnvironmentSummary = {
  id: string;
  name: string;
  /** aws · gcp · onprem. 종류는 서버 레지스트리라 다른 값이 올 수 있다 */
  kind: string;
  location: string | null;
  config: Record<string, unknown> | null;
  secretRef: string | null;
  connectionStatus: ConnectionStatus;
  connectionCheckedAt: string | null;
  connectionError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClusterInfo = {
  serverVersion: string;
  nodeCount: number;
  simulated: boolean;
};

/** 상세. 부를 때 어댑터로 clusterInfo 를 읽는다 */
export type EnvironmentDetail = EnvironmentSummary & {
  clusterInfo: ClusterInfo | null;
  clusterInfoError: string | null;
};
