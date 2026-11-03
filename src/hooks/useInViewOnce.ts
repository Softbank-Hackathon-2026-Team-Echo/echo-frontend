import { type RefObject, useEffect, useState } from 'react';

/**
 * 요소가 처음 화면에 들어오면 true 가 되고 그대로 둔다(한 번 그린 캔버스를 다시 지우지 않게).
 * IntersectionObserver 가 없는 곳(jsdom 등)은 처음부터 보인다고 본다
 */
export function useInViewOnce(ref: RefObject<Element | null>, rootMargin = '200px'): boolean {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const element = ref.current;
    if (seen || !element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setSeen(true);
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin, seen]);
  return seen;
}
