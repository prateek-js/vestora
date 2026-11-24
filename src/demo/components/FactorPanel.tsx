import { useId } from 'react';
import type { MacroParameters } from '../../types/wealth';

type NumericKey = 'inflationRatePct' | 'interestRateHikeBps' | 'geopoliticalShockIndex' | 'equityMarketShockPct';

const signed = (n: number, suffix: string) => `${n > 0 ? '+' : ''}${n}${suffix}`;

const SLIDERS: {
  key: NumericKey;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  low: string;
  high: string;
}[] = [
  { key: 'inflationRatePct', label: 'Inflation', min: 2, max: 12, step: 0.5, format: (v) => `${v}% a year`, low: 'Calm', high: 'Crisis' },
  {
    key: 'interestRateHikeBps',
    label: 'Interest rates',
    min: -200,
    max: 400,
    step: 25,
    format: (v) => `${signed(v / 100, '')} points`,
    low: 'Cuts',
    high: 'Sharp rises',
  },
  { key: 'geopoliticalShockIndex', label: 'Global tension', min: 0, max: 10, step: 1, format: (v) => `${v} out of 10`, low: 'Peaceful', high: 'War or supply shock' },
  { key: 'equityMarketShockPct', label: 'Stock market move', min: -30, max: 20, step: 1, format: (v) => signed(v, '%'), low: 'Crash', high: 'Strong rally' },
];

const HORIZONS = [1, 3, 5, 10];

export function FactorPanel({
  factors,
  onChange,
}: {
  factors: MacroParameters;
  onChange: (f: MacroParameters) => void;
}) {
  const uid = useId();
  return (
    <div className="grid gap-5">
      {SLIDERS.map((s) => {
        const id = `${uid}-${s.key}`;
        const value = factors[s.key];
        return (
          <div key={s.key}>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={id} className="font-semibold">
                {s.label}
              </label>
              <output htmlFor={id} className="num text-sm font-semibold">
                {s.format(value)}
              </output>
            </div>
            <input
              id={id}
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={value}
              aria-valuetext={s.format(value)}
              onChange={(e) => onChange({ ...factors, [s.key]: Number(e.target.value) })}
              className="mt-1 h-6 w-full cursor-pointer accent-ink"
            />
            <div className="flex justify-between text-xs text-ink/70">
              <span>{s.low}</span>
              <span>{s.high}</span>
            </div>
          </div>
        );
      })}
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 p-0 font-semibold">Look ahead</legend>
        <div className="flex flex-wrap gap-2">
          {HORIZONS.map((y) => (
            <label
              key={y}
              className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                factors.projectionHorizonYears === y ? 'border-ink bg-ink text-paper' : 'border-ink/30 hover:border-ink'
              }`}
            >
              <input
                type="radio"
                name={`${uid}-horizon`}
                className="sr-only"
                checked={factors.projectionHorizonYears === y}
                onChange={() => onChange({ ...factors, projectionHorizonYears: y })}
              />
              {y} {y === 1 ? 'year' : 'years'}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
