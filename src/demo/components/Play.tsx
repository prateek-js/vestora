import { useEffect } from 'react';
import { formatCurrency } from '../../utils/currency';
import { TARGET_MIX_BY_GOAL } from '../../utils/smartDiversification';
import { gapSentence } from '../balance';
import { describeConditions } from '../conditions';
import type { DemoPortfolio } from '../demoData';
import type { JourneyState } from '../journeyState';
import { placedTotal } from '../planLines';
import { pickStartingPlan, planToSplit, scaleAllocations } from '../splitEngine';
import type { SplitView } from '../useSplit';
import { DestinationPicker } from './DestinationPicker';
import { PlayResults } from './PlayResults';
import { SourcePicker } from './SourcePicker';

interface PlayProps {
  portfolio: DemoPortfolio;
  journey: JourneyState;
  split: SplitView;
  set: (patch: Partial<JourneyState>) => void;
  onNext: () => void;
  onEditConditions: () => void;
}

export function Play({ portfolio, journey, split, set, onNext, onEditConditions }: PlayProps) {
  const { holdings, loan } = portfolio;
  const { plans, catalog, input, result, outcome } = split;
  const target = TARGET_MIX_BY_GOAL[journey.goal].weights;
  const money = (n: number) => formatCurrency(n);

  // First visit: start from the plan the app would suggest, so the screen already shows a change.
  useEffect(() => {
    if (journey.sourceId !== null || holdings.length === 0) return;
    const start = pickStartingPlan(plans, input);
    if (start) {
      set(planToSplit(start));
      return;
    }
    const first = holdings.find((h) => h.category !== 'EPF' && h.category !== 'PPF' && h.category !== 'NPS');
    if (first) {
      const value = Math.round(first.currentValue);
      set({ sourceId: first.id, moveAmountInBase: value, allocations: {} });
    }
  }, [journey.sourceId, plans, input, holdings, set]);

  const suggestion = plans.find((p) => p.sourceHolding.id === journey.sourceId) ?? null;
  const placed = placedTotal(input) > 0;

  const pickSource = (id: string) => {
    const h = holdings.find((x) => x.id === id);
    if (!h) return;
    const value = Math.round(h.currentValue);
    set({ sourceId: id, moveAmountInBase: value, allocations: {} });
  };
  const setAmount = (amount: number) =>
    set({ moveAmountInBase: amount, allocations: scaleAllocations(journey.allocations, amount) });
  const setAllocation = (id: string, amount: number) => {
    const next = { ...journey.allocations, [id]: amount };
    if (amount <= 0) delete next[id];
    set({ allocations: next });
  };

  return (
    <div className="py-4 pb-14 md:py-8 lg:pb-8">
      <h1 tabIndex={-1} className="text-4xl font-bold outline-none md:text-5xl">Try a rebalance.</h1>
      <p className="mt-4 max-w-[52ch] text-lg">
        Pick something to move, then decide where it goes. Everything on the right updates as you go, and nothing is
        saved.
      </p>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-10">
        <div className="grid gap-8">
          <section className="rounded-2xl bg-paper p-5 md:p-6">
            <SourcePicker
              holdings={holdings}
              sourceId={journey.sourceId}
              moveAmountInBase={journey.moveAmountInBase}
              onPick={pickSource}
              onAmount={setAmount}
            />
          </section>
          {journey.sourceId && (
            <section className="rounded-2xl bg-paper p-5 md:p-6">
              <DestinationPicker
                catalog={catalog}
                allocations={journey.allocations}
                unallocatedInBase={result.unallocatedInBase}
                moveAmountInBase={journey.moveAmountInBase}
                loan={loan}
                canUseSuggestion={suggestion !== null}
                onChange={setAllocation}
                onUseSuggestion={() => suggestion && set(planToSplit(suggestion))}
                onClear={() => set({ allocations: {} })}
              />
            </section>
          )}
        </div>

        <aside
          aria-label="What your split does"
          className="rounded-2xl bg-paper p-5 md:p-6 lg:sticky lg:top-20"
        >
          <PlayResults
            result={result}
            outcome={outcome}
            target={target}
            horizonYears={journey.factors.projectionHorizonYears}
            conditions={describeConditions(journey.factors)}
            loanRatePct={loan ? loan.ratePct : null}
            onEditConditions={onEditConditions}
          />
          <div className="mt-6">
            <button
              type="button"
              disabled={!placed}
              onClick={onNext}
              className="rounded-full bg-ink px-6 py-3 font-semibold text-paper transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              See my plan
            </button>
            {!placed && <p className="mb-0 mt-2 text-sm text-ink/80">Place some of the money first.</p>}
          </div>
        </aside>
      </div>

      {/* On a phone the results sit far below the sliders, so keep the headline numbers in view. */}
      <div className="num fixed inset-x-0 bottom-0 z-10 border-t border-ink/10 bg-mist px-5 py-2 text-sm font-semibold lg:hidden">
        {gapSentence(result.mixAfter, target)}. {result.unallocatedInBase > 0 && `${money(result.unallocatedInBase)} still to place.`}
      </div>
    </div>
  );
}
