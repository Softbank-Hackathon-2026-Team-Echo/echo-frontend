const REPLICATION_DEPTH = 40;

/** 환경 아래에서 나가 다른 환경 아래로 돌아오는 곡선. 멀리 있는 환경일수록 깊게 돈다 */
export function replicationPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
) {
  const depth = REPLICATION_DEPTH + Math.abs(targetX - sourceX) * 0.08;
  const path = `M ${sourceX},${sourceY} C ${sourceX},${sourceY + depth} ${targetX},${targetY + depth} ${targetX},${targetY}`;
  return {
    path,
    labelX: (sourceX + targetX) / 2,
    labelY: Math.max(sourceY, targetY) + depth * 0.75,
  };
}
