import type { Holding } from '../../types/wealth';
import type { BenchmarkRow } from '../benchmarkMap';

const pct = (n: number) => `${n.toFixed(1)}%`;

function verdict(delta: number): { text: string; tone: string } {
  if (Math.abs(delta) < 0.05) return { text: 'In line with it', tone: 'bg-ink/10' };
  const points = Math.abs(delta).toFixed(1);
  return delta > 0
    ? { text: `${points} points ahead`, tone: 'bg-ink/10' }
    : { text: `${points} points behind`, tone: 'bg-tilt/30' };
}

export function BenchmarkRows({ rows, unbenchmarked }: { rows: BenchmarkRow[]; unbenchmarked: Holding[] }) {
  return (
    <div>
      <ul className="m-0 grid list-none gap-0 p-0">
        {rows.map((r) => {
          const v = verdict(r.deltaPct);
          return (
            <li
              key={r.holding.id}
              className="grid gap-x-6 gap-y-2 border-t border-ink/10 py-4 first:border-t-0 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center"
            >
              <div className="min-w-0">
                <div className="font-semibold md:truncate" title={r.holding.name}>
                  {r.holding.name}
                </div>
                <div className="text-sm text-ink/70">{r.holding.institution}</div>
              </div>
              <div className="text-sm" title={`Benchmark yield from ${r.benchmarkName}`}>
                <span className="num font-semibold">{pct(r.holdingPct)}</span> a year, against{' '}
                <span className="num font-semibold">{pct(r.benchmarkPct)}</span> for {r.benchmarkLabel}
              </div>
              <div>
                <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${v.tone}`}>{v.text}</span>
              </div>
            </li>
          );
        })}
      </ul>
      {unbenchmarked.length > 0 && (
        <p className="mb-0 mt-4 border-t border-ink/10 pt-4 text-sm text-ink/80">
          <span className="font-semibold">No direct benchmark:</span> {unbenchmarked.map((h) => h.name).join(', ')}. These
          have no fair yardstick, so we don&rsquo;t compare them.
        </p>
      )}
    </div>
  );
}
