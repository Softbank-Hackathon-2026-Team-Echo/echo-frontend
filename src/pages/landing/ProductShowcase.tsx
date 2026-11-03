import { BrowserFrame } from './BrowserFrame';
import { DashboardPreview } from './DashboardPreview';
import { Illustration } from './Illustration';
import { SectionIntro } from './SectionIntro';

const LEGEND = [
  { label: 'Source · moving out', line: 'bg-chart-3' },
  { label: 'Target · moving in', line: 'bg-chart-1' },
  { label: 'Replication', line: 'bg-fg-muted' },
];

/** L01 ④ 브라우저 틀 안의 대시보드 + 트래픽 색 범례 */
export function ProductShowcase() {
  return (
    <section className="mx-auto flex max-w-content flex-col gap-12 px-gutter py-20 max-compact:px-gutter-compact">
      <SectionIntro
        id="product"
        title={
          <>
            Every region
            <br />
            on one canvas
          </>
        }
        description="Environments are grouped by region on a live topology. During a move the lines thicken with the traffic they carry, so anyone in the room can follow it."
        link={{ label: 'Explore the dashboard', to: '/login' }}
      />
      <Illustration label="EchoPort dashboard right after an M7.2 alert near Tokyo">
        <BrowserFrame url="app.echoport.uk/dashboard">
          <DashboardPreview variant="alert" />
        </BrowserFrame>
      </Illustration>
      <ul aria-label="Traffic colors" className="flex flex-wrap gap-x-8 gap-y-2">
        {LEGEND.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-body text-fg-secondary">
            <span aria-hidden className={`h-0.5 w-5 rounded-full ${item.line}`} />
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
