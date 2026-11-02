import { useParams } from 'react-router';
import { useCurrentOrg } from '@/lib/api/me';

/** URL 의 현재 조직에서 내 역할. 불러오는 중이거나 조직이 없으면 null */
export function useRole() {
  const { slug } = useParams();
  const { organization } = useCurrentOrg(slug);
  return organization?.role ?? null;
}
