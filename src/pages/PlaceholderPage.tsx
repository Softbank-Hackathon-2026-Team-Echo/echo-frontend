import { Construction } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { t } from '@/lib/i18n';

/** 아직 만들지 않은 메뉴. 제목만 둔다. title 은 라우트 표에서 k 로 적은 영어 문구다 */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={t(title)} />
      <EmptyState
        icon={Construction}
        title={t('Not built yet')}
        description={t('This screen is part of a later task.')}
      />
    </>
  );
}
