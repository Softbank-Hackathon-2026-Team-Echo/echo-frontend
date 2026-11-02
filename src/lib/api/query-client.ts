import { MutationCache, QueryClient } from '@tanstack/react-query';
import { isClientError } from './errors';
import { notifyApiError } from './notify';

const MAX_RETRIES = 2;

export function createQueryClient() {
  return new QueryClient({
    mutationCache: new MutationCache({
      // 변경 요청 실패는 화면이 따로 처리하지 않으면 공통 토스트로 알린다 (403 권한, 409 충돌, 5xx)
      onError: (error, _variables, _context, mutation) => {
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
