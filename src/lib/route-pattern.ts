// 주소를 화면 단위 이름으로 바꾼다(성능 · 오류 묶음용). 조직 slug 와 id 는 화면마다 달라 그대로 두면
// 같은 화면이 사람 · 조직 수만큼 따로 묶인다. 경로 표는 ui-terms 메뉴와 같다
const ID_SEGMENT =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|plan-[0-9a-z]+|[0-9]+)$/i;

export function routePattern(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const named = segments.map((segment, index) => {
    if (index === 1 && segments[0] === 'o') return ':slug';
    if (ID_SEGMENT.test(segment)) return ':id';
    return segment;
  });
  return `/${named.join('/')}`;
}
