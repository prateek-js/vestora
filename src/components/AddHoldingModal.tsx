import React, { useEffect, useState } from 'react';
import { AssetCategory, CurrencyCode, Holding, TaxTag } from '../types/wealth';
import { daysBetween, todayIso } from '../utils/maturity';
import { X, Plus, Pencil, AlertCircle } from 'lucide-react';

interface AddHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseCurrency: CurrencyCode;
  editingHolding?: Holding | null;
  draftHolding?: Holding | null;
  onAddHolding: (holding: Holding) => void;
  onUpdateHolding?: (holding: Holding) => void;
}

export const AddHoldingModal: React.FC<AddHoldingModalProps> = ({
  isOpen,
  onClose,
  baseCurrency,
  editingHolding = null,
  draftHolding = null,
  onAddHolding,
  onUpdateHolding,
}) => {
  const isEditMode = Boolean(editingHolding);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<AssetCategory>('MUTUAL_FUND');
  const [institution, setInstitution] = useState('');
  const [accountNumberMask, setAccountNumberMask] = useState('');
  const [investedAmount, setInvestedAmount] = useState<string>('');
  const [currentValue, setCurrentValue] = useState<string>('');
  const [currency, setCurrency] = useState<CurrencyCode>(baseCurrency);
  const [interestRatePct, setInterestRatePct] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState(todayIso());
  const [maturityDate, setMaturityDate] = useState('');
  const [taxTag, setTaxTag] = useState<TaxTag>('LTCG_EQUITY');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    const source = editingHolding ?? draftHolding;
    if (source) {
      setName(source.name);
      setCategory(source.category);
      setInstitution(source.institution ?? '');
      setAccountNumberMask(source.accountNumberMask ?? '');
      setInvestedAmount(String(source.investedAmount));
      setCurrentValue(String(source.currentValue));
      setCurrency(source.currency);
      setInterestRatePct(
        source.interestRatePct !== undefined ? String(source.interestRatePct) : ''
      );
      setPurchaseDate(source.purchaseDate || todayIso());
      setMaturityDate(source.maturityDate ?? '');
      setTaxTag(source.taxTag);
      setNotes(source.notes ?? '');
    } else {
      setName('');
      setCategory('MUTUAL_FUND');
      setInstitution('');
      setAccountNumberMask('');
      setInvestedAmount('');
      setCurrentValue('');
      setCurrency(baseCurrency);
      setInterestRatePct('');
      setPurchaseDate(todayIso());
      setMaturityDate('');
      setTaxTag('LTCG_EQUITY');
      setNotes('');
    }
  }, [isOpen, editingHolding, draftHolding, baseCurrency]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a name for the investment.');
      return;
    }
    const inv = parseFloat(investedAmount);
    const currVal = parseFloat(currentValue);

    if (isNaN(inv) || inv <= 0) {
      setError('Please enter a valid invested amount.');
      return;
    }
    if (isNaN(currVal) || currVal < 0) {
      setError('Please enter a valid current valuation.');
      return;
    }

    const parsedRate = interestRatePct.trim() ? parseFloat(interestRatePct) : undefined;
    if (parsedRate !== undefined && isNaN(parsedRate)) {
      setError('Please enter a valid annual rate %.');
      return;
    }

    const unGain = Number((currVal - inv).toFixed(2));
    const unGainPct = inv > 0 ? Number(((unGain / inv) * 100).toFixed(2)) : 0;

    let daysToMaturity: number | undefined = undefined;
    let isMatured = false;

    if (maturityDate) {
      daysToMaturity = daysBetween(todayIso(), maturityDate);
      if (daysToMaturity <= 0) {
        isMatured = true;
      }
    }

    const nextHolding: Holding = {
      ...(editingHolding ?? {}),
      id: editingHolding ? editingHolding.id : `h-custom-${Date.now()}`,
      name: name.trim(),
      category,
      institution: institution.trim() || 'Direct Account',
      accountNumberMask: accountNumberMask.trim() || undefined,
      investedAmount: inv,
      currentValue: currVal,
      currency,
      interestRatePct: parsedRate,
      purchaseDate: purchaseDate || todayIso(),
      maturityDate: maturityDate || undefined,
      daysToMaturity,
      isMatured,
      unrealizedGain: unGain,
      unrealizedGainPct: unGainPct,
      taxTag,
      notes: notes.trim() || undefined,
    };

    if (editingHolding && onUpdateHolding) {
      onUpdateHolding(nextHolding);
    } else {
      onAddHolding(nextHolding);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs">
      <div className="bg-paper border border-slate-700 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-ink/10 shadow-2xl p-6">
        <div className="flex items-center justify-between border-b border-slate-700 pb-4">
          <h3 className="text-base font-bold text-ink flex items-center gap-2">
            {isEditMode ? (
              <Pencil className="w-4 h-4 text-emerald-700" />
            ) : (
              <Plus className="w-4 h-4 text-emerald-700" />
            )}
            <span>{isEditMode ? 'Edit Investment Holding' : 'Add New Investment Holding'}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-ink/60 hover:text-ink p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/40 rounded-lg text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Instrument Name */}
          <div>
            <label className="block text-ink/60 mb-1 font-medium">
              Instrument / Security Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Parag Parikh Flexi Cap Fund or SBI 1-Year FD"
              className="w-full bg-mist border border-slate-700 rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Asset Category */}
            <div>
              <label className="block text-ink/60 mb-1 font-medium">
                Asset Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AssetCategory)}
                className="w-full bg-mist border border-slate-700 rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="MUTUAL_FUND">Mutual Fund (Equity/Debt/ELSS)</option>
                <option value="EQUITY_STOCK">Direct Equities (Demat)</option>
                <option value="FIXED_DEPOSIT">Fixed Deposit (FD)</option>
                <option value="RECURRING_DEPOSIT">Recurring Deposit (RD)</option>
                <option value="SOVEREIGN_GOLD_BOND">Sovereign Gold Bond (SGB)</option>
                <option value="GOVT_BOND">Government Bond / G-Sec</option>
                <option value="CORP_BOND">Corporate Bond / Debenture</option>
                <option value="EPF">Employees Provident Fund (EPF)</option>
                <option value="PPF">Public Provident Fund (PPF)</option>
                <option value="NPS">National Pension System (NPS)</option>
                <option value="SAVINGS_CASH">Savings Account / Cash</option>
              </select>
            </div>

            {/* Institution */}
            <div>
              <label className="block text-ink/60 mb-1 font-medium">
                Financial Institution / AMC
              </label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g. HDFC Bank, Zerodha, EPFO"
                className="w-full bg-mist border border-slate-700 rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Currency */}
            <div>
              <label className="block text-ink/60 mb-1 font-medium">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full bg-mist border border-slate-700 rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-emerald-500"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>

            {/* Invested Amount */}
            <div>
              <label className="block text-ink/60 mb-1 font-medium">
                Invested Capital *
              </label>
              <input
                type="number"
                step="any"
                required
                value={investedAmount}
                onChange={(e) => setInvestedAmount(e.target.value)}
                placeholder="e.g. 500000"
                className="w-full bg-mist border border-slate-700 rounded-lg px-3 py-2 text-ink font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Current Valuation */}
            <div>
              <label className="block text-ink/60 mb-1 font-medium">
                Current Valuation *
              </label>
              <input
                type="number"
                step="any"
                required
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                placeholder="e.g. 545000"
                className="w-full bg-mist border border-slate-700 rounded-lg px-3 py-2 text-ink font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Interest Rate */}
            <div>
              <label className="block text-ink/60 mb-1 font-medium">
                Annual Rate % (if applicable)
              </label>
              <input
                type="number"
                step="0.05"
                value={interestRatePct}
                onChange={(e) => setInterestRatePct(e.target.value)}
                placeholder="e.g. 7.5"
                className="w-full bg-mist border border-slate-700 rounded-lg px-3 py-2 text-ink font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Purchase Date */}
            <div>
              <label className="block text-ink/60 mb-1 font-medium">Purchase Date</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full bg-mist border border-slate-700 rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Maturity Date */}
            <div>
              <label className="block text-ink/60 mb-1 font-medium">
                Maturity Date (FD/RD/Bond)
              </label>
              <input
                type="date"
                value={maturityDate}
                onChange={(e) => setMaturityDate(e.target.value)}
                className="w-full bg-mist border border-slate-700 rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tax Tag */}
            <div>
              <label className="block text-ink/60 mb-1 font-medium">Tax Classification</label>
              <select
                value={taxTag}
                onChange={(e) => setTaxTag(e.target.value as TaxTag)}
                className="w-full bg-mist border border-slate-700 rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-emerald-500"
              >
                <option value="LTCG_EQUITY">LTCG Equity (12.5% above ₹1.25L)</option>
                <option value="80C">Section 80C Tax Deduction Eligible (ELSS/PPF)</option>
                <option value="80CCD">Section 80CCD(1B) Dedicated NPS Deduction</option>
                <option value="TAX_EXEMPT_EEE">Triple EEE Sovereign Exempt (SGB / PPF / EPF)</option>
                <option value="SLAB_INCOME">Taxed at Marginal Slab Rate (FD / RD / Debt)</option>
              </select>
            </div>

            {/* Account / Folio Mask */}
            <div>
              <label className="block text-ink/60 mb-1 font-medium">
                Account / Folio Ref (Optional)
              </label>
              <input
                type="text"
                value={accountNumberMask}
                onChange={(e) => setAccountNumberMask(e.target.value)}
                placeholder="e.g. FD-8492 or Folio 1234"
                className="w-full bg-mist border border-slate-700 rounded-lg px-3 py-2 text-ink font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-ink/60 mb-1 font-medium">Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Auto-renewal disabled, SIP ₹15,000/mo"
              className="w-full bg-mist border border-slate-700 rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-700 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-ink/60 hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm shadow-ink/10"
            >
              {isEditMode ? 'Save Changes' : 'Save Investment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
