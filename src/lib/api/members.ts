// 조직 멤버 · 초대 · 에이전트 토큰 · 조직 설정 (echo-was docs/api/organizations.md)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './client';
import { queryKeys } from './query-keys';
import type { CreateAgentToken, CreateInvitation, MemberRole } from './types';

const PAGE_SIZE = 100;

export function useMembers(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.members(orgId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/members', {
          params: { path: { org_id: orgId ?? '' }, query: { page: 0, size: PAGE_SIZE } },
        }),
      ),
    enabled: Boolean(orgId),
  });
}

export function useUpdateMemberRole(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: MemberRole }) =>
      unwrap(
        api.PATCH('/api/v1/orgs/{org_id}/members/{user_id}', {
          params: { path: { org_id: orgId, user_id: userId } },
          body: { role },
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.members(orgId) }),
  });
}

/** 내보내기. 본인이면 탈퇴다(마지막 어드민은 409 LAST_ADMIN) */
export function useRemoveMember(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      unwrap(
        api.DELETE('/api/v1/orgs/{org_id}/members/{user_id}', {
          params: { path: { org_id: orgId, user_id: userId } },
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.members(orgId) }),
  });
}

/** 초대 목록은 어드민만 볼 수 있다. 어드민이 아니면 부르지 않는다 */
export function useInvitations(orgId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.invitations(orgId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/invitations', {
          params: { path: { org_id: orgId ?? '' }, query: { page: 0, size: PAGE_SIZE } },
        }),
      ),
    enabled: Boolean(orgId) && enabled,
  });
}

export function useCreateInvitation(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInvitation) =>
      unwrap(
        api.POST('/api/v1/orgs/{org_id}/invitations', {
          params: { path: { org_id: orgId } },
          body,
        }),
      ),
    // 없는 아이디(422)·이미 멤버(409)는 폼이 보여 준다
    meta: { skipGlobalErrorToast: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.invitations(orgId) }),
  });
}

export function useRevokeInvitation(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      unwrap(
        api.DELETE('/api/v1/orgs/{org_id}/invitations/{invitation_id}', {
          params: { path: { org_id: orgId, invitation_id: invitationId } },
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.invitations(orgId) }),
  });
}

/** 에이전트 토큰은 개발자 이상만 볼 수 있다 */
export function useAgentTokens(orgId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.agentTokens(orgId ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/orgs/{org_id}/agent-tokens', {
          params: { path: { org_id: orgId ?? '' }, query: { page: 0, size: PAGE_SIZE } },
        }),
      ),
    enabled: Boolean(orgId) && enabled,
  });
}

/** 발급 응답에만 토큰 원문이 한 번 실린다. 캐시에 남기지 않고 화면이 바로 보여 주고 버린다 */
export function useIssueAgentToken(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAgentToken) =>
      unwrap(
        api.POST('/api/v1/orgs/{org_id}/agent-tokens', {
          params: { path: { org_id: orgId } },
          body,
        }),
      ),
    meta: { skipGlobalErrorToast: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agentTokens(orgId) }),
  });
}

export function useRevokeAgentToken(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tokenId: string) =>
      unwrap(
        api.DELETE('/api/v1/orgs/{org_id}/agent-tokens/{token_id}', {
          params: { path: { org_id: orgId, token_id: tokenId } },
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.agentTokens(orgId) }),
  });
}

/** 이전 계획을 만든 사람이 스스로 승인할 수 있는지(어드민). 조직 정보는 /me 에 실려 오므로 /me 를 다시 부른다 */
export function useUpdateOrgSettings(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { allowSelfApproval: boolean }) =>
      unwrap(
        api.PATCH('/api/v1/orgs/{org_id}/settings', {
          params: { path: { org_id: orgId } },
          body,
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.me() }),
  });
}
