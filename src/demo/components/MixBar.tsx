import { BUCKETS, BUCKET_COLOR, BUCKET_LABEL } from '../buckets';
import type { BucketMix } from '../../utils/smartDiversification';

function Bar({ mix, thin }: { mix: BucketMix; thin?: boolean }) {
  return (
    <div className={`flex w-full overflow-hidden rounded-full bg-ink/10 ${thin ? 'h-2' : 'h-4'}`}>
      {BUCKETS.map((b) =>
        mix[b] > 0 ? (
          <div
            key={b}
            style={{ width: `${mix[b]}%`, backgroundColor: BUCKET_COLOR[b], transition: 'width 400ms ease' }}
          />
        ) : null
      )}
    </div>
  );
}

function Legend({ mix }: { mix: BucketMix }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm">
      {BUCKETS.map((b) => (
        <li key={b} className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: BUCKET_COLOR[b] }} />
          <span>{BUCKET_LABEL[b]}</span>
          <span className="num font-semibold">{Math.round(mix[b])}%</span>
        </li>
      ))}
    </ul>
  );
}

export function MixBar({ label, mix, target }: { label: string; mix: BucketMix; target?: BucketMix }) {
  return (
    <div className="grid gap-2">
      <div className="text-sm font-semibold">{label}</div>
      <Bar mix={mix} />
      <Legend mix={mix} />
      {target && (
        <div className="mt-1 grid gap-1.5">
          <div className="text-sm text-ink/70">Your target</div>
          <Bar mix={target} thin />
          <Legend mix={target} />
        </div>
      )}
    </div>
  );
}
