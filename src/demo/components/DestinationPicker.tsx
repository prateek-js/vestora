import { useId } from 'react';
import { formatCurrency } from '../../utils/currency';
import type { SuggestedDestination } from '../../utils/smartDiversification';
import { SEGMENT_LABELS, segmentOf, type LoanInputs, type SegmentId } from '../splitEngine';

interface DestinationPickerProps {
  catalog: SuggestedDestination[];
  allocations: Record<string, number>;
  /** What is left of the amount moved. Never negative here: sliders stop at it. */
  unallocatedInBase: number;
  moveAmountInBase: number;
  loan: LoanInputs | null;
  canUseSuggestion: boolean;
  onChange: (id: string, amountInBase: number) => void;
  onUseSuggestion: () => void;
  onClear: () => void;
}

const ORDER: SegmentId[] = ['equity', 'debt', 'fd', 'savings', 'gold', 'loan'];

function rateText(d: SuggestedDestination, loan: LoanInputs | null): string {
  if (d.kind === 'HOME_LOAN') return loan ? `Saves ${loan.ratePct.toFixed(2)}% a year, tax-free` : 'Saves loan interest';
  return d.expectedRatePct !== undefined ? `${d.expectedRatePct.toFixed(1)}% a year` : 'Rate not available';
}

function Row({
  d,
  value,
  max,
  step,
  loan,
  onChange,
}: {
  d: SuggestedDestination;
  value: number;
  max: number;
  step: number;
  loan: LoanInputs | null;
  onChange: (amount: number) => void;
}) {
  const uid = useId();
  const money = (n: number) => formatCurrency(n);
  return (
    <li className="border-t border-ink/10 py-3 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <label htmlFor={`${uid}-range`} className="min-w-0 font-semibold leading-snug">
          {d.title}
        </label>
        <span className="num text-sm">{rateText(d, loan)}</span>
      </div>
      <div className="mt-1 flex items-center gap-3">
        <input
          id={`${uid}-range`}
          type="range"
          min={0}
          max={max}
          step={step}
          value={Math.min(value, max)}
          aria-valuetext={`${money(value)} into ${d.title}`}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-6 min-w-0 flex-1 cursor-pointer accent-ink"
        />
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          step={step}
          value={value || ''}
          placeholder="0"
          aria-label={`Exact amount for ${d.title}`}
          onChange={(e) => onChange(Math.max(0, Math.min(max, Math.round(Number(e.target.value) || 0))))}
          className="num w-28 rounded-lg border border-ink/30 bg-paper px-2 py-1.5 text-right"
        />
      </div>
    </li>
  );
}

export function DestinationPicker({
  catalog,
  allocations,
  unallocatedInBase,
  moveAmountInBase,
  loan,
  canUseSuggestion,
  onChange,
  onUseSuggestion,
  onClear,
}: DestinationPickerProps) {
  const money = (n: number) => formatCurrency(n);
  const step = moveAmountInBase >= 100000 ? 1000 : moveAmountInBase >= 10000 ? 100 : 1;
  const left = Math.max(0, unallocatedInBase);
  const groups = ORDER.map((id) => ({ id, items: catalog.filter((d) => segmentOf(d) === id) })).filter(
    (g) => g.items.length > 0
  );

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold">Where should it go?</h2>
        <p className="num m-0 font-semibold" aria-live="polite">
          {moveAmountInBase === 0
            ? 'Choose an amount to move first'
            : left === 0
              ? 'All of it is placed'
              : `${money(left)} still to place`}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {canUseSuggestion && (
          <button
            type="button"
            onClick={onUseSuggestion}
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-ink/90"
          >
            Use the suggested split
          </button>
        )}
        <button
          type="button"
          onClick={onClear}
          className="rounded-full border border-ink/30 px-4 py-2 text-sm font-semibold hover:border-ink"
        >
          Clear the split
        </button>
      </div>
      <div className="mt-4 grid gap-5">
        {groups.map((g) => (
          <section key={g.id} aria-label={SEGMENT_LABELS[g.id]}>
            <h3 className="m-0 text-base font-bold">{SEGMENT_LABELS[g.id]}</h3>
            <ul className="m-0 mt-1 list-none p-0">
              {g.items.map((d) => {
                const value = allocations[d.id] ?? 0;
                // A loan can only be prepaid up to what is owed.
                const room = d.kind === 'HOME_LOAN' && loan ? Math.min(value + left, loan.principal) : value + left;
                return (
                  <Row
                    key={d.id}
                    d={d}
                    value={value}
                    max={room}
                    step={step}
                    loan={loan}
                    onChange={(amount) => onChange(d.id, amount)}
                  />
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
