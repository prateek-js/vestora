import React, { useState } from 'react';
import { CurrencyCode, Holding, ReinvestmentSolution } from '../types/wealth';
import { convertCurrency, formatCurrency } from '../utils/currency';
import { X, ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

interface ReinvestModalProps {
  isOpen: boolean;
  onClose: () => void;
  holding: Holding | null;
  solution: ReinvestmentSolution | null;
  baseCurrency: CurrencyCode;
  onExecuteReinvestment: (sourceHolding: Holding, solution: ReinvestmentSolution, deployedAmount: number) => void;
}

export const ReinvestModal: React.FC<ReinvestModalProps> = ({
  isOpen,
  onClose,
  holding,
  solution,
  baseCurrency,
  onExecuteReinvestment,
}) => {
  if (!isOpen || !holding || !solution) return null;

  const sourceValuation = convertCurrency(holding.currentValue, holding.currency, baseCurrency);
  const [allocatedAmount, setAllocatedAmount] = useState<number>(sourceValuation);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleConfirm = () => {
    onExecuteReinvestment(holding, solution, allocatedAmount);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1200);
  };

  const projectedAnnualIncome = (allocatedAmount * solution.expectedAnnualYieldPct) / 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl p-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Confirm Reinvestment & Capital Deployment</span>
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-white">Reinvestment Deployed Successfully!</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Your matured capital has been allocated to {solution.solutionName} and added to your active
              portfolio ledger.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4 text-xs">
            {/* Trade Flow Card */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-slate-400 font-mono text-2xs">
                <span>REDEEMING MATURED ASSET</span>
                <span>DESTINATION ALLOCATION</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="max-w-[45%]">
                  <div className="font-bold text-slate-200 truncate">{holding.name}</div>
                  <div className="text-amber-400 font-mono font-semibold mt-0.5">
                    {formatCurrency(sourceValuation, baseCurrency)}
                  </div>
                  <div className="text-2xs text-slate-500">Matured Capital</div>
                </div>

                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </div>

                <div className="max-w-[45%] text-right">
                  <div className="font-bold text-slate-200 truncate">{solution.solutionName}</div>
                  <div className="text-emerald-400 font-mono font-semibold mt-0.5">
                    {solution.expectedAnnualYieldPct}% p.a.
                  </div>
                  <div className="text-2xs text-slate-500">{solution.riskTier} Risk</div>
                </div>
              </div>
            </div>

            {/* Allocation Amount Control */}
            <div>
              <label className="block text-slate-400 mb-1 font-medium">
                Amount to Deploy ({baseCurrency}):
              </label>
              <input
                type="number"
                value={allocatedAmount}
                onChange={(e) => setAllocatedAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-indigo-500"
              />
              <div className="flex justify-between text-2xs text-slate-500 font-mono mt-1">
                <span>Full Balance: {formatCurrency(sourceValuation, baseCurrency)}</span>
                <button
                  type="button"
                  onClick={() => setAllocatedAmount(sourceValuation)}
                  className="text-indigo-400 hover:underline"
                >
                  Allocate 100%
                </button>
              </div>
            </div>

            {/* Strategic Attributes */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-2xs font-mono">
              <div>
                <span className="text-slate-500 block">Projected 1st-Year Yield:</span>
                <span className="text-emerald-400 font-bold text-xs">
                  +{formatCurrency(projectedAnnualIncome, baseCurrency)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Lock-In Tenure:</span>
                <span className="text-slate-200 font-medium">{solution.lockInPeriod}</span>
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-800/80">
                <span className="text-slate-500 block">Tax Status:</span>
                <span className="text-slate-300">{solution.taxImplication}</span>
              </div>
            </div>

            {/* Confirmation CTA */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span>Confirm & Rebalance Portfolio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
