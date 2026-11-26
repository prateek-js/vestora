import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency } from '../../utils/currency';
import type { SimulationResult } from '../../utils/simulationEngine';
import type { BucketMix } from '../../utils/smartDiversification';
import { beamState, gapSentence } from '../balance';
import type { SplitResult } from '../splitEngine';
import { Beam, panWeights } from './Beam';
import { MixBar } from './MixBar';

interface PlayResultsProps {
  result: SplitResult;
  outcome: SimulationResult;
  target: BucketMix;
  horizonYears: number;
  /** The economic conditions behind the five-year figures, in words. */
  conditions: string;
  /** The loan's yearly rate when a prepayment is part of the split. */
  loanRatePct: number | null;
  onEditConditions: () => void;
}

export function PlayResults({
  result,
  outcome,
  target,
  horizonYears,
  conditions,
  loanRatePct,
  onEditConditions,
}: PlayResultsProps) {
  const money = (n: number) => formatCurrency(n);
  const beam = beamState(result.mixAfter, target);
  const sentence = gapSentence(result.mixAfter, target);
  const pans = panWeights(result.mixAfter);
  const data = outcome.trajectory.map((t) => ({
    year: t.label,
    calm: Math.round(t.baselineNominal),
    today: Math.round(t.scenarioNominal),
    after: Math.round(t.shuffledNominal),
  }));
  const gain = outcome.finalShuffledNetWorth - outcome.finalScenarioNetWorth;
  const years = `${horizonYears} ${horizonYears === 1 ? 'year' : 'years'}`;
  const summary = `In ${years}: ${money(outcome.finalScenarioNetWorth)} if you change nothing, ${money(outcome.finalShuffledNetWorth)} after your split.`;

  return (
    <div className="grid gap-6">
      <div>
        <Beam
          size="slim"
          tiltDeg={beam.tiltDeg}
          level={beam.level}
          summary={sentence}
          leftWeights={pans.left}
          rightWeights={pans.right}
        />
        <p className="m-0 mt-2 text-center font-semibold" aria-live="polite">
          {sentence}
        </p>
      </div>

      <div className="grid gap-4">
        <MixBar label="Today" mix={result.mixBefore} />
        <MixBar label="After your split" mix={result.mixAfter} target={target} />
      </div>

      <p className="num m-0">
        <span className="font-semibold">Risk score:</span> {result.riskBefore} out of 100 today,{' '}
        <span className="font-semibold">{result.riskAfter}</span> after ({result.postureAfter}).
      </p>

      {result.loanInterestSaved > 0 && (
        <p className="num m-0">
          <span className="font-semibold">Home loan:</span> you save {money(result.loanInterestSaved)} in interest and
          finish {result.loanMonthsSaved} {result.loanMonthsSaved === 1 ? 'month' : 'months'} sooner.
        </p>
      )}

      <div>
        <h3 className="m-0 text-base font-bold">What it could be worth in {years}</h3>
        <div role="img" aria-label={summary} className="mt-2 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--color-ink)" strokeOpacity={0.08} vertical={false} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 12 }} />
              <YAxis
                width={64}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => money(v)}
                domain={['auto', 'auto']}
              />
              <Tooltip formatter={(v) => money(Number(v))} />
              <Line type="monotone" dataKey="calm" name="Calm conditions" stroke="var(--color-cash)" strokeWidth={1.5} strokeDasharray="2 4" dot={false} />
              <Line type="monotone" dataKey="today" name="If you change nothing" stroke="var(--color-ink)" strokeOpacity={0.55} strokeWidth={2} strokeDasharray="6 5" dot={false} />
              <Line type="monotone" dataKey="after" name="After your split" stroke="var(--color-ink)" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <dl className="m-0 mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink/80">If you change nothing, dashed line</dt>
            <dd className="num m-0 text-xl font-bold">{money(outcome.finalScenarioNetWorth)}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink/80">After your split, solid line</dt>
            <dd className="num m-0 text-xl font-bold">{money(outcome.finalShuffledNetWorth)}</dd>
          </div>
        </dl>
        <p className="num mb-0 mt-2 text-sm text-ink/80">
          {Math.abs(gain) < 1
            ? 'Your split does not change the outcome under these conditions.'
            : gain > 0
              ? `That is ${money(gain)} more under these conditions.`
              : `That is ${money(-gain)} less under these conditions.`}
        </p>
        <p className="mb-0 mt-2 text-sm text-ink/80">
          <span className="font-semibold">Assumes:</span> {conditions} This is a stress test, not a forecast.{' '}
          <button type="button" onClick={onEditConditions} className="font-semibold text-ink underline underline-offset-4">
            Change these conditions
          </button>
        </p>
        {result.loanPrepaidInBase > 0 && loanRatePct !== null && (
          <p className="mb-0 mt-2 text-sm text-ink/80">
            Money used to prepay the loan is counted as earning the loan&rsquo;s {loanRatePct.toFixed(2)}% a year,
            tax-free.
          </p>
        )}
      </div>

      <p className="m-0 text-sm text-ink/80">
        Amounts are before any tax or exit charges. These are illustrations, not investment or tax advice.
      </p>
    </div>
  );
}
