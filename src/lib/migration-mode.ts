// 이전 종류. API 에 칸이 없어(계약 4-6 mode 🆕) 같은 서비스의 앞선 성공 이전을 거꾸로 되짚는지로 Failback 을 가린다
type PlanRoute = {
  id: string;
  serviceId: string;
  sourceEnvironmentId: string;
  targetEnvironmentId: string;
  status: string;
  createdAt: string;
};

export function isFailback(plan: PlanRoute, plans: readonly PlanRoute[]): boolean {
  return plans.some(
    (other) =>
      other.id !== plan.id &&
      other.serviceId === plan.serviceId &&
      other.status === 'SUCCEEDED' &&
      other.createdAt < plan.createdAt &&
      other.sourceEnvironmentId === plan.targetEnvironmentId &&
      other.targetEnvironmentId === plan.sourceEnvironmentId,
  );
}
