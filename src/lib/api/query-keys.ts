// 조직 리소스 키는 ['org', orgId, …] 로 시작한다. 조직을 바꾸거나 실시간 resync 때 그 조직 키만 무효화한다
export const queryKeys = {
  me: () => ['me'] as const,
  org: (orgId: string) => ['org', orgId] as const,
  environments: (orgId: string) => ['org', orgId, 'environments'] as const,
  environment: (orgId: string, environmentId: string) =>
    ['org', orgId, 'environments', environmentId] as const,
};
