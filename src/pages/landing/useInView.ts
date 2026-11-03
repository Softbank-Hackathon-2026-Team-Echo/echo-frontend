import { type RefObject, useEffect, useState } from 'react';

/** 요소가 한 번이라도 화면에 들어왔는지. IntersectionObserver 가 없으면(jsdom) 처음부터 보인 것으로 친다 */
export function useInView(ref: RefObject<Element | null>, threshold = 0.25) {
  const [isInView, setIsInView] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const element = ref.current;
    if (!element || isInView) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, threshold, isInView]);

  return isInView;
}
