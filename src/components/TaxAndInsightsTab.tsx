import React, { useMemo } from 'react';
import { CurrencyCode, Holding } from '../types/wealth';
import { convertCurrency, formatCurrency } from '../utils/currency';
import {
  computeTaxHarvestingAudit,
  computeTaxSectionAudit,
  detectConcentrationRisks,
} from '../utils/taxAndDiversification';
import {
  ShieldAlert,
  Percent,
  CheckCircle,
  HelpCircle,
  TrendingDown,
  Sparkles,
  PieChart,
  ArrowUpRight,
  Zap,
} from 'lucide-react';

interface TaxAndInsightsTabProps {
  holdings: Holding[];
  baseCurrency: CurrencyCode;
}

export const TaxAndInsightsTab: React.FC<TaxAndInsightsTabProps> = ({
  holdings,
  baseCurrency,
}) => {
  const taxHarvestAudit = useMemo(() => {
    return computeTaxHarvestingAudit(holdings, baseCurrency);
  }, [holdings, baseCurrency]);

  const taxSectionAudit = useMemo(() => {
    return computeTaxSectionAudit(holdings, baseCurrency);
  }, [holdings, baseCurrency]);

  const concentrationRisks = useMemo(() => {
    return detectConcentrationRisks(holdings, baseCurrency);
  }, [holdings, baseCurrency]);

  const totalPortfolioValuation = useMemo(() => {
    return holdings.reduce(
      (sum, h) => sum + convertCurrency(h.currentValue, h.currency, baseCurrency),
      0
    );
  }, [holdings, baseCurrency]);

  // Currency breakdown
  const currencySplit = useMemo(() => {
    const split: Record<CurrencyCode, number> = { INR: 0, USD: 0, EUR: 0 };
    holdings.forEach((h) => {
      const val = convertCurrency(h.currentValue, h.currency, baseCurrency);
      split[h.currency] = (split[h.currency] || 0) + val;
    });
    return split;
  }, [holdings, baseCurrency]);

  const sec80cPct = Math.min(
    100,
    (taxSectionAudit.section80cTotal / taxSectionAudit.section80cLimit) * 100
  );
  const npsPct = Math.min(
    100,
    (taxSectionAudit.nps80ccdTotal / taxSectionAudit.nps80ccdLimit) * 100
  );

  return (
    <div className="space-y-6">
      {/* 1. Header Overview */}
      <div className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-ink tracking-tight">
              Tax Optimization & Portfolio Diversification Audit
            </h2>
            <p className="text-xs text-ink/60 mt-1 max-w-2xl">
              Automated surveillance of capital gains tax liabilities, statutory deduction allowances (80C &
              NPS), single-asset concentration limits, and cross-border currency exposure.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs bg-mist px-3 py-2 rounded-lg border border-slate-700">
            <span className="text-ink/60">Estimated Annual Tax Shield:</span>
            <span className="text-emerald-700 font-bold">
              {formatCurrency(
                taxHarvestAudit.estimatedTaxSaved + taxSectionAudit.potentialTaxSaved,
                baseCurrency
              )}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Capital Gains Tax Harvesting Scanner */}
      <div className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-700" />
              <h3 className="text-sm font-semibold text-ink">
                Long-Term Capital Gains (LTCG) Tax Harvesting Scanner
              </h3>
            </div>
            <p className="text-xs text-ink/60 mt-0.5">
              Under tax law, up to {baseCurrency === 'INR' ? '₹1,25,000' : '$1,500'} in annual equity LTCG is
              exempt from tax. Selling and rebuying resets your acquisition price tax-free.
            </p>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xl font-bold font-mono text-emerald-700 tabular-nums">
              {formatCurrency(taxHarvestAudit.estimatedTaxSaved, baseCurrency)}
            </div>
            <div className="text-2xs text-ink/60 font-mono">Tax Savings Unlocked</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-mist p-3.5 rounded-lg border border-slate-700/80">
            <div className="text-2xs text-ink/60">Total Unrealized Equity Gains</div>
            <div className="text-base font-bold font-mono text-ink mt-1">
              {formatCurrency(taxHarvestAudit.eligibleLtcgGain, baseCurrency)}
            </div>
            <div className="text-2xs text-ink/60 mt-0.5">Across mutual funds & equities</div>
          </div>

          <div className="bg-mist p-3.5 rounded-lg border border-slate-700/80">
            <div className="text-2xs text-ink/60">Annual Exemption Ceiling</div>
            <div className="text-base font-bold font-mono text-emerald-700 mt-1">
              {formatCurrency(taxHarvestAudit.annualExemptionLimit, baseCurrency)}
            </div>
            <div className="text-2xs text-ink/60 mt-0.5">Section 112A annual exemption quota</div>
          </div>

          <div className="bg-mist p-3.5 rounded-lg border border-slate-700/80">
            <div className="text-2xs text-ink/60">Harvestable Gains Right Now</div>
            <div className="text-base font-bold font-mono text-emerald-700 mt-1">
              {formatCurrency(taxHarvestAudit.harvestableNow, baseCurrency)}
            </div>
            <div className="text-2xs text-ink/60 mt-0.5">Eligible for zero-tax reset</div>
          </div>
        </div>

        <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-xs text-emerald-700 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-emerald-700">Harvesting Strategy: </span>
            {taxHarvestAudit.recommendation}
          </div>
        </div>
      </div>

      {/* 3. Statutory Deductions Scorecard (Section 80C & 80CCD) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Section 80C */}
        <div className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-ink">
                Section 80C Tax Shelter (EPF, PPF, ELSS)
              </h4>
              <p className="text-2xs text-ink/60">
                Statutory cap: {formatCurrency(taxSectionAudit.section80cLimit, baseCurrency)}
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700">
              {sec80cPct.toFixed(0)}% Utilized
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-mist rounded-full overflow-hidden">
            <div
              style={{ width: `${sec80cPct}%` }}
              className="h-full bg-emerald-500 rounded-full transition-all"
            />
          </div>

          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-ink/60">
              Active: {formatCurrency(taxSectionAudit.section80cTotal, baseCurrency, { compact: true })}
            </span>
            {taxSectionAudit.section80cShortfall > 0 ? (
              <span className="text-amber-700">
                Gap: {formatCurrency(taxSectionAudit.section80cShortfall, baseCurrency, { compact: true })}
              </span>
            ) : (
              <span className="text-emerald-700 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Fully Maxed
              </span>
            )}
          </div>

          <p className="text-2xs text-ink/60">
            {taxSectionAudit.section80cShortfall > 0
              ? `You can deploy ${formatCurrency(
                  taxSectionAudit.section80cShortfall,
                  baseCurrency
                )} more into ELSS Tax Saver or PPF to reduce gross taxable salary.`
              : 'Maximum tax deduction claim of ₹1.5L achieved through your existing EPF and PPF holdings.'}
          </p>
        </div>

        {/* Section 80CCD(1B) NPS */}
        <div className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-ink">
                Section 80CCD(1B) NPS Super-Deduction
              </h4>
              <p className="text-2xs text-ink/60">
                Exclusive additional cap: {formatCurrency(taxSectionAudit.nps80ccdLimit, baseCurrency)}
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-sky-700">
              {npsPct.toFixed(0)}% Utilized
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-mist rounded-full overflow-hidden">
            <div
              style={{ width: `${npsPct}%` }}
              className="h-full bg-sky-600 rounded-full transition-all"
            />
          </div>

          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-ink/60">
              Active: {formatCurrency(taxSectionAudit.nps80ccdTotal, baseCurrency, { compact: true })}
            </span>
            {taxSectionAudit.nps80ccdShortfall > 0 ? (
              <span className="text-amber-700">
                Gap: {formatCurrency(taxSectionAudit.nps80ccdShortfall, baseCurrency, { compact: true })}
              </span>
            ) : (
              <span className="text-emerald-700 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Fully Maxed
              </span>
            )}
          </div>

          <p className="text-2xs text-ink/60">
            {taxSectionAudit.nps80ccdShortfall > 0
              ? `Deploying ${formatCurrency(
                  taxSectionAudit.nps80ccdShortfall,
                  baseCurrency
                )} into NPS Tier-1 yields an exclusive direct tax reduction beyond the standard 80C limit.`
              : 'NPS Tier-1 retirement tax shelter is optimized for maximum statutory deduction.'}
          </p>
        </div>
      </div>

      {/* 4. Portfolio Concentration & Currency Diversification Radar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Concentration Alert List */}
        <div className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-ink flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
              <span>Concentration Risk Radar</span>
            </h4>
            <span className="text-2xs font-mono text-ink/60">Threshold: &gt;20% single asset</span>
          </div>

          {concentrationRisks.length === 0 ? (
            <div className="py-6 text-center text-xs text-ink/60">
              No severe single-instrument or category over-concentration detected.
            </div>
          ) : (
            <div className="space-y-2.5">
              {concentrationRisks.map((risk, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border text-xs ${
                    risk.severity === 'HIGH'
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-700'
                      : 'bg-amber-500/10 border-amber-500/40 text-amber-700'
                  }`}
                >
                  <div className="font-semibold flex items-center justify-between">
                    <span>{risk.title}</span>
                    <span className="font-mono text-2xs bg-ink/5 px-1.5 py-0.5 rounded">
                      {risk.percentage.toFixed(1)}% Weight
                    </span>
                  </div>
                  <p className="text-2xs text-ink/70 mt-1 leading-relaxed">{risk.advice}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Global Multi-Currency Exposure */}
        <div className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-ink flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-700" />
              <span>Multi-Currency Asset Exposure</span>
            </h4>
            <span className="text-2xs font-mono text-ink/60">FX Risk Radar</span>
          </div>

          <div className="space-y-3">
            {(['INR', 'USD', 'EUR'] as CurrencyCode[]).map((c) => {
              const val = currencySplit[c] || 0;
              const pct = totalPortfolioValuation > 0 ? (val / totalPortfolioValuation) * 100 : 0;

              return (
                <div key={c} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-ink">{c} Denominated Assets</span>
                    <span className="font-mono text-ink/60 tabular-nums">
                      {formatCurrency(val, baseCurrency, { compact: true })} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-mist rounded-full overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full ${
                        c === 'INR' ? 'bg-indigo-600' : c === 'USD' ? 'bg-emerald-500' : 'bg-sky-600'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-2xs text-ink/60 leading-relaxed pt-1">
            Holding 15%–25% in hard foreign currency assets (such as USD ETFs or Euro bonds) protects your
            long-term purchasing power against emerging market currency depreciation.
          </p>
        </div>
      </div>
    </div>
  );
};
