import { Construction } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';

/** 아직 만들지 않은 메뉴. 제목만 둔다 */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        icon={Construction}
        title="Not built yet"
        description="This screen is part of a later task."
      />
    </>
  );
}
