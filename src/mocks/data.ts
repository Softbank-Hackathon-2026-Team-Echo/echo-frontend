// MOCK: 프론트 목업 데이터. 모양은 echo-was app/schemas · docs/api/*.md 와 같다. 실제 토큰·비밀값은 넣지 않는다
import type { EnvironmentDetail, EnvironmentSummary, Me, Organization } from '@/lib/api/types';

const CREATED_AT = '2026-11-02T00:00:00Z';

export const mockOrganizations: Organization[] = [
  {
    id: '0b6f2c3e-1d2a-4c55-9e1a-6f0e5c7a1001',
    slug: 'echoport',
    name: 'echoport',
    personal: true,
    role: 'ADMIN',
    createdAt: CREATED_AT,
  },
  {
    id: '0b6f2c3e-1d2a-4c55-9e1a-6f0e5c7a1002',
    slug: 'echo-demo',
    name: 'Echo Demo',
    personal: false,
    role: 'DEVELOPER',
    createdAt: CREATED_AT,
  },
];

export const mockMe: Me = {
  user: {
    id: '7d1e4a90-55b3-4f0e-8c2d-2a9b6e3f2001',
    githubLogin: 'echoport',
    name: 'EchoPort Demo',
    avatarUrl: null,
  },
  organizations: mockOrganizations,
};

function summary(
  partial: Pick<EnvironmentSummary, 'id' | 'name' | 'kind' | 'location' | 'config'> &
    Partial<EnvironmentSummary>,
): EnvironmentSummary {
  return {
    secretRef: null,
    connectionStatus: 'UNCHECKED',
    connectionCheckedAt: null,
    connectionError: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...partial,
  };
}

export const mockEnvironments: EnvironmentSummary[] = [
  summary({
    id: '3c0f8e21-9a4b-4d6e-b1c2-5e7f9a0b3001',
    name: 'aws-tokyo-prod',
    kind: 'aws',
    location: 'ap-northeast-1',
    config: { region: 'ap-northeast-1', clusterName: 'echo-prod' },
    secretRef: 'env:ECHO_SECRET_ECHOPORT__AWS_TOKYO',
    connectionStatus: 'CONNECTED',
    connectionCheckedAt: '2026-11-02T06:00:00Z',
  }),
  summary({
    id: '3c0f8e21-9a4b-4d6e-b1c2-5e7f9a0b3002',
    name: 'gcp-seoul-standby',
    kind: 'gcp',
    location: 'asia-northeast3',
    config: { projectId: 'echo-hack-123', region: 'asia-northeast3', clusterName: 'echo-standby' },
    secretRef: 'env:ECHO_SECRET_ECHOPORT__GCP_SEOUL',
    connectionStatus: 'CONNECTED',
    connectionCheckedAt: '2026-11-02T06:00:00Z',
  }),
  summary({
    id: '3c0f8e21-9a4b-4d6e-b1c2-5e7f9a0b3003',
    name: 'onprem-fukuoka',
    kind: 'onprem',
    location: 'fukuoka',
    config: { location: 'fukuoka', kubeContext: 'k3s-fukuoka' },
    secretRef: 'env:ECHO_SECRET_ECHOPORT__ONPREM_FUKUOKA',
  }),
];

const CLUSTER_INFO: Record<string, EnvironmentDetail['clusterInfo']> = {
  'aws-tokyo-prod': { serverVersion: 'v1.31.0', nodeCount: 3, simulated: true },
  'gcp-seoul-standby': { serverVersion: 'v1.31.0', nodeCount: 2, simulated: true },
  'onprem-fukuoka': { serverVersion: 'v1.30.4+k3s1', nodeCount: 1, simulated: true },
};

export function mockEnvironmentDetail(environment: EnvironmentSummary): EnvironmentDetail {
  return {
    ...environment,
    clusterInfo: CLUSTER_INFO[environment.name] ?? null,
    clusterInfoError: null,
  };
}
