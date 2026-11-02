import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiUrl } from './client';

/** GitHub 로그인은 fetch 가 아니라 페이지 이동이다. 성공하면 서버가 next 로 돌려보낸다 */
export function githubLoginUrl(next: string): string {
  return `${apiUrl('/auth/github/login')}?next=${encodeURIComponent(next)}`;
}

/** 로그인 뒤 돌아갈 경로. 다른 사이트로 보내지 않도록 같은 사이트 경로만 받는다 */
export function safeNextPath(next: string | null): string {
  if (!next?.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      queryClient.clear();
      window.location.assign('/login');
    },
  });
}
