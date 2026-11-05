import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useLocale } from '@/hooks/useLocale';
import { router } from '@/router';

export function App({ queryClient }: { queryClient: QueryClient }) {
  const { locale } = useLocale();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        {/* 언어를 바꾸면 화면을 다시 만들어 모든 문구가 새 언어로 나온다. 쿼리 캐시는 위에 있어 그대로다 */}
        <RouterProvider key={locale} router={router} />
        <Toaster position="top-right" />
      </TooltipProvider>
      {import.meta.env.DEV && <ReactQueryDevtools buttonPosition="bottom-right" />}
    </QueryClientProvider>
  );
}
