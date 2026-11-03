/** A(출발, 주황)·B(도착, 남색) 요청 비율이 엇갈리는 선. 실제 화면의 TrafficChart 와 같은 색 규칙이다 */
export function RequestsIllustration() {
  return (
    <div className="flex flex-col gap-2">
      <svg
        aria-hidden="true"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="h-24 w-full"
        fill="none"
      >
        {[8, 20, 32].map((y) => (
          <line
            key={y}
            x1={0}
            x2={100}
            y1={y}
            y2={y}
            vectorEffect="non-scaling-stroke"
            className="stroke-line"
          />
        ))}
        <path
          d="M0,6 L30,5 C42,5 50,28 62,33 L100,34"
          vectorEffect="non-scaling-stroke"
          className="stroke-chart-3"
          strokeWidth={1.5}
        />
        <path
          d="M0,34 L30,33 C42,33 50,10 62,6 L100,5"
          vectorEffect="non-scaling-stroke"
          className="stroke-chart-1"
          strokeWidth={1.5}
        />
      </svg>
      <span className="flex gap-3 text-caption text-fg-secondary">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-xs bg-chart-3" />
          AWS Tokyo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-xs bg-chart-1" />
          GCP Seoul
        </span>
      </span>
    </div>
  );
}
