type Point = { x: number; y: number };

/** 양쪽 기울기를 조화 평균으로 묶는다(Fritsch–Butland). 방향이 바뀌는 점은 평평하게 둬서 값을 넘지 않는다 */
function tangent(leftWidth: number, rightWidth: number, leftSlope: number, rightSlope: number) {
  if (leftSlope * rightSlope <= 0) return 0;
  return (
    (3 * (leftWidth + rightWidth)) /
    ((2 * rightWidth + leftWidth) / leftSlope + (rightWidth + 2 * leftWidth) / rightSlope)
  );
}

/** 점을 모두 지나고 점 사이에서 값이 위아래로 넘치지 않는 곡선(SVG path). x 는 오름차순이다 */
export function monotonePath(input: Point[]): string {
  // 같은 x 의 점은 기울기를 만들 수 없어 나중 값만 쓴다
  const points = input.filter((point, index) => input[index + 1]?.x !== point.x);
  const first = points[0];
  if (!first) return '';
  const widths: number[] = [];
  const slopes: number[] = [];
  points.slice(1).forEach((point, index) => {
    const previous = points[index] ?? point;
    widths.push(point.x - previous.x);
    slopes.push((point.y - previous.y) / (point.x - previous.x));
  });
  const tangents = points.map((_, index) => {
    const left = slopes[index - 1];
    const right = slopes[index];
    if (left === undefined) return right ?? 0;
    if (right === undefined) return left;
    return tangent(widths[index - 1] ?? 0, widths[index] ?? 0, left, right);
  });
  const segments = points.slice(1).map((point, index) => {
    const previous = points[index] ?? point;
    const third = (widths[index] ?? 0) / 3;
    const start = previous.y + (tangents[index] ?? 0) * third;
    const end = point.y - (tangents[index + 1] ?? 0) * third;
    return `C${previous.x + third},${start} ${point.x - third},${end} ${point.x},${point.y}`;
  });
  return [`M${first.x},${first.y}`, ...segments].join(' ');
}
