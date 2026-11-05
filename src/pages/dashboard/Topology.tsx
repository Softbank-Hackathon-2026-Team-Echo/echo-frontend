import '@xyflow/react/dist/style.css';

import {
  Background,
  BaseEdge,
  Controls,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
} from '@xyflow/react';
import ELK from 'elkjs/lib/elk-api.js';
import { TriangleAlert } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ProviderLabel } from '@/components/ProviderLabel';
import { StatusBadge } from '@/components/StatusBadge';
import { useInViewOnce } from '@/hooks/useInViewOnce';
import type { EnvironmentSummary } from '@/lib/api/types';
import { regionGroupLabel } from '@/lib/geo';
import { t } from '@/lib/i18n';
import { connectionStatusView, envRoleView, shortSha } from '@/lib/status';
import { cn } from '@/lib/utils';
import { replicationPath } from './topology-path';
import type { ServiceOnEnvironment } from './types';

const ENV_WIDTH = 232;
const ENV_HEIGHT = 112;
const PROXY_WIDTH = 200;
const PROXY_HEIGHT = 64;
const GROUP_PADDING = '[top=36,left=14,bottom=14,right=14]';
// 복제 곡선이 노드 아래로 나가므로 아래 여백을 넉넉히 둔다
const FIT_PADDING = { top: '12px', left: '12px', right: '12px', bottom: '72px' } as const;

type EnvNodeData = {
  environment: EnvironmentSummary;
  links: ServiceOnEnvironment[];
  atRisk: boolean;
};
type GroupNodeData = { label: string; risky: boolean };
type ProxyNodeData = { url: string | undefined };
type TrafficEdgeData = { weight: number; kind: 'traffic' | 'replication' };

type TopologyNode =
  | Node<EnvNodeData, 'environment'>
  | Node<GroupNodeData, 'region'>
  | Node<ProxyNodeData, 'proxy'>;

/** 예비 상태: 따라가기 실패 > 버전 일치(+ 마지막 따라가기에 걸린 초) > 뒤처짐 */
function standbyText(link: ServiceOnEnvironment['link'] | undefined): string {
  if (link?.lastSyncError) return t('Sync failed');
  if (link?.versionStatus !== 'IN_SYNC') return t('Behind');
  return link.lastSyncSeconds !== null
    ? t('Warm · synced in {{seconds}}s', { seconds: link.lastSyncSeconds })
    : t('Warm');
}

/** 환경 노드: 역할 · 버전 · 트래픽 막대 · 위험 */
function EnvironmentNode({ data }: NodeProps<Node<EnvNodeData, 'environment'>>) {
  const { environment, links, atRisk } = data;
  const primary = links.find((item) => item.link.role === 'SERVING') ?? links[0];
  const weight = links.reduce((sum, item) => sum + item.link.trafficWeight, 0);
  const role = primary?.link.role;
  const roleText =
    role === 'SERVING'
      ? t('Primary · {{sha}}', { sha: shortSha(primary?.link.currentDeployment?.commitSha) })
      : role === 'STANDBY'
        ? t('Standby · {{status}}', { status: standbyText(primary?.link) })
        : t('No services');
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border bg-surface p-3 shadow-xs',
        atRisk ? 'border-danger-solid ring-2 ring-danger-bg' : 'border-line',
      )}
      style={{ width: ENV_WIDTH, height: ENV_HEIGHT }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!size-1.5 !border-0 !bg-line-strong"
      />
      {/* 복제 선은 환경 아래쪽끼리 잇는다. 트래픽 선과 겹치지 않고 카드를 지나지 않는다 */}
      <Handle
        id="repl-out"
        type="source"
        position={Position.Bottom}
        className="!size-1.5 !border-0 !bg-line-strong"
      />
      <Handle
        id="repl-in"
        type="target"
        position={Position.Bottom}
        className="!size-1.5 !border-0 !bg-line-strong"
      />
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-body-medium">{environment.name}</span>
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        <ProviderLabel kind={environment.kind} showLocation={false} />
        {atRisk ? (
          <span className="inline-flex items-center gap-1 rounded-sm bg-danger-bg px-1.5 text-label text-danger-fg">
            <TriangleAlert aria-hidden className="size-3" />
            {t('At risk')}
          </span>
        ) : role ? (
          <StatusBadge {...envRoleView(role)} />
        ) : (
          <StatusBadge {...connectionStatusView(environment.connectionStatus)} />
        )}
      </span>
      <span className="flex items-center justify-between gap-2 text-caption text-fg-muted">
        <span className="truncate">{roleText}</span>
        <span className="font-mono">{environment.location ?? '—'}</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-subtle">
          <span
            className="block h-full rounded-full bg-brand transition-all"
            style={{ width: `${weight}%` }}
          />
        </span>
        <span className="w-9 text-right font-mono text-mono tabular-nums">{weight}%</span>
      </span>
    </div>
  );
}

/** 지역 묶음 (예: JAPAN · TOKYO). 재난 반경 안이면 주황 */
function RegionNode({ data, width, height }: NodeProps<Node<GroupNodeData, 'region'>>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed px-3 py-2',
        data.risky ? 'border-warning-solid bg-warning-bg' : 'border-line-strong bg-subtle',
      )}
      style={{ width, height }}
    >
      <span className="text-overline uppercase text-fg-muted">{data.label}</span>
    </div>
  );
}

function ProxyNode({ data }: NodeProps<Node<ProxyNodeData, 'proxy'>>) {
  return (
    <div
      className="flex flex-col justify-center gap-0.5 rounded-md border border-line-strong bg-subtle px-3"
      style={{ width: PROXY_WIDTH, height: PROXY_HEIGHT }}
    >
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-1.5 !border-0 !bg-line-strong"
      />
      <span className="text-body-medium">{t('Edge proxy')}</span>
      <span className="truncate font-mono text-mono text-fg-muted">
        {data.url?.replace(/^https:\/\//, '') ?? t('No public URL yet')}
      </span>
    </div>
  );
}

/** 트래픽 선은 굵기 = 비율, 복제 선은 점선 */
function TrafficEdge(props: EdgeProps<Edge<TrafficEdgeData>>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const replication = data?.kind === 'replication';
  const [trafficPath, trafficLabelX, trafficLabelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const curve = replication ? replicationPath(sourceX, sourceY, targetX, targetY) : null;
  const path = curve?.path ?? trafficPath;
  const labelX = curve?.labelX ?? trafficLabelX;
  const labelY = curve?.labelY ?? trafficLabelY;
  const weight = data?.weight ?? 0;
  return (
    <>
      <BaseEdge
        path={path}
        style={{
          stroke: replication
            ? 'var(--ep-color-text-muted)'
            : weight > 0
              ? 'var(--ep-color-chart-3)'
              : 'var(--ep-color-brand-default)',
          strokeWidth: replication ? 1.5 : Math.max(1.5, weight / 12),
          strokeDasharray: replication || weight === 0 ? '5 4' : undefined,
          transition: 'stroke-width 400ms ease',
        }}
      />
      <EdgeLabelRenderer>
        <span
          className="nodrag nopan absolute rounded-sm bg-surface px-1 font-mono text-caption text-fg-muted shadow-xs"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          {replication ? t('repl.') : t('traffic {{weight}}%', { weight })}
        </span>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { environment: EnvironmentNode, region: RegionNode, proxy: ProxyNode };
const edgeTypes = { traffic: TrafficEdge };

// 배치 계산(약 1.4MB)은 웹 워커에서 돈다. 첫 화면 번들에 넣지 않고, 계산 중에도 화면이 멈추지 않는다
const elk = new ELK({
  workerFactory: () =>
    new Worker(new URL('elkjs/lib/elk-worker.min.js', import.meta.url), { type: 'classic' }),
});

type Positions = Map<string, { x: number; y: number; width?: number; height?: number }>;

/** 지역 묶음을 하위 그래프로 두고 elkjs 로 위 → 아래 자동 배치 (환경이 N개로 늘어도) */
async function layout(
  groups: Map<string, EnvironmentSummary[]>,
  edges: { id: string; source: string; target: string }[],
): Promise<Positions> {
  const graph = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.spacing.nodeNode': '24',
      'elk.layered.spacing.nodeNodeBetweenLayers': '48',
    },
    children: [
      { id: 'proxy', width: PROXY_WIDTH, height: PROXY_HEIGHT },
      ...[...groups.entries()].map(([label, members]) => ({
        id: `group:${label}`,
        layoutOptions: { 'elk.padding': GROUP_PADDING },
        children: members.map((environment) => ({
          id: environment.id,
          width: ENV_WIDTH,
          height: ENV_HEIGHT,
        })),
      })),
    ],
    edges: edges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
  });
  const positions: Positions = new Map();
  for (const child of graph.children ?? []) {
    positions.set(child.id, {
      x: child.x ?? 0,
      y: child.y ?? 0,
      width: child.width,
      height: child.height,
    });
    for (const inner of child.children ?? []) {
      positions.set(inner.id, { x: inner.x ?? 0, y: inner.y ?? 0 });
    }
  }
  // 프록시는 환경 줄의 가운데에 둔다. 트래픽 선이 양쪽으로 고르게 펴진다
  const boxes = (graph.children ?? []).filter((child) => child.id !== 'proxy');
  const left = Math.min(...boxes.map((box) => box.x ?? 0));
  const right = Math.max(...boxes.map((box) => (box.x ?? 0) + (box.width ?? 0)));
  const proxy = positions.get('proxy');
  if (proxy && boxes.length > 0) proxy.x = (left + right - PROXY_WIDTH) / 2;
  return positions;
}

type TopologyProps = {
  environments: EnvironmentSummary[];
  byEnvironment: Map<string, ServiceOnEnvironment[]>;
  atRisk: Set<string>;
  edgeUrl: string | undefined;
};

function TopologyCanvas({ environments, byEnvironment, atRisk, edgeUrl }: TopologyProps) {
  const { fitView } = useReactFlow();
  const [positions, setPositions] = useState<Positions>(new Map());

  const groups = useMemo(() => {
    const map = new Map<string, EnvironmentSummary[]>();
    for (const environment of environments) {
      const region = regionGroupLabel(environment);
      const label = environment.kind === 'onprem' ? t('{{region}} (on-prem)', { region }) : region;
      map.set(label, [...(map.get(label) ?? []), environment]);
    }
    return map;
  }, [environments]);

  const edges = useMemo(() => {
    const list: Edge<TrafficEdgeData>[] = [];
    const serving = environments.find((environment) =>
      byEnvironment.get(environment.id)?.some((item) => item.link.role === 'SERVING'),
    );
    for (const environment of environments) {
      const links = byEnvironment.get(environment.id) ?? [];
      if (links.length === 0) continue;
      const weight = links.reduce((sum, item) => sum + item.link.trafficWeight, 0);
      list.push({
        id: `traffic:${environment.id}`,
        source: 'proxy',
        target: environment.id,
        type: 'traffic',
        data: { weight, kind: 'traffic' },
      });
      if (serving && environment.id !== serving.id) {
        list.push({
          id: `repl:${environment.id}`,
          source: serving.id,
          target: environment.id,
          sourceHandle: 'repl-out',
          targetHandle: 'repl-in',
          type: 'traffic',
          data: { weight: 0, kind: 'replication' },
        });
      }
    }
    return list;
  }, [environments, byEnvironment]);

  // 배치는 구조(환경·묶음)가 바뀔 때만 다시 계산한다. 이전으로 트래픽이 옮겨 가도 그대로 둔다
  const structureKey = useMemo(
    () =>
      JSON.stringify([
        [...groups.entries()].map(([label, members]) => [label, members.map((item) => item.id)]),
      ]),
    [groups],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: structureKey 가 groups 의 구조를 대표한다
  useEffect(() => {
    let cancelled = false;
    // 배치용 선: 프록시 → 모든 환경만 쓴다. 복제 선까지 넣으면 예비가 한 층 뒤로 밀려 트래픽 선이 카드를 지나고,
    // 이전으로 서비스 중 환경이 바뀔 때 배치가 뒤집힌다
    const layoutEdges = environments.map((environment) => ({
      id: `layout:${environment.id}`,
      source: 'proxy',
      target: environment.id,
    }));
    layout(groups, layoutEdges).then((next) => {
      if (cancelled) return;
      setPositions(next);
      requestAnimationFrame(() => fitView({ padding: FIT_PADDING, duration: 300 }));
    });
    return () => {
      cancelled = true;
    };
  }, [structureKey, fitView]);

  // 옆 칸(재난 카드 등)이 생겨 캔버스 너비가 바뀌면 다시 맞춘다
  const paneWidth = useStore((state) => state.width);
  useEffect(() => {
    if (paneWidth === 0) return;
    const frame = requestAnimationFrame(() => fitView({ padding: FIT_PADDING }));
    return () => cancelAnimationFrame(frame);
  }, [paneWidth, fitView]);

  const nodes = useMemo(() => {
    const list: TopologyNode[] = [
      {
        id: 'proxy',
        type: 'proxy',
        position: positions.get('proxy') ?? { x: 0, y: 0 },
        data: { url: edgeUrl },
        draggable: false,
      },
    ];
    for (const [label, members] of groups) {
      const groupId = `group:${label}`;
      const box = positions.get(groupId);
      list.push({
        id: groupId,
        type: 'region',
        position: box ?? { x: 0, y: 0 },
        width: box?.width,
        height: box?.height,
        data: { label, risky: members.some((environment) => atRisk.has(environment.id)) },
        draggable: false,
        selectable: false,
        zIndex: -1,
      });
      for (const environment of members) {
        list.push({
          id: environment.id,
          type: 'environment',
          parentId: groupId,
          extent: 'parent',
          position: positions.get(environment.id) ?? { x: 0, y: 0 },
          data: {
            environment,
            links: byEnvironment.get(environment.id) ?? [],
            atRisk: atRisk.has(environment.id),
          },
          draggable: false,
        });
      }
    }
    return list;
  }, [positions, groups, byEnvironment, atRisk, edgeUrl]);

  // 캔버스 왼쪽 아래 버튼의 툴팁. 기본값이 영어 문구라 그대로 번역한다
  const ariaLabelConfig = useMemo(
    () => ({
      'controls.ariaLabel': t('Control Panel'),
      'controls.zoomIn.ariaLabel': t('Zoom In'),
      'controls.zoomOut.ariaLabel': t('Zoom Out'),
      'controls.fitView.ariaLabel': t('Fit View'),
    }),
    [],
  );

  return (
    <ReactFlow
      ariaLabelConfig={ariaLabelConfig}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: FIT_PADDING }}
      minZoom={0.4}
      maxZoom={1.5}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll
      zoomOnScroll={false}
      // 배치가 끝나기 전에는 모든 노드가 한 점에 겹쳐 있어 보이지 않게 둔다
      className={cn('echo-flow', positions.size === 0 && 'invisible')}
    >
      <Background gap={20} size={1} color="var(--ep-color-border-default)" />
      <Controls showInteractive={false} position="top-left" />
    </ReactFlow>
  );
}

/**
 * S01 토폴로지 캔버스 (ADR 11/2: React Flow + elkjs).
 * 지역별로 묶은 환경 노드 + 앞단 프록시, 트래픽 선 굵기 = 비율, 서비스 중 → 예비 복제 점선
 */
export const Topology = memo(function Topology(props: TopologyProps) {
  const ref = useRef<HTMLDivElement>(null);
  // 화면에 들어올 때 캔버스를 만들고 배치(elk 워커)를 계산한다. 그전에는 같은 크기 자리만 둔다
  const inView = useInViewOnce(ref);
  return (
    <div ref={ref} className="h-96 w-full overflow-hidden rounded-md bg-canvas">
      {inView ? (
        <ReactFlowProvider>
          <TopologyCanvas {...props} />
        </ReactFlowProvider>
      ) : null}
    </div>
  );
});
