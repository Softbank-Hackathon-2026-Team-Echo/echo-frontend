import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-content items-center p-gutter">
      <EmptyState
        className="w-full"
        icon={Compass}
        title="Page not found"
        description="The address may be wrong, or the page has moved."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/">Go home</Link>
          </Button>
        }
      />
    </main>
  );
}
