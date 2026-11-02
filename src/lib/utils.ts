import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// 커스텀 글자 스타일(text-h1 …)을 글자색(text-fg …)과 다른 묶음으로 알려 줘야 twMerge 가 둘 중 하나를 지우지 않는다
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'h1',
            'h2',
            'h3',
            'title',
            'body',
            'body-medium',
            'small',
            'caption',
            'label',
            'overline',
            'metric-xl',
            'metric',
            'mono',
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
