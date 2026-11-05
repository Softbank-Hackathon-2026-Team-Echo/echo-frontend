import qrcode from 'qrcode-generator';

/** 휴대폰으로 열 주소의 QR. 어두운 테마에서도 읽히게 바탕은 늘 흰색이다 */
export default function RemoteQr({ url }: { url: string }) {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const size = qr.getModuleCount();
  const cells = Array.from({ length: size * size }, (_, index) => ({
    row: Math.floor(index / size),
    column: index % size,
  })).filter(({ row, column }) => qr.isDark(row, column));

  return (
    <svg
      role="img"
      aria-label={url}
      viewBox={`-2 -2 ${size + 4} ${size + 4}`}
      className="size-40 rounded-md bg-fg-on-brand text-brand"
      shapeRendering="crispEdges"
    >
      <path
        fill="currentColor"
        d={cells.map(({ row, column }) => `M${column} ${row}h1v1h-1z`).join('')}
      />
    </svg>
  );
}
