import { BUCKET_COLOR, BUCKET_LABEL } from '../buckets';
import type { BucketMix } from '../../utils/smartDiversification';

export interface Weight {
  bucket: keyof BucketMix;
  pct: number;
}

interface BeamProps {
  /** Positive tilts toward the growth (left) pan. */
  tiltDeg: number;
  level: boolean;
  /** Plain-language description, used as the accessible name. */
  summary: string;
  /** Growth assets, shown on the left pan. */
  leftWeights: Weight[];
  /** Steadier assets, shown on the right pan. */
  rightWeights: Weight[];
  size?: 'hero' | 'slim';
}

const PIVOT = { x: 320, y: 110 };
const ARM = 240;
const HOOK = 220;
const PLATE_Y = 150;
const PAN_HALF = 70;
const PX_PER_POINT = 0.9;
const SWING = 'transform 700ms cubic-bezier(0.34, 1.56, 0.64, 1)';

function Pan({ side, tiltDeg, weights }: { side: -1 | 1; tiltDeg: number; weights: Weight[] }) {
  // Counter-rotate so the pan stays level while the beam tilts.
  const style = {
    transform: `translate(${side * HOOK}px, 4px) rotate(${tiltDeg}deg)`,
    transformOrigin: '0 0',
    transition: SWING,
  };
  let top = PLATE_Y;
  return (
    <g style={style}>
      <line x1={0} y1={0} x2={-PAN_HALF} y2={PLATE_Y} stroke="currentColor" strokeWidth={1.5} />
      <line x1={0} y1={0} x2={PAN_HALF} y2={PLATE_Y} stroke="currentColor" strokeWidth={1.5} />
      {weights
        .filter((w) => w.pct > 0)
        .map((w) => {
          const height = w.pct * PX_PER_POINT;
          top -= height;
          return (
            <rect
              key={w.bucket}
              x={-PAN_HALF + 8}
              y={top}
              width={PAN_HALF * 2 - 16}
              height={height}
              rx={3}
              fill={BUCKET_COLOR[w.bucket]}
              stroke="var(--color-paper)"
              strokeWidth={1.5}
            />
          );
        })}
      <rect x={-PAN_HALF} y={PLATE_Y} width={PAN_HALF * 2} height={8} rx={4} fill="currentColor" />
    </g>
  );
}

function legendText(weights: Weight[]): string {
  return weights
    .filter((w) => w.pct > 0)
    .map((w) => `${BUCKET_LABEL[w.bucket]} ${Math.round(w.pct)}%`)
    .join(', ');
}

export function Beam({ tiltDeg, level, summary, leftWeights, rightWeights, size = 'hero' }: BeamProps) {
  const tone = level ? 'var(--color-level-line)' : 'var(--color-ink)';
  return (
    <figure className="m-0 w-full">
      <svg
        viewBox="0 0 640 360"
        role="img"
        aria-label={summary}
        className={size === 'hero' ? 'mx-auto block w-full max-w-[640px]' : 'mx-auto block w-full max-w-[300px]'}
        style={{ color: tone, transition: 'color 400ms ease' }}
      >
        <polygon points={`${PIVOT.x},${PIVOT.y + 6} ${PIVOT.x - 34},300 ${PIVOT.x + 34},300`} fill="currentColor" opacity={0.14} />
        <rect x={PIVOT.x - 90} y={300} width={180} height={8} rx={4} fill="currentColor" />
        <g
          style={{
            transform: `translate(${PIVOT.x}px, ${PIVOT.y}px) rotate(${-tiltDeg}deg)`,
            transformOrigin: '0 0',
            transition: SWING,
          }}
        >
          <rect x={-ARM} y={-5} width={ARM * 2} height={10} rx={5} fill="currentColor" />
          <Pan side={-1} tiltDeg={tiltDeg} weights={leftWeights} />
          <Pan side={1} tiltDeg={tiltDeg} weights={rightWeights} />
        </g>
        <circle cx={PIVOT.x} cy={PIVOT.y} r={9} fill="var(--color-paper)" stroke="currentColor" strokeWidth={4} />
      </svg>
      {size === 'hero' && (
        <figcaption className="mx-auto mt-2 grid max-w-[640px] grid-cols-2 gap-4 text-sm">
          <span>
            <span className="font-semibold">Growth side</span>
            <br />
            <span className="num">{legendText(leftWeights) || 'Nothing here yet'}</span>
          </span>
          <span className="text-right">
            <span className="font-semibold">Steadier side</span>
            <br />
            <span className="num">{legendText(rightWeights) || 'Nothing here yet'}</span>
          </span>
        </figcaption>
      )}
    </figure>
  );
}

/** Splits a mix into the growth (equity) pan and the steadier (debt, gold, cash) pan. */
export function panWeights(mix: BucketMix): { left: Weight[]; right: Weight[] } {
  return {
    left: [{ bucket: 'equity', pct: mix.equity }],
    right: [
      { bucket: 'debt', pct: mix.debt },
      { bucket: 'gold', pct: mix.gold },
      { bucket: 'cash', pct: mix.cash },
    ],
  };
}
