import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { AssetCategory, Holding } from '../../types/wealth';
import { holdingFromDraft, type HoldingDraft } from '../holdingDraft';

interface HoldingFormProps {
  initial: HoldingDraft;
  existing?: Holding;
  onSave: (h: Holding) => void;
  onCancel: () => void;
}

/** Plain-word names for each kind of investment. */
export const CATEGORY_LABEL: Record<AssetCategory, string> = {
  MUTUAL_FUND: 'Mutual fund',
  EQUITY_STOCK: 'Stock',
  FIXED_DEPOSIT: 'Fixed deposit',
  RECURRING_DEPOSIT: 'Recurring deposit',
  SOVEREIGN_GOLD_BOND: 'Gold bond',
  GOVT_BOND: 'Government bond',
  CORP_BOND: 'Company bond',
  EPF: 'Employee provident fund',
  PPF: 'Public provident fund',
  NPS: 'Pension scheme (NPS)',
  SAVINGS_CASH: 'Savings account or cash',
};


const fieldClass = 'mt-1 block w-full rounded-lg border border-ink/30 bg-paper px-3 py-2 text-ink';
const labelClass = 'block text-sm font-semibold';

export function HoldingForm({ initial, existing, onSave, onCancel }: HoldingFormProps) {
  const uid = useId();
  const [draft, setDraft] = useState<HoldingDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const set = <K extends keyof HoldingDraft>(key: K, value: HoldingDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = holdingFromDraft(draft, existing);
    if (result.ok) onSave(result.holding);
    else setError(result.error);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  };

  const id = (name: string) => `${uid}-${name}`;
  const text = (name: keyof HoldingDraft, label: string, extra?: { decimal?: boolean }) => (
    <div>
      <label htmlFor={id(name)} className={labelClass}>
        {label}
      </label>
      <input
        id={id(name)}
        ref={name === 'name' ? nameRef : undefined}
        type="text"
        inputMode={extra?.decimal ? 'decimal' : undefined}
        autoComplete="off"
        value={draft[name]}
        onChange={(e) => set(name, e.target.value as never)}
        className={fieldClass}
      />
    </div>
  );

  return (
    <form
      onSubmit={submit}
      onKeyDown={onKeyDown}
      noValidate
      aria-labelledby={id('title')}
      className="rounded-xl border border-ink/15 bg-paper p-4 sm:p-5"
    >
      <h2 id={id('title')} className="m-0 mb-4 text-xl font-bold">
        {existing ? 'Edit this investment' : 'Add an investment'}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {text('name', 'Name')}
        <div>
          <label htmlFor={id('category')} className={labelClass}>
            Kind of investment
          </label>
          <select
            id={id('category')}
            value={draft.category}
            onChange={(e) => set('category', e.target.value as AssetCategory)}
            className={fieldClass}
          >
            {(Object.keys(CATEGORY_LABEL) as AssetCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        {text('institution', 'Bank or provider (optional)')}
        <div>
          <label htmlFor={id('currency')} className={labelClass}>
            Currency
          </label>
          <div id={id('currency')} className={fieldClass}>INR</div>
        </div>
        {text('investedAmount', 'Amount you put in', { decimal: true })}
        {text('currentValue', 'Worth today', { decimal: true })}
        {text('interestRatePct', 'Yearly interest rate % (optional)', { decimal: true })}
        <div>
          <label htmlFor={id('maturityDate')} className={labelClass}>
            Matures on (optional)
          </label>
          <input
            id={id('maturityDate')}
            type="date"
            value={draft.maturityDate}
            onChange={(e) => set('maturityDate', e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-0 mt-4 font-semibold text-risk">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-full bg-ink px-6 py-3 font-semibold text-paper transition-colors hover:bg-ink/90"
        >
          {existing ? 'Save changes' : 'Add it'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-4 py-3 font-semibold text-ink underline underline-offset-4 hover:bg-ink/5"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
