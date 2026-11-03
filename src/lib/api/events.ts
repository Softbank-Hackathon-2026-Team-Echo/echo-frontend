// 실시간 채널 (계약 3장 🆕). 이벤트는 "무엇이 바뀌었는지"만 알리고, 받으면 해당 쿼리를 무효화해 REST 를 다시 부른다.
// 서버에 채널이 열리면 EVENTS_API_READY 를 켠다. 그 전에는 목업 모드에서만 붙는다(MSW sse 핸들러)
import { type QueryClient, type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { apiUrl } from './client';
import { queryKeys } from './query-keys';

export const EVENTS_API_READY = false;

export type OrgEventType =
  | 'environment.updated'
  | 'service.updated'
  | 'deploy_request.updated'
  | 'disaster.started'
  | 'disaster.updated'
  | 'disaster.ended'
  | 'evacuation.updated'
  | 'precheck.updated'
  | 'migration.updated'
  | 'migration.metrics'
  | 'security.updated'
  | 'audit.created';

export type OrgEvent = {
  seq: number;
  ts: string;
  orgId: string;
  type: OrgEventType;
  resource: { type: string; id: string; name?: string } | null;
  data: unknown;
};

/** 이벤트마다 다시 부를 쿼리 (계약 3장 표) */
const INVALIDATES: Record<OrgEventType, (orgId: string, resourceId?: string) => QueryKey[]> = {
  'environment.updated': (orgId) => [queryKeys.environments(orgId)],
  'service.updated': (orgId) => [queryKeys.services(orgId)],
  'deploy_request.updated': (orgId, id) => [
    ...(id ? [queryKeys.deployRequest(orgId, id)] : []),
    // 서비스 아래 배포 요청 목록도 함께
    queryKeys.services(orgId),
  ],
  'disaster.started': (orgId) => [queryKeys.disasters(orgId), queryKeys.environments(orgId)],
  'disaster.updated': (orgId) => [queryKeys.disasters(orgId), queryKeys.environments(orgId)],
  'disaster.ended': (orgId) => [queryKeys.disasters(orgId), queryKeys.environments(orgId)],
  'evacuation.updated': (orgId) => [queryKeys.evacuation(orgId)],
  'precheck.updated': (orgId) => [queryKeys.prechecks(orgId)],
  'migration.updated': (orgId) => [queryKeys.migrations(orgId)],
  // 값을 싣는 예외: 쿼리를 다시 부르지 않고 최근 이벤트로만 넘긴다
  'migration.metrics': () => [],
  'security.updated': (orgId) => [queryKeys.security(orgId)],
  'audit.created': (orgId) => [queryKeys.audit(orgId)],
};

export const ORG_EVENT_TYPES = Object.keys(INVALIDATES) as OrgEventType[];

// 최근 이벤트 (Live events 패널용). 조직을 바꾸면 비운다
const RECENT_LIMIT = 20;
let recent: OrgEvent[] = [];
const listeners = new Set<() => void>();

function publish(next: OrgEvent[]) {
  recent = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 이 탭이 받은 최근 실시간 이벤트, 새것부터 */
export function useRecentOrgEvents(): OrgEvent[] {
  return useSyncExternalStore(subscribe, () => recent);
}

export function handleOrgEvent(queryClient: QueryClient, orgId: string, event: OrgEvent) {
  for (const queryKey of INVALIDATES[event.type](orgId, event.resource?.id)) {
    queryClient.invalidateQueries({ queryKey });
  }
  // migration.metrics 는 1초마다 와서 목록을 밀어내므로 남기지 않는다
  if (event.type !== 'migration.metrics') publish([event, ...recent].slice(0, RECENT_LIMIT));
}

export function eventsEnabled() {
  return EVENTS_API_READY || import.meta.env.VITE_USE_MOCKS === 'true';
}

/**
 * 조직 실시간 채널에 붙는다. 끊기면 브라우저가 Last-Event-ID 로 다시 붙고,
 * 서버가 놓친 구간을 못 주면 resync 가 와서 조직 쿼리를 전부 다시 부른다
 */
export function useOrgEvents(orgId: string | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!orgId || !eventsEnabled() || typeof EventSource === 'undefined') return;
    publish([]);
    const source = new EventSource(apiUrl(`/orgs/${orgId}/events`), { withCredentials: true });

    function onEvent(message: MessageEvent<string>) {
      try {
        const body = JSON.parse(message.data) as Omit<OrgEvent, 'type'>;
        handleOrgEvent(queryClient, orgId as string, {
          ...body,
          type: message.type as OrgEventType,
        });
      } catch {
        // 모양이 다른 이벤트는 건너뛴다
      }
    }
    function onResync() {
      queryClient.invalidateQueries({ queryKey: queryKeys.org(orgId as string) });
    }

    for (const type of ORG_EVENT_TYPES) source.addEventListener(type, onEvent);
    source.addEventListener('resync', onResync);
    return () => source.close();
  }, [orgId, queryClient]);
}
