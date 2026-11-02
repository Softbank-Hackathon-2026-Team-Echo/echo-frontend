// 서버 상태 값 → 화면 문구·색. 상태 표시는 여기와 StatusBadge 한 곳에서만 정한다 (ui-terms §4)

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'migrating' | 'ai';

export type StatusView = { label: string; tone: Tone };

const CONNECTION: Record<string, StatusView> = {
  UNCHECKED: { label: 'Not checked', tone: 'neutral' },
  CONNECTED: { label: 'Connected', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
};

/** 모르는 값은 원래 값을 그대로 중립 색으로 보여 준다 */
export function connectionStatusView(status: string): StatusView {
  return CONNECTION[status] ?? { label: status, tone: 'neutral' };
}

const PROVIDER_LABELS: Record<string, string> = { aws: 'AWS', gcp: 'GCP', onprem: 'On-prem' };

export function providerLabel(kind: string): string {
  return PROVIDER_LABELS[kind] ?? kind;
}
