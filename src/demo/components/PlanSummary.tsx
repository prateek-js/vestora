import { formatCurrency } from '../../utils/currency';
import { TARGET_MIX_BY_GOAL } from '../../utils/smartDiversification';
import { beamState, gapSentence } from '../balance';
import { describeConditions } from '../conditions';
import type { DemoPortfolio } from '../demoData';
import type { JourneyState } from '../journeyState';
import { placedTotal, planLines } from '../planLines';
import type { SplitView } from '../useSplit';
import { Beam, panWeights } from './Beam';
import { MixBar } from './MixBar';

interface PlanSummaryProps {
  portfolio: DemoPortfolio;
  journey: JourneyState;
  split: SplitView;
  onBack: () => void;
  onEditConditions: () => void;
}

const quietButton = 'rounded-full border border-ink/30 px-6 py-3 font-semibold hover:border-ink';

export function PlanSummary({ portfolio, journey, split, onBack, onEditConditions }: PlanSummaryProps) {
  const { holdings } = portfolio;
  const { input, result, outcome } = split;
  const money = (n: number) => formatCurrency(n);
  const source = holdings.find((h) => h.id === journey.sourceId) ?? null;
  const total = placedTotal(input);

  if (!source || total <= 0) {
    return (
      <div className="py-4 md:py-8">
        <h1 tabIndex={-1} className="text-4xl font-bold outline-none md:text-5xl">Your plan is empty.</h1>
        <p className="mt-4 max-w-[46ch] text-lg">
          You have not placed any money yet. Go back, choose where it should go, and the plan will appear here.
        </p>
        <button type="button" onClick={onBack} className="mt-6 rounded-full bg-ink px-6 py-3 font-semibold text-paper hover:bg-ink/90">
          Back to the split
        </button>
      </div>
    );
  }

  const target = TARGET_MIX_BY_GOAL[journey.goal].weights;
  const beam = beamState(result.mixAfter, target);
  const sentence = beam.level ? 'Your mix is on target' : gapSentence(result.mixAfter, target);
  const pans = panWeights(result.mixAfter);
  const lines = planLines(source, input, result, money);
  const years = journey.factors.projectionHorizonYears;
  const gain = outcome.finalShuffledNetWorth - outcome.finalScenarioNetWorth;

  return (
    <div className="py-4 md:py-8">
      <h1 tabIndex={-1} className="text-4xl font-bold outline-none md:text-5xl">Your rebalance plan.</h1>
      <p className="mt-4 max-w-[52ch] text-lg">
        Move <span className="num font-semibold">{money(total)}</span> out of {source.name}. Here is what to do with it,
        and what changes.
      </p>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
        <div>
          <h2 className="m-0 text-2xl font-bold">What to do</h2>
          <ul className="m-0 mt-3 list-none p-0">
            {lines.map((l) => (
              <li key={l.text} className="border-t border-ink/10 py-4 first:border-t-0">
                <div className="text-lg font-semibold leading-snug">{l.text}</div>
                <div className="mt-1 text-ink/80">{l.reason}</div>
              </li>
            ))}
          </ul>
          {result.unallocatedInBase > 0 && (
            <p className="num mt-2 rounded-xl bg-tilt/25 p-3 text-sm">
              {money(result.unallocatedInBase)} of the amount you chose is not placed yet, so it stays where it is.
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-paper p-5 md:p-6">
          <Beam
            tiltDeg={beam.tiltDeg}
            level={beam.level}
            summary={sentence}
            leftWeights={pans.left}
            rightWeights={pans.right}
          />
          <p className="mb-0 mt-3 text-center text-lg font-semibold">{sentence}</p>

          <div className="mt-6 grid gap-5">
            <MixBar label="Today" mix={result.mixBefore} />
            <MixBar label="After the plan" mix={result.mixAfter} target={target} />
          </div>

          <dl className="m-0 mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-ink/80">Risk score</dt>
              <dd className="num m-0 text-xl font-bold">
                {result.riskBefore} to {result.riskAfter}
              </dd>
              <dd className="m-0 text-sm text-ink/80">{result.postureAfter}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink/80">
                In {years} {years === 1 ? 'year' : 'years'}
              </dt>
              <dd className="num m-0 text-xl font-bold">
                {money(outcome.finalScenarioNetWorth)} to {money(outcome.finalShuffledNetWorth)}
              </dd>
              <dd className="num m-0 text-sm text-ink/80">
                {Math.abs(gain) < 1 ? 'No change' : `${gain > 0 ? '+' : '-'}${money(Math.abs(gain))}`} under the conditions below
              </dd>
            </div>
            {result.loanInterestSaved > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-ink/80">Home loan</dt>
                <dd className="num m-0 text-xl font-bold">{money(result.loanInterestSaved)} less interest</dd>
                <dd className="num m-0 text-sm text-ink/80">
                  {result.loanMonthsSaved} {result.loanMonthsSaved === 1 ? 'month' : 'months'} sooner
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <p className="mt-8 max-w-[70ch] text-sm text-ink/80">
        <span className="font-semibold">The five-year figures assume:</span> {describeConditions(journey.factors)} This
        is a stress test, not a forecast.{' '}
        <button type="button" onClick={onEditConditions} className="font-semibold text-ink underline underline-offset-4">
          Change these conditions
        </button>
        {result.loanPrepaidInBase > 0 && portfolio.loan && (
          <>
            {' '}
            Money used to prepay the loan is counted as earning its {portfolio.loan.ratePct.toFixed(2)}% a year, tax-free.
          </>
        )}
      </p>

      <p className="mt-3 max-w-[70ch] text-sm text-ink/80">
        Amounts are before any tax or exit charges, which may apply when you sell or break a deposit. Figures are
        illustrative and self-reported. This is not investment or tax advice.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} className={quietButton}>
          Change the split
        </button>
        <a
          href="/#rebalance"
          className="rounded-full bg-ink px-6 py-3 font-semibold text-paper no-underline hover:bg-ink/90"
        >
          Open in the full app
        </a>
      </div>
    </div>
  );
}
