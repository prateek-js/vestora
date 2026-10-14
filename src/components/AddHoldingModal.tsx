import React, { useState } from 'react';
import { AssetCategory, CurrencyCode, Holding, TaxTag } from '../types/wealth';
import { X, Plus, AlertCircle } from 'lucide-react';

interface AddHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseCurrency: CurrencyCode;
  onAddHolding: (holding: Holding) => void;
}

export const AddHoldingModal: React.FC<AddHoldingModalProps> = ({
  isOpen,
  onClose,
  baseCurrency,
  onAddHolding,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AssetCategory>('MUTUAL_FUND');
  const [institution, setInstitution] = useState('');
  const [accountNumberMask, setAccountNumberMask] = useState('');
  const [investedAmount, setInvestedAmount] = useState<string>('');
  const [currentValue, setCurrentValue] = useState<string>('');
  const [currency, setCurrency] = useState<CurrencyCode>(baseCurrency);
  const [interestRatePct, setInterestRatePct] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState('2024-01-15');
  const [maturityDate, setMaturityDate] = useState('');
  const [taxTag, setTaxTag] = useState<TaxTag>('LTCG_EQUITY');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

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

    const unGain = currVal - inv;
    const unGainPct = inv > 0 ? (unGain / inv) * 100 : 0;

    let daysToMaturity: number | undefined = undefined;
    let isMatured = false;

    if (maturityDate) {
      const today = new Date('2026-10-13');
      const mat = new Date(maturityDate);
      const diffTime = mat.getTime() - today.getTime();
      daysToMaturity = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (daysToMaturity <= 0) {
        isMatured = true;
      }
    }

    const newHolding: Holding = {
      id: `h-custom-${Date.now()}`,
      name: name.trim(),
      category,
      institution: institution.trim() || 'Direct Account',
      accountNumberMask: accountNumberMask.trim() || undefined,
      investedAmount: inv,
      currentValue: currVal,
      currency,
      interestRatePct: interestRatePct ? parseFloat(interestRatePct) : undefined,
      purchaseDate,
      maturityDate: maturityDate || undefined,
      daysToMaturity,
      isMatured,
      unrealizedGain: unGain,
      unrealizedGainPct: unGainPct,
      taxTag,
      notes: notes.trim() || undefined,
    };

    onAddHolding(newHolding);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>Add New Investment Holding</span>
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-950/30 border border-rose-500/40 rounded-lg text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Instrument Name */}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">
              Instrument / Security Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Parag Parikh Flexi Cap Fund or SBI 1-Year FD"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Asset Category */}
            <div>
              <label className="block text-slate-400 mb-1 font-medium">
                Asset Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AssetCategory)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
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
              <label className="block text-slate-400 mb-1 font-medium">
                Financial Institution / AMC
              </label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g. HDFC Bank, Zerodha, EPFO"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Currency */}
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>

            {/* Invested Amount */}
            <div>
              <label className="block text-slate-400 mb-1 font-medium">
                Invested Capital *
              </label>
              <input
                type="number"
                step="any"
                required
                value={investedAmount}
                onChange={(e) => setInvestedAmount(e.target.value)}
                placeholder="e.g. 500000"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Current Valuation */}
            <div>
              <label className="block text-slate-400 mb-1 font-medium">
                Current Valuation *
              </label>
              <input
                type="number"
                step="any"
                required
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                placeholder="e.g. 545000"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Interest Rate */}
            <div>
              <label className="block text-slate-400 mb-1 font-medium">
                Annual Rate % (if applicable)
              </label>
              <input
                type="number"
                step="0.05"
                value={interestRatePct}
                onChange={(e) => setInterestRatePct(e.target.value)}
                placeholder="e.g. 7.5"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Purchase Date */}
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Purchase Date</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Maturity Date */}
            <div>
              <label className="block text-slate-400 mb-1 font-medium">
                Maturity Date (FD/RD/Bond)
              </label>
              <input
                type="date"
                value={maturityDate}
                onChange={(e) => setMaturityDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Tax Tag */}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Tax Classification</label>
            <select
              value={taxTag}
              onChange={(e) => setTaxTag(e.target.value as TaxTag)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="LTCG_EQUITY">LTCG Equity (12.5% above ₹1.25L)</option>
              <option value="80C">Section 80C Tax Deduction Eligible (ELSS/PPF)</option>
              <option value="80CCD">Section 80CCD(1B) Dedicated NPS Deduction</option>
              <option value="TAX_EXEMPT_EEE">Triple EEE Sovereign Exempt (SGB / PPF / EPF)</option>
              <option value="SLAB_INCOME">Taxed at Marginal Slab Rate (FD / RD / Debt)</option>
            </select>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-sm"
            >
              Save Investment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
