import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { reportError } from '../monitoring';
import { isClientError } from './errors';
import { notifyApiError } from './notify';

const MAX_RETRIES = 2;

export function createQueryClient() {
  return new QueryClient({
    // 재시도까지 끝난 실패만 온다. 5xx · 네트워크 · 봉투가 아닌 응답만 오류 추적에 보낸다
    queryCache: new QueryCache({
      onError: (error, query) =>
        reportError(error, { tags: { source: 'query', resource: String(query.queryKey.at(-1)) } }),
    }),
    mutationCache: new MutationCache({
      // 변경 요청 실패는 화면이 따로 처리하지 않으면 공통 토스트로 알린다 (403 권한, 409 충돌, 5xx)
      onError: (error, _variables, _context, mutation) => {
        reportError(error, { tags: { source: 'mutation' } });
        if (mutation.meta?.skipGlobalErrorToast) return;
        notifyApiError(error);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        retry: (failureCount, error) => !isClientError(error) && failureCount < MAX_RETRIES,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { skipGlobalErrorToast?: boolean };
  }
}
