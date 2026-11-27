import { useId } from 'react';
import type { Holding } from '../../types/wealth';
import { formatCurrency } from '../../utils/currency';
import { isLockedIn } from '../splitEngine';

interface SourcePickerProps {
  holdings: Holding[];
  sourceId: string | null;
  moveAmountInBase: number;
  onPick: (id: string) => void;
  onAmount: (amountInBase: number) => void;
}

const PRESETS = [25, 50, 75, 100];

function isMatured(h: Holding): boolean {
  return Boolean(h.isMatured || (h.daysToMaturity !== undefined && h.daysToMaturity <= 0));
}

export function SourcePicker({ holdings, sourceId, moveAmountInBase, onPick, onAmount }: SourcePickerProps) {
  const uid = useId();
  const money = (n: number) => formatCurrency(n, { compact: true });
  const valueOf = (h: Holding) => Math.max(0, h.currentValue);
  const sorted = [...holdings].sort((a, b) => valueOf(b) - valueOf(a));
  const source = holdings.find((h) => h.id === sourceId) ?? null;
  const sourceValue = source ? Math.round(valueOf(source)) : 0;
  const step = sourceValue >= 100000 ? 1000 : sourceValue >= 10000 ? 100 : 1;

  return (
    <div>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-3 p-0 text-xl font-bold">Pick what to move</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {sorted.map((h) => {
            const locked = isLockedIn(h);
            const selected = h.id === sourceId;
            return (
              <label
                key={h.id}
                className={`block rounded-xl border p-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                  locked
                    ? 'cursor-not-allowed border-ink/10 bg-ink/5 text-ink/70'
                    : selected
                      ? 'cursor-pointer border-ink bg-ink text-paper'
                      : 'cursor-pointer border-ink/20 bg-paper hover:border-ink'
                }`}
              >
                <input
                  type="radio"
                  name={`${uid}-source`}
                  className="sr-only"
                  disabled={locked}
                  checked={selected}
                  onChange={() => onPick(h.id)}
                />
                <span className="block font-semibold leading-snug">{h.name}</span>
                <span className="num mt-1 block text-sm">
                  {money(valueOf(h))}
                  {isMatured(h) && ' · matured and sitting idle'}
                </span>
                {locked && <span className="mt-1 block text-sm">Locked in until retirement</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      {source && (
        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={`${uid}-amount`} className="font-semibold">
              How much of it?
            </label>
            <output htmlFor={`${uid}-amount`} className="num text-lg font-bold">
              {money(moveAmountInBase)}
            </output>
          </div>
          <input
            id={`${uid}-amount`}
            type="range"
            min={0}
            max={sourceValue}
            step={step}
            value={Math.min(moveAmountInBase, sourceValue)}
            aria-valuetext={`${money(moveAmountInBase)} of ${money(sourceValue)}`}
            onChange={(e) => onAmount(Number(e.target.value))}
            className="mt-1 h-6 w-full cursor-pointer accent-ink"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={Math.abs(moveAmountInBase - sourceValue * (p / 100)) < step}
                onClick={() => onAmount(Math.round(sourceValue * (p / 100)))}
                className="rounded-full border border-ink/30 px-4 py-1.5 text-sm font-semibold hover:border-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper"
              >
                {p === 100 ? 'All of it' : `${p}%`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
