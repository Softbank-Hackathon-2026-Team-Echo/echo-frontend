import { Fragment } from 'react';

/** 큰 제목의 줄바꿈. 어디서 끊어야 자연스러운지 언어마다 달라서 문구 안의 <br> 자리에서 나눈다 */
export function TitleLines({ text }: { text: string }) {
  return text.split('<br>').map((line, index) => (
    <Fragment key={line}>
      {index > 0 && <br />}
      {line}
    </Fragment>
  ));
}
