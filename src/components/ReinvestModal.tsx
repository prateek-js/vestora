import React, { useEffect, useState } from 'react';
import { Holding, ReinvestmentSolution } from '../types/wealth';
import { formatCurrency } from '../utils/currency';
import { X, ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

interface ReinvestModalProps {
  isOpen: boolean;
  onClose: () => void;
  holding: Holding | null;
  solution: ReinvestmentSolution | null;
  onExecuteReinvestment: (sourceHolding: Holding, solution: ReinvestmentSolution, deployedAmount: number) => void;
}

export const ReinvestModal: React.FC<ReinvestModalProps> = ({
  isOpen,
  onClose,
  holding,
  solution,
  onExecuteReinvestment,
}) => {
  // Hooks must run unconditionally — the early return comes after them.
  const [allocatedAmount, setAllocatedAmount] = useState<number>(0);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && holding) {
      setAllocatedAmount(holding.currentValue);
    }
  }, [isOpen, holding]);

  if (!isOpen || !holding || !solution) return null;

  const sourceValuation = holding.currentValue;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs">
      <div className="bg-paper border border-slate-700 rounded-xl w-full max-w-lg shadow-ink/10 shadow-xl p-6">
        <div className="flex items-center justify-between border-b border-slate-700 pb-4">
          <h3 className="text-base font-bold text-ink flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-700" />
            <span>Confirm Reinvestment & Capital Deployment</span>
          </h3>
          <button
            onClick={onClose}
            className="text-ink/70 hover:text-ink p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-ink">Reinvestment Deployed Successfully!</h4>
            <p className="text-xs text-ink/70 max-w-sm mx-auto">
              Your matured capital has been allocated to {solution.solutionName} and added to your active
              portfolio ledger.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4 text-xs">
            {/* Trade Flow Card */}
            <div className="bg-mist p-4 rounded-xl border border-slate-700 space-y-3">
              <div className="flex items-center justify-between text-ink/70 font-mono text-2xs">
                <span>REDEEMING MATURED ASSET</span>
                <span>DESTINATION ALLOCATION</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="max-w-[45%]">
                  <div className="font-bold text-ink truncate">{holding.name}</div>
                  <div className="text-amber-800 font-mono font-semibold mt-0.5">
                    {formatCurrency(sourceValuation)}
                  </div>
                  <div className="text-2xs text-ink/70">Matured Capital</div>
                </div>

                <div className="w-8 h-8 rounded-full bg-paper border border-slate-700 flex items-center justify-center text-ink/70 shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </div>

                <div className="max-w-[45%] text-right">
                  <div className="font-bold text-ink truncate">{solution.solutionName}</div>
                  <div className="text-emerald-700 font-mono font-semibold mt-0.5">
                    {solution.expectedAnnualYieldPct}% p.a.
                  </div>
                  <div className="text-2xs text-ink/70">{solution.riskTier} Risk</div>
                </div>
              </div>
            </div>

            {/* Allocation Amount Control */}
            <div>
              <label className="block text-ink/70 mb-1 font-medium">
                Amount to Deploy (INR):
              </label>
              <input
                type="number"
                value={allocatedAmount}
                onChange={(e) => setAllocatedAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-mist border border-slate-700 rounded-lg px-3 py-2 text-ink font-mono font-bold text-sm focus:outline-none focus:border-emerald-500"
              />
              <div className="flex justify-between text-2xs text-ink/70 font-mono mt-1">
                <span>Full Balance: {formatCurrency(sourceValuation)}</span>
                <button
                  type="button"
                  onClick={() => setAllocatedAmount(sourceValuation)}
                  className="text-emerald-700 hover:underline"
                >
                  Allocate 100%
                </button>
              </div>
            </div>

            {/* Strategic Attributes */}
            <div className="grid grid-cols-2 gap-2 bg-mist p-3 rounded-lg border border-slate-700 text-2xs font-mono">
              <div>
                <span className="text-ink/70 block">Projected 1st-Year Yield:</span>
                <span className="text-emerald-700 font-bold text-xs">
                  +{formatCurrency(projectedAnnualIncome)}
                </span>
              </div>
              <div>
                <span className="text-ink/70 block">Lock-In Tenure:</span>
                <span className="text-ink font-medium">{solution.lockInPeriod}</span>
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-700/80">
                <span className="text-ink/70 block">Tax Status:</span>
                <span className="text-ink/70">{solution.taxImplication}</span>
              </div>
            </div>

            {/* Confirmation CTA */}
            <div className="pt-3 border-t border-slate-700 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-ink/70 hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-5 py-2 text-xs font-semibold text-paper bg-ink hover:bg-ink/90 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-ink/10"
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
