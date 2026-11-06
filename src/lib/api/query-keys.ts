// 조직 리소스 키는 ['org', orgId, …] 로 시작한다. 조직을 바꾸거나 실시간 resync 때 그 조직 키만 무효화한다
export const queryKeys = {
  me: () => ['me'] as const,
  session: () => ['me', 'session'] as const,
  environmentKinds: () => ['environment-kinds'] as const,
  org: (orgId: string) => ['org', orgId] as const,
  environments: (orgId: string) => ['org', orgId, 'environments'] as const,
  environment: (orgId: string, environmentId: string) =>
    ['org', orgId, 'environments', environmentId] as const,
  services: (orgId: string) => ['org', orgId, 'services'] as const,
  service: (orgId: string, serviceId: string) => ['org', orgId, 'services', serviceId] as const,
  serviceVariables: (orgId: string, serviceId: string, environmentId: string) =>
    ['org', orgId, 'services', serviceId, 'variables', environmentId] as const,
  deployRequests: (orgId: string, serviceId: string) =>
    ['org', orgId, 'services', serviceId, 'deploy-requests'] as const,
  standbySyncs: (orgId: string, serviceId: string, sourceStatus: string) =>
    ['org', orgId, 'services', serviceId, 'standby-syncs', sourceStatus] as const,
  serviceMetrics: (orgId: string, serviceId: string, range: string) =>
    ['org', orgId, 'services', serviceId, 'metrics', range] as const,
  serviceActivity: (orgId: string, serviceName: string) =>
    ['org', orgId, 'audit', 'service', serviceName] as const,
  deployRequest: (orgId: string, deployRequestId: string) =>
    ['org', orgId, 'deploy-requests', deployRequestId] as const,
  deployLogs: (orgId: string, deployRequestId: string, source: string) =>
    ['org', orgId, 'deploy-requests', deployRequestId, 'logs', source] as const,
  disasters: (orgId: string) => ['org', orgId, 'disasters'] as const,
  members: (orgId: string) => ['org', orgId, 'members'] as const,
  invitations: (orgId: string) => ['org', orgId, 'invitations'] as const,
  agentTokens: (orgId: string) => ['org', orgId, 'agent-tokens'] as const,
  evacuation: (orgId: string) => ['org', orgId, 'evacuation'] as const,
  prechecks: (orgId: string) => ['org', orgId, 'prechecks'] as const,
  precheck: (orgId: string, precheckId: string) => ['org', orgId, 'prechecks', precheckId] as const,
  precheckLogs: (orgId: string, precheckId: string) =>
    ['org', orgId, 'prechecks', precheckId, 'logs'] as const,
  migrations: (orgId: string) => ['org', orgId, 'migrations'] as const,
  migrationPlans: (orgId: string, serviceId: string) =>
    ['org', orgId, 'migrations', 'service', serviceId] as const,
  migrationPlan: (orgId: string, planId: string) => ['org', orgId, 'migrations', planId] as const,
  migrationLogs: (orgId: string, planId: string) =>
    ['org', orgId, 'migrations', planId, 'logs'] as const,
  cloudCosts: (orgId: string) => ['org', orgId, 'costs'] as const,
  aiResidency: (orgId: string) => ['org', orgId, 'ai-residency'] as const,
  security: (orgId: string) => ['org', orgId, 'security'] as const,
  securityMatrix: (orgId: string) => ['org', orgId, 'security', 'matrix'] as const,
  securityExceptions: (orgId: string) => ['org', orgId, 'security', 'exceptions'] as const,
  securityFindings: (orgId: string) => ['org', orgId, 'security', 'findings'] as const,
  securityCellFindings: (orgId: string, findingIds: string[]) =>
    ['org', orgId, 'security', 'findings', findingIds] as const,
  audit: (orgId: string) => ['org', orgId, 'audit'] as const,
  auditLogs: (orgId: string, filters: { actorType?: string; q?: string }) =>
    ['org', orgId, 'audit', 'logs', filters] as const,
  recentActivity: (orgId: string) => ['org', orgId, 'audit', 'recent'] as const,
};
