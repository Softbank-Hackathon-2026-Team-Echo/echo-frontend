// 온프레 감시 화면의 표시 도우미(색 · 이름 · 시각). 화면과 칸 컴포넌트가 같이 쓴다
import { t } from '@/lib/i18n';
import type { WatchKind } from '@/lib/onprem-watch';

export const KIND_BG: Record<WatchKind, string> = {
  onprem: 'bg-onprem',
  aws: 'bg-aws',
  gcp: 'bg-gcp',
  other: 'bg-fg-muted',
};

export function kindLabel(kind: WatchKind) {
  if (kind === 'onprem') return t('On-prem');
  if (kind === 'aws') return 'AWS';
  if (kind === 'gcp') return 'GCP';
  return t('Other');
}

export const clock = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
