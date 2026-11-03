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
import ELK from 'elkjs/lib/elk.bundled.js';
import { TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ProviderLabel } from '@/components/ProviderLabel';
import { StatusBadge } from '@/components/StatusBadge';
import type { EnvironmentSummary } from '@/lib/api/types';
import { regionGroupLabel } from '@/lib/geo';
import { connectionStatusView, envRoleView, shortSha } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { ServiceOnEnvironment } from './types';

const ENV_WIDTH = 232;
const ENV_HEIGHT = 112;
const PROXY_WIDTH = 200;
const PROXY_HEIGHT = 64;
const GROUP_PADDING = '[top=36,left=14,bottom=14,right=14]';

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

/** 환경 노드: 역할 · 버전 · 트래픽 막대 · 위험 */
function EnvironmentNode({ data }: NodeProps<Node<EnvNodeData, 'environment'>>) {
  const { environment, links, atRisk } = data;
  const primary = links.find((item) => item.link.role === 'SERVING') ?? links[0];
  const weight = links.reduce((sum, item) => sum + item.link.trafficWeight, 0);
  const role = primary?.link.role;
  const roleText =
    role === 'SERVING'
      ? `Primary · ${shortSha(primary?.link.currentDeployment?.commitSha)}`
      : role === 'STANDBY'
        ? `Standby · ${primary?.link.versionStatus === 'IN_SYNC' ? 'Warm' : 'Behind'}`
        : 'No services';
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
        position={Position.Left}
        className="!size-1.5 !border-0 !bg-line-strong"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!size-1.5 !border-0 !bg-line-strong"
      />
      <Handle
        id="repl-out"
        type="source"
        position={Position.Bottom}
        className="!size-1.5 !border-0 !bg-transparent"
      />
      <Handle
        id="repl-in"
        type="target"
        position={Position.Top}
        className="!size-1.5 !border-0 !bg-transparent"
      />
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-body-medium">{environment.name}</span>
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        <ProviderLabel kind={environment.kind} showLocation={false} />
        {atRisk ? (
          <span className="inline-flex items-center gap-1 rounded-sm bg-danger-bg px-1.5 text-label text-danger-fg">
            <TriangleAlert aria-hidden className="size-3" />
            At risk
          </span>
        ) : role ? (
          <StatusBadge {...envRoleView(role)} />
        ) : (
          <StatusBadge {...connectionStatusView(environment.connectionStatus)} />
        )}
      </span>
      <span className="flex items-center justify-between gap-2 text-caption text-fg-muted">
        <span>{roleText}</span>
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
        position={Position.Right}
        className="!size-1.5 !border-0 !bg-line-strong"
      />
      <span className="text-body-medium">Edge proxy</span>
      <span className="truncate font-mono text-mono text-fg-muted">
        {data.url?.replace(/^https:\/\//, '') ?? 'No public URL yet'}
      </span>
    </div>
  );
}

/** 트래픽 선은 굵기 = 비율, 복제 선은 점선 */
function TrafficEdge(props: EdgeProps<Edge<TrafficEdgeData>>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const replication = data?.kind === 'replication';
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
          {replication ? 'repl.' : `traffic ${weight}%`}
        </span>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { environment: EnvironmentNode, region: RegionNode, proxy: ProxyNode };
const edgeTypes = { traffic: TrafficEdge };

const elk = new ELK();

type Positions = Map<string, { x: number; y: number; width?: number; height?: number }>;

/** 지역 묶음을 하위 그래프로 두고 elkjs 로 왼쪽 → 오른쪽 자동 배치 (환경이 N개로 늘어도) */
async function layout(
  groups: Map<string, EnvironmentSummary[]>,
  edges: { id: string; source: string; target: string }[],
): Promise<Positions> {
  const graph = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.spacing.nodeNode': '28',
      'elk.layered.spacing.nodeNodeBetweenLayers': '64',
    },
    children: [
      { id: 'proxy', width: PROXY_WIDTH, height: PROXY_HEIGHT },
      ...[...groups.entries()].map(([label, members]) => ({
        id: `group:${label}`,
        layoutOptions: { 'elk.padding': GROUP_PADDING, 'elk.direction': 'DOWN' },
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
      const label = `${regionGroupLabel(environment)}${environment.kind === 'onprem' ? ' (on-prem)' : ''}`;
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

  // 배치는 구조(환경·묶음·선)가 바뀔 때만 다시 계산한다. 트래픽 숫자만 바뀌면 그대로 둔다
  const structureKey = useMemo(
    () =>
      JSON.stringify([
        [...groups.entries()].map(([label, members]) => [label, members.map((item) => item.id)]),
        edges.map((edge) => edge.id),
      ]),
    [groups, edges],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: structureKey 가 groups·edges 의 구조를 대표한다
  useEffect(() => {
    let cancelled = false;
    // 배치용 선: 서비스가 없는 환경도 프록시 오른쪽에 오도록 프록시 → 모든 환경을 잇는다(화면에는 그리지 않는다)
    const layoutEdges = [
      ...environments.map((environment) => ({
        id: `layout:${environment.id}`,
        source: 'proxy',
        target: environment.id,
      })),
      ...edges.filter((edge) => edge.data?.kind === 'replication'),
    ];
    layout(groups, layoutEdges).then((next) => {
      if (cancelled) return;
      setPositions(next);
      requestAnimationFrame(() => fitView({ padding: 0.12, duration: 300 }));
    });
    return () => {
      cancelled = true;
    };
  }, [structureKey, fitView]);

  // 옆 칸(재난 카드 등)이 생겨 캔버스 너비가 바뀌면 다시 맞춘다
  const paneWidth = useStore((state) => state.width);
  useEffect(() => {
    if (paneWidth === 0) return;
    const frame = requestAnimationFrame(() => fitView({ padding: 0.12 }));
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

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      minZoom={0.4}
      maxZoom={1.5}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll
      zoomOnScroll={false}
      className="echo-flow"
    >
      <Background gap={20} size={1} color="var(--ep-color-border-default)" />
      <Controls showInteractive={false} position="bottom-left" />
    </ReactFlow>
  );
}

/**
 * S01 토폴로지 캔버스 (ADR 11/2: React Flow + elkjs).
 * 지역별로 묶은 환경 노드 + 앞단 프록시, 트래픽 선 굵기 = 비율, 서비스 중 → 예비 복제 점선
 */
export function Topology(props: TopologyProps) {
  return (
    <div className="h-96 w-full overflow-hidden rounded-md bg-canvas">
      <ReactFlowProvider>
        <TopologyCanvas {...props} />
      </ReactFlowProvider>
    </div>
  );
}
