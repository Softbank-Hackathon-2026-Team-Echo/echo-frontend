import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-content items-center p-gutter">
      <EmptyState
        className="w-full"
        icon={Compass}
        title={t('Page not found')}
        description={t('The address may be wrong, or the page has moved.')}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/">{t('Go home')}</Link>
          </Button>
        }
      />
    </main>
  );
}
